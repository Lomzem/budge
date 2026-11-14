import type { FunctionReturnType } from 'convex/server';
import { assert, describe, expect, test } from 'vitest';

import { BULK_CATEGORIZE_LIMIT } from '../src/lib/domain/bulkCategorize';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { publicErrorCode, startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithTwoAccounts() {
	const backend = await startBudget({
		accounts: { Checking: ['cash', 100_000], Card: ['creditCard', 0] },
		groups: { Everyday: ['Groceries', 'Dining'] }
	});
	const { owner } = backend;
	const { Checking: checking, Card: card } = backend.accounts;
	const balanceOf = async (accountId: Id<'accounts'>) =>
		(await owner.query(api.accounts.list, {})).find((account) => account._id === accountId)
			?.balance;
	const page = async (accountId?: Id<'accounts'>) =>
		(
			await owner.query(api.transactions.list, {
				...(accountId === undefined ? {} : { accountId }),
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page;
	return { ...backend, checking, card, balanceOf, page };
}

const groceries = {
	date: '2026-08-14',
	amount: -4_250,
	payee: 'Corner Grocer',
	memo: 'Weekly shop'
};

describe('entering a Transaction by hand', () => {
	test('changes the Account balance and starts uncleared', async () => {
		const { owner, checking, balanceOf, page } = await budgetWithTwoAccounts();

		await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		expect(await balanceOf(checking)).toBe(95_750);
		expect((await page(checking))[0]).toMatchObject({
			date: '2026-08-14',
			amount: -4_250,
			payeeName: 'Corner Grocer',
			memo: 'Weekly shop',
			cleared: false
		});
	});

	test('may leave the Payee and memo blank', async () => {
		const { owner, checking, page } = await budgetWithTwoAccounts();

		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			payee: ' ',
			memo: ''
		});

		expect((await page(checking))[0]).toMatchObject({ payeeName: null, memo: null });
	});

	test('creates a Payee on first use and reuses it after', async () => {
		const { t, owner, checking, card } = await budgetWithTwoAccounts();

		await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });
		await owner.mutation(api.transactions.create, {
			accountId: card,
			...groceries,
			payee: ' Corner Grocer '
		});

		const payees = await t.run((ctx) =>
			ctx.db
				.query('payees')
				.withIndex('by_name', (q) => q.eq('name', 'Corner Grocer'))
				.collect()
		);
		expect(payees).toHaveLength(1);
	});

	test.each([
		['a date before the cutover date', { date: '2026-07-31' }],
		['a date that does not exist', { date: '2026-09-31' }],
		['a fractional amount', { amount: -42.5 }],
		['an amount over $10 billion', { amount: -1_000_000_000_001 }]
	])('refuses %s', async (_, change) => {
		const { owner, checking } = await budgetWithTwoAccounts();

		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.create, { accountId: checking, ...groceries, ...change })
			)
		).toBe('INVALID_INPUT');
	});
});

describe('changing a Transaction', () => {
	test('moving it to another Account moves its amount between balances', async () => {
		const { owner, checking, card, balanceOf } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: card,
			...groceries,
			amount: -5_000
		});

		expect(await balanceOf(checking)).toBe(100_000);
		expect(await balanceOf(card)).toBe(-5_000);
	});

	test('deleting it takes its amount out of the balance', async () => {
		const { owner, checking, balanceOf, page } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		await owner.mutation(api.transactions.remove, { transactionId: id });

		expect(await balanceOf(checking)).toBe(100_000);
		expect((await page(checking)).map((row) => row.payeeName)).toEqual(['Starting Balance']);
	});

	test('can be toggled Cleared and back', async () => {
		const { owner, checking, page } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });

		await owner.mutation(api.transactions.setCleared, { transactionId: id, cleared: true });
		expect((await page(checking))[0]?.cleared).toBe(true);

		await owner.mutation(api.transactions.setCleared, { transactionId: id, cleared: false });
		expect((await page(checking))[0]?.cleared).toBe(false);
	});

	test('editing keeps whether it is Cleared', async () => {
		const { owner, checking, page } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });
		await owner.mutation(api.transactions.setCleared, { transactionId: id, cleared: true });

		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: checking,
			...groceries,
			memo: 'Bigger shop'
		});

		expect((await page(checking))[0]).toMatchObject({ memo: 'Bigger shop', cleared: true });
	});

	test('a deleted Transaction is NOT_FOUND', async () => {
		const { owner, checking } = await budgetWithTwoAccounts();
		const id = await owner.mutation(api.transactions.create, { accountId: checking, ...groceries });
		await owner.mutation(api.transactions.remove, { transactionId: id });

		expect(
			await publicErrorCode(owner.mutation(api.transactions.remove, { transactionId: id }))
		).toBe('NOT_FOUND');
	});
});

