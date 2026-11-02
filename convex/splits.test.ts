import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithCard() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 300_000
	});
	const card = await owner.mutation(api.accounts.create, {
		name: 'Card',
		kind: 'creditCard',
		startingBalance: -20_000
	});
	const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
	const groceries = await owner.mutation(api.categories.create, {
		groupId: everyday,
		name: 'Groceries'
	});
	const household = await owner.mutation(api.categories.create, {
		groupId: everyday,
		name: 'Household'
	});
	await owner.mutation(api.budget.setAssigned, {
		month: '2026-08',
		categoryId: groceries,
		amount: 5_000
	});
	const view = (month = '2026-08') => owner.query(api.budget.month, { month, today: '2026-08-31' });
	return { ...backend, checking, card, groceries, household, view };
}

const shop = { date: '2026-08-14', payee: 'Sample Warehouse', memo: '' };

test('a split card purchase gives the same budget as a Transaction per line', async () => {
	const split = await budgetWithCard();
	await split.owner.mutation(api.transactions.create, {
		accountId: split.card,
		...shop,
		amount: -9_000,
		splits: [
			{ categoryId: split.groceries, amount: -6_500, memo: 'Food' },
			{ categoryId: split.household, amount: -2_500, memo: '' }
		]
	});

	const separate = await budgetWithCard();
	for (const [categoryId, amount] of [
		[separate.groceries, -6_500],
		[separate.household, -2_500]
	] as const) {
		await separate.owner.mutation(api.transactions.create, {
			accountId: separate.card,
			...shop,
			amount,
			categoryId
		});
	}

	const budget = await split.view();
	expect(budget).toEqual(await separate.view());
	const rows = budget.groups.flatMap((g) => g.categories);
	expect(rows.find((c) => c.name === 'Card')).toMatchObject({ activity: 9_000 });
	expect(rows.find((c) => c.name === 'Groceries')).toMatchObject({ available: -1_500 });
	expect(budget.uncategorizedCount).toBe(0);
});

/** Each Category's Activity in a month, by name, Payment Categories included. */
async function activityIn(b: Awaited<ReturnType<typeof budgetWithCard>>, month: string) {
	const budget = await b.view(month);
	return Object.fromEntries(
		budget.groups.flatMap((g) => g.categories).map((c) => [c.name, c.activity])
	);
}

describe('a split', () => {
	test("is refused unless its lines add up to the Transaction's amount", async () => {
		const b = await budgetWithCard();
		const entered = {
			accountId: b.checking,
			...shop,
			amount: -9_000,
			splits: [
				{ categoryId: b.groceries, amount: -6_500, memo: '' },
				{ categoryId: b.household, amount: -2_000, memo: '' }
			]
		};

		expect(await publicErrorCode(b.owner.mutation(api.transactions.create, entered))).toBe(
			'INVALID_INPUT'
		);
		const transactionId = await b.owner.mutation(api.transactions.create, {
			...entered,
			amount: -8_500
		});
		expect(
			await publicErrorCode(
				b.owner.mutation(api.transactions.update, { transactionId, ...entered })
			)
		).toBe('INVALID_INPUT');
		expect(await activityIn(b, '2026-08')).toMatchObject({ Groceries: -6_500, Household: -2_000 });
	});

	test('is refused with one line, a Category of its own, or as a Transfer', async () => {
		const b = await budgetWithCard();
		const lines = [
			{ categoryId: b.groceries, amount: -6_500, memo: '' },
			{ categoryId: b.household, amount: -2_500, memo: '' }
		];
		const attempts = [
			{ accountId: b.checking, ...shop, amount: -6_500, splits: lines.slice(0, 1) },
			{ accountId: b.checking, ...shop, amount: -9_000, categoryId: b.groceries, splits: lines },
			{
				accountId: b.checking,
				...shop,
				payee: '',
				amount: -9_000,
				transferAccountId: b.card,
				splits: lines
			}
		];
		for (const attempt of attempts) {
			expect(await publicErrorCode(b.owner.mutation(api.transactions.create, attempt))).toBe(
				'INVALID_INPUT'
			);
		}
	});

	test('moves its lines with it to a new date, and can be un-split or deleted', async () => {
		const b = await budgetWithCard();
		const entered = {
			accountId: b.card,
			...shop,
			amount: -9_000,
			splits: [
				{ categoryId: b.groceries, amount: -6_500, memo: 'Food' },
				{ categoryId: b.household, amount: -2_500, memo: 'Soap' }
			]
		};
		const transactionId = await b.owner.mutation(api.transactions.create, entered);

		await b.owner.mutation(api.transactions.update, {
			transactionId,
			...entered,
			date: '2026-09-02'
		});
		expect(await activityIn(b, '2026-08')).toMatchObject({ Groceries: 0, Household: 0, Card: 0 });
		expect(await activityIn(b, '2026-09')).toMatchObject({
			Groceries: -6_500,
			Household: -2_500,
			Card: 9_000
		});

		const { splits, ...unsplit } = entered;
		await b.owner.mutation(api.transactions.update, {
			transactionId,
			...unsplit,
			categoryId: b.household
		});
		expect(await activityIn(b, '2026-08')).toMatchObject({
			Groceries: 0,
			Household: -9_000,
			Card: 9_000
		});

		await b.owner.mutation(api.transactions.update, { transactionId, ...unsplit, splits });
		await b.owner.mutation(api.transactions.remove, { transactionId });
		expect(await activityIn(b, '2026-08')).toMatchObject({ Groceries: 0, Household: 0, Card: 0 });
	});
});

test('a split inflow waits for its date before its Ready to Assign line counts', async () => {
	const b = await budgetWithCard();
	const { readyToAssignId } = await b.owner.query(api.categories.list, {});
	if (readyToAssignId === null) throw new Error('Ready to Assign was not created.');
	const before = (await b.view()).readyToAssign;

	await b.owner.mutation(api.transactions.create, {
		accountId: b.checking,
		date: '2026-09-04',
		payee: 'Sample Employer',
		amount: 100_000,
		memo: '',
		splits: [
			{ categoryId: readyToAssignId, amount: 80_000, memo: '' },
			{ categoryId: b.groceries, amount: 20_000, memo: 'Reimbursed' }
		]
	});

	expect((await b.view()).readyToAssign).toEqual(before);
	const later = await b.owner.query(api.budget.month, { month: '2026-09', today: '2026-09-04' });
	expect(later.readyToAssign).toEqual({ ...before, amount: before.amount + 80_000 });
});

test('the Transaction list shows a split with its lines in place of a Category', async () => {
	const b = await budgetWithCard();
	await b.owner.mutation(api.transactions.create, {
		accountId: b.card,
		...shop,
		amount: -9_000,
		splits: [
			{ categoryId: b.groceries, amount: -6_500, memo: ' Food ' },
			{ categoryId: b.household, amount: -2_500, memo: '' }
		]
	});

	const { page } = await b.owner.query(api.transactions.list, {
		accountId: b.card,
		paginationOpts: { numItems: 10, cursor: null }
	});
	expect(page.find((row) => row.payeeName === 'Sample Warehouse')).toMatchObject({
		categoryId: null,
		categoryName: null,
		splits: [
			{ categoryId: b.groceries, categoryName: 'Groceries', amount: -6_500, memo: 'Food' },
			{ categoryId: b.household, categoryName: 'Household', amount: -2_500, memo: null }
		]
	});
});
