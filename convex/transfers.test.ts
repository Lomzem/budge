import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithThreeAccounts() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const account = (name: string, kind: 'cash' | 'creditCard', startingBalance: number) =>
		owner.mutation(api.accounts.create, { name, kind, startingBalance });
	const checking = await account('Checking', 'cash', 100_000);
	const savings = await account('Savings', 'cash', 500_000);
	const card = await account('Card', 'creditCard', -20_000);
	const balances = async () =>
		Object.fromEntries(
			(await owner.query(api.accounts.list, {})).map((row) => [row.name, row.balance])
		);
	const rows = async (accountId: Id<'accounts'>) =>
		(
			await owner.query(api.transactions.list, {
				accountId,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	return { ...backend, checking, savings, card, balances, rows };
}

const toSavings = { date: '2026-08-20', amount: -25_000, payee: '', memo: 'Rainy day' };

describe('a Transfer', () => {
	test('appears in both Accounts with opposite amounts, each naming the other', async () => {
		const { owner, checking, savings, balances, rows } = await budgetWithThreeAccounts();

		await owner.mutation(api.transactions.create, {
			accountId: checking,
			transferAccountId: savings,
			...toSavings
		});

		expect(await balances()).toMatchObject({ Checking: 75_000, Savings: 525_000 });
		expect(await rows(checking)).toMatchObject([
			{
				date: '2026-08-20',
				amount: -25_000,
				categoryId: null,
				memo: 'Rainy day',
				transfer: { accountId: savings, accountName: 'Savings' }
			}
		]);
		expect(await rows(savings)).toMatchObject([
			{
				date: '2026-08-20',
				amount: 25_000,
				categoryId: null,
				memo: 'Rainy day',
				transfer: { accountId: checking, accountName: 'Checking' }
			}
		]);
	});

	test('between Cash Accounts leaves Ready to Assign and every Category unchanged', async () => {
		const { owner, checking, savings } = await budgetWithThreeAccounts();
		const groupId = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
		const groceries = await owner.mutation(api.categories.create, { groupId, name: 'Groceries' });
		await owner.mutation(api.budget.setAssigned, {
			month: '2026-08',
			categoryId: groceries,
			amount: 30_000
		});
		const budget = () => owner.query(api.budget.month, { month: '2026-08', today: '2026-08-15' });
		const before = await budget();

		// One dated today and one still ahead: an inflow side waiting for its date is no
		// Uncategorized inflow either.
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			transferAccountId: savings,
			...toSavings,
			date: '2026-08-15'
		});
		await owner.mutation(api.transactions.create, {
			accountId: savings,
			transferAccountId: checking,
			...toSavings,
			date: '2026-08-20'
		});

		expect(await budget()).toEqual(before);
		// The card's starting debt is still Uncategorized.
		expect(before.readyToAssign).toEqual({ amount: 550_000, uncategorized: -20_000 });
	});

	test.each([
		['to its own Account', { transferAccountId: 'self' }],
		['with a Category', { categoryId: 'groceries' }],
		['with a Payee', { payee: 'Sample Bank' }]
	] as const)('refuses one %s', async (_, change) => {
		const { owner, checking, savings } = await budgetWithThreeAccounts();
		const groupId = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
		const groceries = await owner.mutation(api.categories.create, { groupId, name: 'Groceries' });

		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.create, {
					accountId: checking,
					...toSavings,
					transferAccountId: 'transferAccountId' in change ? checking : savings,
					...('categoryId' in change ? { categoryId: groceries } : {}),
					...('payee' in change ? { payee: change.payee } : {})
				})
			)
		).toBe('INVALID_INPUT');
	});
});