describe('categorizing a Transaction in place', () => {
	async function unapprovedClearedGroceries() {
		const budget = await budgetWithTwoAccounts();
		const { owner, checking } = budget;
		const transactionId = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries
		});
		await owner.mutation(api.transactions.setCleared, { transactionId, cleared: true });
		await owner.mutation(api.transactions.unapprove, { transactionIds: [transactionId] });
		return { ...budget, transactionId };
	}

	test('changes only its Category and leaves it Unapproved', async () => {
		const { owner, checking, categories, transactionId, page } = await unapprovedClearedGroceries();
		const untouched = {
			date: '2026-08-14',
			amount: -4_250,
			payeeName: 'Corner Grocer',
			memo: 'Weekly shop',
			cleared: true,
			approved: false
		};

		await owner.mutation(api.transactions.categorize, {
			transactionId,
			choice: { kind: 'category', categoryId: categories.Groceries }
		});
		expect((await page(checking))[0]).toMatchObject({
			...untouched,
			categoryId: categories.Groceries
		});

		await owner.mutation(api.transactions.categorize, {
			transactionId,
			choice: { kind: 'uncategorized' }
		});
		expect((await page(checking))[0]).toMatchObject({ ...untouched, categoryId: null });
	});

	test('a Transfer choice pays the card from the Cash Account', async () => {
		const { owner, checking, card, transactionId, balanceOf, page } =
			await unapprovedClearedGroceries();

		await owner.mutation(api.transactions.categorize, {
			transactionId,
			choice: { kind: 'transfer', accountId: card }
		});

		expect(await balanceOf(checking)).toBe(95_750);
		expect(await balanceOf(card)).toBe(4_250);
		expect((await page(checking))[0]).toMatchObject({
			payeeName: null,
			categoryId: null,
			transfer: { accountId: card },
			approved: false
		});
	});

	test('refuses a split Transaction, a Transfer for a starting balance, and remembering a Category for no Payee', async () => {
		const { owner, checking, card, categories, page } = await budgetWithTwoAccounts();
		const splitId = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			splits: [
				{ categoryId: categories.Groceries, amount: -3_000, memo: '' },
				{ categoryId: categories.Dining, amount: -1_250, memo: '' }
			]
		});
		const startingBalance = (await page(checking)).find((row) => row.startingBalance);
		assert(startingBalance, 'the Account has a starting balance');
		const payeeless = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			payee: ''
		});

		for (const refused of [
			{ transactionId: splitId, choice: { kind: 'category', categoryId: categories.Dining } },
			{ transactionId: startingBalance._id, choice: { kind: 'transfer', accountId: card } },
			{
				transactionId: payeeless,
				choice: { kind: 'category', categoryId: categories.Dining, remember: true }
			}
		] as const) {
			expect(await publicErrorCode(owner.mutation(api.transactions.categorize, refused))).toBe(
				'INVALID_INPUT'
			);
		}
	});
});

