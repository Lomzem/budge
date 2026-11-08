import type { FunctionReturnType } from 'convex/server';
import { assert, describe, expect, onTestFinished, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { PAYEE_RENAME_BATCH } from './lib/search';
import { publicErrorCode, startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budget() {
	const backend = await startBudget({
		accounts: { Checking: ['cash', 100_000], Savings: ['cash', 0] },
		groups: { Everyday: ['Groceries', 'Household'] }
	});
	const { owner } = backend;
	const { Checking: checking, Savings: savings } = backend.accounts;
	const { Groceries: groceries, Household: household } = backend.categories;
	const add = (fields: {
		accountId?: Id<'accounts'>;
		date?: string;
		amount?: number;
		payee?: string;
		categoryId?: Id<'categories'>;
		memo?: string;
		splits?: { categoryId: Id<'categories'>; amount: number; memo: string }[];
	}) =>
		owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-10',
			amount: -1_000,
			payee: '',
			memo: '',
			...fields
		});
	type Filters = Omit<
		Parameters<typeof owner.query<typeof api.transactions.list>>[1],
		'paginationOpts'
	>;

	const find = async (filters: Filters) =>
		(
			await owner.query(api.transactions.list, {
				...filters,
				paginationOpts: { numItems: 200, cursor: null }
			})
		).page.map((row) => row._id);
	return { ...backend, checking, savings, groceries, household, add, find };
}

