import { describe, expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithCard() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 300_000
	});
	const card = await owner.mutation(api.accounts.create, {
		name: 'Discover',
		kind: 'creditCard',
		startingBalance: -20_000
	});
	await owner.mutation(api.transactions.create, {
		accountId: card,
		date: '2026-08-05',
		amount: -4_500,
		payee: 'Sample Grocer',
		memo: ''
	});
	const view = async () => {
		const month = await owner.query(api.budget.month, { month: '2026-08', today: '2026-08-31' });
		return {
			readyToAssign: month.readyToAssign,
			groups: month.groups.map((group) => ({
				name: group.name,
				kind: group.kind,
				categories: group.categories.map(({ name, available, payment }) => ({
					name,
					available,
					payment
				}))
			}))
		};
	};
	return { ...backend, card, view };
}

type Backend = Awaited<ReturnType<typeof budgetWithCard>>;

/** Puts the budget back as it was before Credit Card Accounts: the card has no Payment Category, and
 * its starting debt sits Uncategorized. */
async function makeLegacy({ t, card }: Backend, startingRow: { date?: string } = {}) {
	await t.run(async (ctx) => {
		for await (const category of ctx.db.query('categories')) {
			if (category.kind === 'creditCardPayment') await ctx.db.delete('categories', category._id);
		}
		for await (const group of ctx.db.query('categoryGroups')) {
			if (group.kind === 'creditCardPayments') await ctx.db.delete('categoryGroups', group._id);
		}
		for await (const transaction of ctx.db.query('transactions')) {
			if (transaction.accountId === card && transaction.date === '2026-08-01') {
				await ctx.db.patch('transactions', transaction._id, {
					categoryId: undefined,
					...startingRow
				});
			}
		}
	});
	await t.mutation(internal.monthlyTotals.rebuild, {});
}

describe('backfilling Payment Categories', () => {
	test('gives a card made before Credit Card Accounts what a new card gets', async () => {
		const current = await budgetWithCard();
		const legacy = await budgetWithCard();
		await makeLegacy(legacy);
		expect(await legacy.view()).not.toEqual(await current.view());

		expect(await legacy.t.mutation(internal.migrations.backfillPaymentCategories, {})).toEqual({
			repaired: 1,
			unmatched: []
		});

		expect(await legacy.view()).toEqual(await current.view());
		const none = { repaired: 0, unmatched: [] };
		expect(await legacy.t.mutation(internal.migrations.backfillPaymentCategories, {})).toEqual(
			none
		);
		expect(await current.t.mutation(internal.migrations.backfillPaymentCategories, {})).toEqual(
			none
		);
	});

	test('names a card whose starting debt the owner has since moved to another date', async () => {
		const legacy = await budgetWithCard();
		await makeLegacy(legacy, { date: '2026-08-02' });

		expect(await legacy.t.mutation(internal.migrations.backfillPaymentCategories, {})).toEqual({
			repaired: 1,
			unmatched: [legacy.card]
		});

		const payment = (await legacy.view()).groups
			.flatMap((group) => group.categories)
			.find((category) => category.name === 'Discover');
		expect(payment?.payment ?? null).not.toBeNull();
	});

	test('leaves a starting debt the owner has since split, and names its card', async () => {
		const legacy = await budgetWithCard();
		await makeLegacy(legacy);
		const { owner, t, card } = legacy;
		const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
		const [groceries, dining] = await Promise.all(
			['Groceries', 'Dining Out'].map((name) =>
				owner.mutation(api.categories.create, { groupId: everyday, name })
			)
		);
		if (groceries === undefined || dining === undefined) throw new Error('No Categories.');
		const startingRow = await t.run(async (ctx) =>
			ctx.db
				.query('transactions')
				.withIndex('by_account_date', (q) => q.eq('accountId', card).eq('date', '2026-08-01'))
				.unique()
		);
		if (startingRow === null) throw new Error('No starting row.');
		await owner.mutation(api.transactions.update, {
			transactionId: startingRow._id,
			accountId: card,
			date: '2026-08-01',
			amount: -20_000,
			payee: 'Starting Balance',
			memo: '',
			splits: [
				{ categoryId: groceries, amount: -15_000, memo: '' },
				{ categoryId: dining, amount: -5_000, memo: '' }
			]
		});
		const before = await legacy.view();

		expect(await t.mutation(internal.migrations.backfillPaymentCategories, {})).toEqual({
			repaired: 1,
			unmatched: [card]
		});

		const after = await t.run(async (ctx) => ({
			row: await ctx.db.get('transactions', startingRow._id),
			lines: await ctx.db
				.query('transactionSplits')
				.withIndex('by_transaction', (q) => q.eq('transactionId', startingRow._id))
				.collect()
		}));
		expect(after.row).toMatchObject({ split: true });
		expect(after.row?.categoryId).toBeUndefined();
		expect(after.lines.map((line) => line.amount).sort()).toEqual([-15_000, -5_000]);
		const spending = (view: typeof before) =>
			view.groups.flatMap((group) => group.categories).filter((c) => c.payment === null);
		expect(spending(await legacy.view())).toEqual(spending(before));
	});
});