describe('categorizing several Transactions at once', () => {
	async function unapprovedRows(rows: { payee: string; category?: 'Groceries' | 'Dining' }[]) {
		const budget = await budgetWithTwoAccounts();
		const { owner, checking, categories } = budget;
		const ids: Id<'transactions'>[] = [];
		for (const [i, { payee, category }] of rows.entries()) {
			ids.push(
				await owner.mutation(api.transactions.create, {
					accountId: checking,
					...groceries,
					date: `2026-08-${String(10 + i)}`,
					payee,
					...(category === undefined ? {} : { categoryId: categories[category] })
				})
			);
		}
		await owner.mutation(api.transactions.unapprove, { transactionIds: ids });
		const rowOf = async (id: Id<'transactions'>) => {
			const row = (await budget.page(checking)).find((each) => each._id === id);
			assert(row !== undefined, 'the row is listed');
			return row;
		};
		const state = async (id: Id<'transactions'>) => {
			const { categoryId, approved, rememberedCategoryId } = await rowOf(id);
			return { categoryId, approved, rememberedCategoryId };
		};
		return { ...budget, ids, rowOf, state };
	}

	test('gives exactly the chosen Transactions the Category, approves them only when asked, and leaves remembered Categories alone', async () => {
		const { owner, categories, ids, state } = await unapprovedRows([
			{ payee: 'Sample Noodle Bar', category: 'Dining' },
			{ payee: 'Sample Noodle Bar' },
			{ payee: 'Sample Corner Shop' },
			{ payee: 'Sample Noodle Bar' }
		]);
		const [first, second, third, fourth] = ids;
		assert(first && second && third && fourth, 'four rows');
		await owner.mutation(api.transactions.categorize, {
			transactionId: first,
			choice: { kind: 'category', categoryId: categories.Dining, remember: true }
		});

		await owner.mutation(api.transactions.categorizeMany, {
			transactionIds: [first, third],
			categoryId: categories.Groceries,
			approve: false
		});

		const noodles = { rememberedCategoryId: categories.Dining };
		const corner = { rememberedCategoryId: null };
		expect(await state(first)).toEqual({
			categoryId: categories.Groceries,
			approved: false,
			...noodles
		});
		expect(await state(second)).toEqual({ categoryId: null, approved: false, ...noodles });
		expect(await state(third)).toEqual({
			categoryId: categories.Groceries,
			approved: false,
			...corner
		});
		expect(await state(fourth)).toEqual({ categoryId: null, approved: false, ...noodles });

		await owner.mutation(api.transactions.categorizeMany, {
			transactionIds: [second, fourth],
			categoryId: null,
			approve: true
		});

		expect(await state(second)).toEqual({ categoryId: null, approved: true, ...noodles });
		expect(await state(fourth)).toEqual({ categoryId: null, approved: true, ...noodles });
		expect(await state(first)).toMatchObject({ approved: false });
	});

	test('Undo puts back each Category and approval it changed, but keeps a row changed since and a Category whose earlier one was deleted', async () => {
		const { owner, card, categories, groups, ids, state, balanceOf } = await unapprovedRows([
			{ payee: 'Sample Noodle Bar', category: 'Dining' },
			{ payee: 'Sample Bakery', category: 'Groceries' },
			{ payee: 'Sample Pharmacy', category: 'Groceries' },
			{ payee: 'Sample Corner Shop' },
			{ payee: 'Sample Florist' }
		]);
		const [plain, recategorized, transferred, alreadyApproved, losesItsCategory] = ids;
		assert(
			plain && recategorized && transferred && alreadyApproved && losesItsCategory,
			'five rows'
		);
		const flowers = await owner.mutation(api.categories.create, {
			groupId: groups.Everyday,
			name: 'Sample Flowers'
		});
		await owner.mutation(api.transactions.categorize, {
			transactionId: losesItsCategory,
			choice: { kind: 'category', categoryId: flowers }
		});
		await owner.mutation(api.transactions.categorize, {
			transactionId: plain,
			choice: { kind: 'category', categoryId: categories.Groceries, remember: true }
		});
		await owner.mutation(api.transactions.categorize, {
			transactionId: plain,
			choice: { kind: 'category', categoryId: categories.Dining }
		});
		await owner.mutation(api.transactions.approve, { transactionId: alreadyApproved });

		const applied = await owner.mutation(api.transactions.categorizeMany, {
			transactionIds: ids,
			categoryId: null,
			approve: true
		});
		await owner.mutation(api.transactions.categorize, {
			transactionId: recategorized,
			choice: { kind: 'category', categoryId: categories.Dining }
		});
		await owner.mutation(api.transactions.categorize, {
			transactionId: transferred,
			choice: { kind: 'transfer', accountId: card }
		});
		await owner.mutation(api.categories.remove, {
			categoryId: flowers,
			destinationId: categories.Groceries
		});

		expect(await owner.mutation(api.transactions.undoCategorizeMany, applied)).toEqual({
			restored: 3,
			kept: 1
		});

		expect(await state(plain)).toEqual({
			categoryId: categories.Dining,
			approved: false,
			rememberedCategoryId: categories.Groceries
		});
		expect(await state(recategorized)).toMatchObject({
			categoryId: categories.Dining,
			approved: false
		});
		expect(await state(transferred)).toMatchObject({ categoryId: null, approved: false });
		expect(await balanceOf(card)).toBe(4_250);
		expect(await state(alreadyApproved)).toMatchObject({ categoryId: null, approved: true });
		expect(await state(losesItsCategory)).toMatchObject({ categoryId: null, approved: false });
	});

	test('refuses a split, a Transfer, a missing Transaction or too many at once, and changes none of the rest', async () => {
		const { owner, checking, card, categories, ids, state } = await unapprovedRows([
			{ payee: 'Sample Corner Shop' }
		]);
		const [plain] = ids;
		assert(plain, 'one row');
		const split = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			splits: [
				{ categoryId: categories.Groceries, amount: -3_000, memo: '' },
				{ categoryId: categories.Dining, amount: -1_250, memo: '' }
			]
		});
		const transfer = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			payee: '',
			transferAccountId: card
		});
		const removed = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries
		});
		await owner.mutation(api.transactions.remove, { transactionId: removed });
		const categorizeWith = (other: Id<'transactions'>) =>
			owner.mutation(api.transactions.categorizeMany, {
				transactionIds: [plain, other],
				categoryId: categories.Dining,
				approve: true
			});

		expect(await publicErrorCode(categorizeWith(split))).toBe('INVALID_INPUT');
		expect(await publicErrorCode(categorizeWith(transfer))).toBe('INVALID_INPUT');
		expect(await publicErrorCode(categorizeWith(removed))).toBe('NOT_FOUND');
		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.categorizeMany, {
					transactionIds: Array.from({ length: BULK_CATEGORIZE_LIMIT + 1 }, () => plain),
					categoryId: categories.Dining,
					approve: true
				})
			)
		).toBe('INVALID_INPUT');
		expect(await state(plain)).toMatchObject({ categoryId: null, approved: false });
	});
});