describe('text search', () => {
	test('finds a Transaction by its Payee, memo, or a split memo', async () => {
		const { add, find, groceries, household } = await budget();
		const lantern = await add({ payee: 'Lantern Grocer', memo: 'weekly basket' });
		const split = await add({
			payee: 'Corner Market',
			amount: -3_000,
			splits: [
				{ categoryId: groceries, amount: -2_000, memo: 'quinoa' },
				{ categoryId: household, amount: -1_000, memo: 'lightbulbs' }
			]
		});

		expect(await find({ search: 'lantern' })).toEqual([lantern]);
		expect(await find({ search: 'basket' })).toEqual([lantern]);
		expect(await find({ search: 'lightbulbs' })).toEqual([split]);
		expect(await find({ search: 'corner' })).toEqual([split]);
		expect(await find({ search: 'zeppelin' })).toEqual([]);
	});

	test('follows edits to the Payee, memo, and split lines', async () => {
		const { owner, add, find, checking, groceries, household } = await budget();
		const id = await add({ payee: 'Lantern Grocer', memo: 'weekly basket' });

		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: checking,
			date: '2026-08-10',
			amount: -3_000,
			payee: 'Harbor Bakery',
			memo: '',
			splits: [
				{ categoryId: groceries, amount: -2_000, memo: 'sourdough' },
				{ categoryId: household, amount: -1_000, memo: '' }
			]
		});

		expect(await find({ search: 'lantern' })).toEqual([]);
		expect(await find({ search: 'basket' })).toEqual([]);
		expect(await find({ search: 'harbor' })).toEqual([id]);
		expect(await find({ search: 'sourdough' })).toEqual([id]);
	});

	test("finds a matched Transaction by its Bank Text, until it's Unmatched", async () => {
		const { owner, add, find, checking } = await budget();
		const entered = await add({ payee: 'Morning Coffee', date: '2026-08-16', amount: -450 });
		await owner.mutation(api.imports.commit, {
			accountId: checking,
			source: 'csv',
			rows: [{ date: '2026-08-16', amount: -450, bankText: 'SAMPLE ROASTERY 0042' }]
		});
		expect(await find({ search: 'roastery' })).toEqual([entered]);

		const [row] = (
			await owner.query(api.transactions.list, {
				search: 'roastery',
				paginationOpts: { numItems: 10, cursor: null }
			})
		).page;
		const bankRow = row?.bankRows[0];
		assert(bankRow !== undefined, 'expected a Bank Row');
		const own = await owner.mutation(api.imports.unmatch, { importId: bankRow._id });

		expect(await find({ search: 'roastery' })).toEqual([own]);
		expect(await find({ search: 'morning' })).toEqual([entered]);
	});

	test('finds an imported Transaction by its Bank Text', async () => {
		const { owner, find, checking } = await budget();
		await owner.mutation(api.imports.commit, {
			accountId: checking,
			source: 'csv',
			rows: [{ date: '2026-08-12', amount: -1_240, bankText: 'SAMPLE BOOKSHOP 0193' }]
		});
		expect(await find({ search: 'bookshop' })).toHaveLength(1);
	});

	test("finds a renamed Payee's Transactions by the new name only", async () => {
		const { owner, add, find } = await budget();
		const first = await add({ payee: 'Lantern Grocer' });
		const second = await add({ payee: 'Lantern Grocer', date: '2026-08-11' });
		const payee = (await owner.query(api.payees.list, {})).find((p) => p.name === 'Lantern Grocer');
		assert(payee !== undefined, 'expected the Payee');

		await owner.mutation(api.payees.rename, { payeeId: payee._id, name: 'Beacon Grocer' });

		expect(await find({ search: 'beacon' })).toEqual(expect.arrayContaining([first, second]));
		expect(await find({ search: 'beacon' })).toHaveLength(2);
		expect(await find({ search: 'lantern' })).toEqual([]);
	});

	test('a rename reaches every Transaction of a Payee with many, in batches', async () => {
		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
		});
		const { t, owner, add, find, checking } = await budget();
		await add({ payee: 'Lantern Grocer' });
		const payee = (await owner.query(api.payees.list, {})).find((p) => p.name === 'Lantern Grocer');
		assert(payee !== undefined, 'expected the Payee');
		await t.run(async (ctx) => {
			for (let i = 0; i < PAYEE_RENAME_BATCH * 2; i++) {
				await ctx.db.insert('transactions', {
					accountId: checking,
					date: '2026-08-12',
					amount: -100,
					payeeId: payee._id,
					cleared: 'uncleared',
					approved: true,
					searchText: 'Lantern Grocer'
				});
			}
		});

		await owner.mutation(api.payees.rename, { payeeId: payee._id, name: 'Beacon Grocer' });
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		expect(await find({ search: 'lantern' })).toEqual([]);
		expect(await find({ search: 'beacon' })).toHaveLength(PAYEE_RENAME_BATCH * 2 + 1);
	});

	test("renaming a Payee to another Payee's name, or blank, is refused", async () => {
		const { owner, add } = await budget();
		await add({ payee: 'Lantern Grocer' });
		await add({ payee: 'Harbor Bakery' });
		const payee = (await owner.query(api.payees.list, {})).find((p) => p.name === 'Lantern Grocer');
		assert(payee !== undefined, 'expected the Payee');

		for (const name of ['Harbor Bakery', '  ']) {
			expect(
				await publicErrorCode(owner.mutation(api.payees.rename, { payeeId: payee._id, name }))
			).toBe('INVALID_INPUT');
		}
	});

	test('the backfill gives Transactions written before search their searchText', async () => {
		vi.useFakeTimers();
		onTestFinished(() => {
			vi.useRealTimers();
		});
		const { t, find, checking } = await budget();
		await t.run(async (ctx) => {
			const payeeId = await ctx.db.insert('payees', { name: 'Lantern Grocer' });
			const id = await ctx.db.insert('transactions', {
				accountId: checking,
				date: '2026-08-12',
				amount: -100,
				payeeId,
				memo: 'weekly basket',
				cleared: 'uncleared',
				approved: true
			});
			await ctx.db.insert('imports', {
				source: 'csv',
				accountId: checking,
				date: '2026-08-12',
				amount: -100,
				bankText: 'SAMPLE GROCER 7781',
				transactionId: id,
				matched: false,
				state: 'linked'
			});
		});
		expect(await find({ search: 'lantern' })).toEqual([]);

		await t.mutation(internal.migrations.backfillSearchText, { cursor: null });
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		for (const word of ['lantern', 'basket', 'grocer']) {
			expect(await find({ search: word })).toHaveLength(1);
		}
	});
});