describe('changing one side of a Transfer', () => {
	async function transferred() {
		const backend = await budgetWithThreeAccounts();
		const { owner, checking, savings } = backend;
		const fromChecking = await owner.mutation(api.transactions.create, {
			accountId: checking,
			transferAccountId: savings,
			...toSavings
		});
		const [intoSavings] = await backend.rows(savings);
		if (intoSavings === undefined) throw new Error('The Transfer has no Savings side.');
		return { ...backend, fromChecking, intoSavings: intoSavings._id };
	}

	test('editing the amount and date on one side changes the other', async () => {
		const { owner, checking, savings, intoSavings, balances, rows } = await transferred();

		await owner.mutation(api.transactions.update, {
			transactionId: intoSavings,
			accountId: savings,
			transferAccountId: checking,
			...toSavings,
			date: '2026-09-02',
			amount: 40_000
		});

		expect(await balances()).toMatchObject({ Checking: 60_000, Savings: 540_000 });
		expect(await rows(checking)).toMatchObject([{ date: '2026-09-02', amount: -40_000 }]);
		expect(await rows(savings)).toMatchObject([{ date: '2026-09-02', amount: 40_000 }]);
	});

	test('moving either side to another Account moves that side, still linked', async () => {
		const { owner, checking, savings, card, intoSavings, balances, rows } = await transferred();
		const intoSavingsFrom = (accountId: Id<'accounts'>, transferAccountId: Id<'accounts'>) =>
			owner.mutation(api.transactions.update, {
				transactionId: intoSavings,
				accountId,
				transferAccountId,
				...toSavings,
				amount: 25_000
			});

		// The other side moves from Checking to the Card.
		await intoSavingsFrom(savings, card);
		expect(await balances()).toMatchObject({ Checking: 100_000, Savings: 525_000, Card: -45_000 });
		expect(await rows(checking)).toEqual([]);
		expect(await rows(card)).toMatchObject([
			{ amount: -25_000, transfer: { accountId: savings, accountName: 'Savings' } }
		]);

		// This side moves from Savings to Checking.
		await intoSavingsFrom(checking, card);
		expect(await balances()).toMatchObject({ Checking: 125_000, Savings: 500_000, Card: -45_000 });
		expect(await rows(savings)).toEqual([]);
		expect(await rows(card)).toMatchObject([
			{ amount: -25_000, transfer: { accountId: checking, accountName: 'Checking' } }
		]);
	});

	test('keeps whether each side is Cleared', async () => {
		const { owner, checking, savings, fromChecking, rows } = await transferred();
		await owner.mutation(api.transactions.setCleared, {
			transactionId: fromChecking,
			cleared: true
		});

		await owner.mutation(api.transactions.update, {
			transactionId: fromChecking,
			accountId: checking,
			transferAccountId: savings,
			...toSavings,
			memo: 'Moved early'
		});

		expect(await rows(checking)).toMatchObject([{ cleared: true, memo: 'Moved early' }]);
		expect(await rows(savings)).toMatchObject([{ cleared: false, memo: 'Moved early' }]);
	});

	test('deleting either side deletes both', async () => {
		const { owner, intoSavings, fromChecking, balances, rows, checking, savings } =
			await transferred();

		await owner.mutation(api.transactions.remove, { transactionId: intoSavings });

		expect(await balances()).toMatchObject({ Checking: 100_000, Savings: 500_000 });
		expect(await rows(checking)).toEqual([]);
		expect(await rows(savings)).toEqual([]);
		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.remove, { transactionId: fromChecking })
			)
		).toBe('NOT_FOUND');
	});

	test('giving one side a Category makes it an ordinary Transaction and deletes the other', async () => {
		const { owner, checking, fromChecking, balances, rows, savings } = await transferred();
		const readyToAssignId = (await owner.query(api.categories.list, {})).readyToAssignId;
		if (readyToAssignId === null) throw new Error('Ready to Assign is missing.');

		await owner.mutation(api.transactions.update, {
			transactionId: fromChecking,
			accountId: checking,
			...toSavings,
			categoryId: readyToAssignId
		});

		expect(await balances()).toMatchObject({ Checking: 75_000, Savings: 500_000 });
		expect(await rows(checking)).toMatchObject([{ categoryId: readyToAssignId, transfer: null }]);
		expect(await rows(savings)).toEqual([]);
	});

	test('an ordinary Transaction can become a Transfer', async () => {
		const { owner, checking, savings, balances, rows } = await budgetWithThreeAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...toSavings });

		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: checking,
			transferAccountId: savings,
			...toSavings
		});

		expect(await balances()).toMatchObject({ Checking: 75_000, Savings: 525_000 });
		expect(await rows(savings)).toMatchObject([
			{ amount: 25_000, transfer: { accountId: checking } }
		]);
	});
});