describe('the Transaction list', () => {
	test('All Accounts shows every Account newest first, named', async () => {
		const { owner, checking, card, page } = await budgetWithTwoAccounts();
		await owner.mutation(api.transactions.create, { accountId: card, ...groceries });
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...groceries,
			date: '2026-09-02',
			payee: 'Bus Pass Co'
		});

		expect((await page()).map((row) => [row.date, row.accountName, row.payeeName])).toEqual([
			['2026-09-02', 'Checking', 'Bus Pass Co'],
			['2026-08-14', 'Card', 'Corner Grocer'],
			['2026-08-01', 'Card', 'Starting Balance'],
			['2026-08-01', 'Checking', 'Starting Balance']
		]);
	});

	test('pages through an Account without repeats or gaps', async () => {
		const { owner, checking } = await budgetWithTwoAccounts();
		for (let day = 10; day < 17; day++) {
			await owner.mutation(api.transactions.create, {
				accountId: checking,
				...groceries,
				date: `2026-08-${String(day)}`
			});
		}

		const dates: string[] = [];
		let cursor: string | null = null;
		for (;;) {
			const result: FunctionReturnType<typeof api.transactions.list> = await owner.query(
				api.transactions.list,
				{
					accountId: checking,
					paginationOpts: { numItems: 3, cursor }
				}
			);
			dates.push(...result.page.map((row) => row.date));
			if (result.isDone) break;
			cursor = result.continueCursor;
		}

		expect(dates).toEqual([
			'2026-08-16',
			'2026-08-15',
			'2026-08-14',
			'2026-08-13',
			'2026-08-12',
			'2026-08-11',
			'2026-08-10',
			'2026-08-01'
		]);
	});
});

describe('moving the cutover date', () => {
	test('cannot leave a Transaction before it', async () => {
		const { owner } = await budgetWithTwoAccounts();

		expect(
			await publicErrorCode(
				owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-02' })
			)
		).toBe('INVALID_INPUT');
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-07-01' });
		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: '2026-07-01' });
	});
});