describe('filters', () => {
	async function filtered() {
		const b = await budget();
		const { add, savings, groceries, household } = b;
		const ids = {
			early: await add({ payee: 'Lantern Grocer', date: '2026-08-05', categoryId: groceries }),
			late: await add({ payee: 'Lantern Grocer', date: '2026-08-25', categoryId: groceries }),
			savings: await add({
				accountId: savings,
				payee: 'Lantern Grocer',
				date: '2026-08-15',
				categoryId: household
			}),
			bakery: await add({ payee: 'Harbor Bakery', date: '2026-08-15', categoryId: household }),
			split: await add({
				payee: 'Harbor Bakery',
				date: '2026-08-20',
				amount: -3_000,
				splits: [
					{ categoryId: groceries, amount: -2_000, memo: 'bread' },
					{ categoryId: household, amount: -1_000, memo: 'napkins' }
				]
			})
		};
		const payees = await b.owner.query(api.payees.list, {});
		const payeeId = (name: string) => {
			const payee = payees.find((p) => p.name === name);
			assert(payee !== undefined, `expected ${name}`);
			return payee._id;
		};
		return { ...b, ids, lantern: payeeId('Lantern Grocer'), bakery: payeeId('Harbor Bakery') };
	}

	test('narrow the list by Account, Payee, and date range, newest first', async () => {
		const { find, ids, checking, savings, lantern } = await filtered();

		expect(await find({ payeeId: lantern })).toEqual([ids.late, ids.savings, ids.early]);
		expect(await find({ payeeId: lantern, accountId: checking })).toEqual([ids.late, ids.early]);
		expect(await find({ accountId: savings, from: '2026-08-02' })).toEqual([ids.savings]);
		expect(await find({ from: '2026-08-10', to: '2026-08-20' })).toEqual([
			ids.split,
			ids.bakery,
			ids.savings
		]);
		expect(await find({ payeeId: lantern, to: '2026-08-10' })).toEqual([ids.early]);
	});

	test('a Category takes whole Transactions; split ones with a line in it come apart', async () => {
		const { find, ids, groceries, checking } = await filtered();

		expect(await find({ categoryId: groceries })).toEqual([ids.late, ids.early]);
		expect(await find({ categoryId: groceries, splitLines: true })).toEqual([ids.split]);
		expect(await find({ categoryId: groceries, accountId: checking, to: '2026-08-10' })).toEqual([
			ids.early
		]);
		expect(await find({ categoryId: groceries, splitLines: true, from: '2026-08-21' })).toEqual([]);
	});

	test('a split with two lines in the Category is listed once, even across pages', async () => {
		const { owner, add, groceries, household } = await budget();
		const split = await add({
			amount: -3_000,
			splits: [
				{ categoryId: groceries, amount: -1_000, memo: 'bread' },
				{ categoryId: household, amount: -1_000, memo: 'soap' },
				{ categoryId: groceries, amount: -1_000, memo: 'apples' }
			]
		});
		const listed = [];
		let cursor: string | null = null;
		for (;;) {
			const result: FunctionReturnType<typeof api.transactions.list> = await owner.query(
				api.transactions.list,
				{
					categoryId: groceries,
					splitLines: true,
					paginationOpts: { numItems: 1, cursor }
				}
			);
			listed.push(...result.page.map((row) => row._id));
			if (result.isDone) break;
			cursor = result.continueCursor;
		}
		expect(listed).toEqual([split]);
	});

	test('a search keeps whole words in any script, and one of only punctuation finds nothing', async () => {
		const { add, find } = await budget();
		const book = await add({ payee: 'किताब घर' });
		await add({ payee: 'कप' });

		expect(await find({ search: 'किताब' })).toEqual([book]);
		expect(await find({ search: '***' })).toEqual([]);
	});

	test('narrow a search, with the date range applied after it', async () => {
		const { find, ids, groceries, household, checking, lantern } = await filtered();

		expect(await find({ search: 'lantern', accountId: checking })).toEqual(
			expect.arrayContaining([ids.early, ids.late])
		);
		expect(await find({ search: 'lantern', accountId: checking })).toHaveLength(2);
		expect(await find({ search: 'lantern', categoryId: household })).toEqual([ids.savings]);
		expect(await find({ search: 'harbor', payeeId: lantern })).toEqual([]);
		expect(await find({ search: 'lantern', from: '2026-08-20' })).toEqual([ids.late]);
		expect(await find({ search: 'bread', categoryId: groceries, splitLines: true })).toEqual([
			ids.split
		]);
		expect(await find({ search: 'bread', categoryId: groceries })).toEqual([]);
		expect(await find({ search: 'napkins', categoryId: groceries, splitLines: true })).toEqual([
			ids.split
		]);
	});

	test('split lines need a Category, and Unapproved first takes no filter', async () => {
		const { owner, groceries } = await filtered();
		const paginationOpts = { numItems: 10, cursor: null };
		expect(
			await publicErrorCode(
				owner.query(api.transactions.list, { splitLines: true, paginationOpts })
			)
		).toBe('INVALID_INPUT');
		expect(
			await publicErrorCode(
				owner.query(api.transactions.list, {
					approval: 'unapproved',
					categoryId: groceries,
					paginationOpts
				})
			)
		).toBe('INVALID_INPUT');
	});
});
