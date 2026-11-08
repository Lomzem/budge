import { assert, describe, expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
	makeLegacyStartingBalance,
	newBackend,
	publicErrorCode,
	startBudget,
	useOwnerEnv
} from './test.helper';

useOwnerEnv();

describe('creating an Account', () => {
	test('lists it with its starting balance', async () => {
		const { owner } = await startBudget();

		await owner.mutation(api.accounts.create, {
			name: 'Checking',
			kind: 'cash',
			startingBalance: 250_000
		});
		await owner.mutation(api.accounts.create, {
			name: 'Card',
			kind: 'creditCard',
			startingBalance: -45_000
		});

		expect(await owner.query(api.accounts.list, {})).toMatchObject([
			{ name: 'Checking', kind: 'cash', balance: 250_000 },
			{ name: 'Card', kind: 'creditCard', balance: -45_000 }
		]);
	});

	test('records the starting balance as a Cleared Transaction on the cutover date', async () => {
		const { owner } = await startBudget();

		const accountId = await owner.mutation(api.accounts.create, {
			name: 'Checking',
			kind: 'cash',
			startingBalance: 250_000
		});

		const { page } = await owner.query(api.transactions.list, {
			accountId,
			paginationOpts: { numItems: 10, cursor: null }
		});
		expect(page).toMatchObject([
			{ date: '2026-08-01', amount: 250_000, payeeName: 'Starting Balance', cleared: true }
		]);
	});

	test('needs the cutover date first', async () => {
		const { owner } = newBackend();

		expect(
			await publicErrorCode(
				owner.mutation(api.accounts.create, { name: 'Checking', kind: 'cash', startingBalance: 0 })
			)
		).toBe('INVALID_INPUT');
	});

	test.each([
		['a blank name', { name: '  ', startingBalance: 0 }],
		['a fractional starting balance', { name: 'Checking', startingBalance: 10.5 }]
	])('rejects %s', async (_, args) => {
		const { owner } = await startBudget();

		expect(
			await publicErrorCode(owner.mutation(api.accounts.create, { kind: 'cash', ...args }))
		).toBe('INVALID_INPUT');
	});
});

describe('renaming and reordering Accounts', () => {
	test('changes how the sidebar reads', async () => {
		const { owner } = await startBudget();
		const create = (name: string) =>
			owner.mutation(api.accounts.create, { name, kind: 'cash', startingBalance: 0 });
		const checking = await create('Checking');
		const savings = await create('Savings');
		const wallet = await create('Wallet');

		await owner.mutation(api.accounts.rename, { accountId: savings, name: ' Rainy Day ' });
		await owner.mutation(api.accounts.reorder, { accountIds: [wallet, checking, savings] });

		const names = (await owner.query(api.accounts.list, {})).map((account) => account.name);
		expect(names).toEqual(['Wallet', 'Checking', 'Rainy Day']);
	});

	test('reordering must name every Account once', async () => {
		const { owner } = await startBudget();
		const create = (name: string) =>
			owner.mutation(api.accounts.create, { name, kind: 'cash', startingBalance: 0 });
		const checking = await create('Checking');
		await create('Savings');

		expect(
			await publicErrorCode(owner.mutation(api.accounts.reorder, { accountIds: [checking] }))
		).toBe('INVALID_INPUT');
		expect(
			await publicErrorCode(
				owner.mutation(api.accounts.reorder, { accountIds: [checking, checking] })
			)
		).toBe('INVALID_INPUT');
	});
});

describe("changing an Account's starting balance", () => {
	async function checkingWithStartingBalance() {
		const backend = await startBudget({
			accounts: { Checking: ['cash', 250_000] },
			groups: { Everyday: ['Groceries'] }
		});
		const { Checking: accountId } = backend.accounts;
		const { Groceries: groceries } = backend.categories;
		const rows = async () =>
			(
				await backend.owner.query(api.transactions.list, {
					accountId,
					paginationOpts: { numItems: 10, cursor: null }
				})
			).page;
		const startingBalances = async () =>
			(await rows()).filter((row) => row.payeeName === 'Starting Balance');
		const startingBalance = async () => {
			const [only, ...others] = await startingBalances();
			assert(only !== undefined && others.length === 0, 'expected one starting balance');
			return only;
		};
		const balance = async () =>
			(await backend.owner.query(api.accounts.list, {})).find(
				(account) => account._id === accountId
			)?.balance;
		const totals = () =>
			backend.t.run(async (ctx) =>
				(await ctx.db.query('monthlyTotals').collect())
					.map(({ month, accountId, bucket, amount, count }) => ({
						month,
						accountId,
						bucket,
						amount,
						count
					}))
					.sort((a, b) =>
						`${a.month}${a.accountId}${a.bucket}`.localeCompare(
							`${b.month}${b.accountId}${b.bucket}`
						)
					)
			);
		const expectTotalsRebuild = async () => {
			const kept = await totals();
			await backend.t.mutation(internal.monthlyTotals.rebuild, {});
			expect(await totals()).toEqual(kept);
		};
		const matchToAFileRow = async (existing: {
			_id: Id<'transactions'>;
			date: string;
			amount: number;
		}) => {
			await backend.owner.mutation(api.transactions.setCleared, {
				transactionId: existing._id,
				cleared: false
			});
			await backend.owner.mutation(api.imports.commit, {
				accountId,
				source: 'csv',
				rows: [{ date: existing.date, amount: existing.amount, bankText: 'OPENING DEPOSIT' }]
			});
		};
		return {
			...backend,
			accountId,
			groceries,
			rows,
			startingBalances,
			startingBalance,
			balance,
			expectTotalsRebuild,
			matchToAFileRow
		};
	}

	test('reads back as it now stands, and as none once deleted', async () => {
		const { owner, accountId, startingBalance } = await checkingWithStartingBalance();
		const current = () => owner.query(api.accounts.startingBalance, { accountId });

		expect(await current()).toBe(250_000);

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });
		expect(await current()).toBe(180_000);

		const existing = await startingBalance();
		await owner.mutation(api.transactions.remove, { transactionId: existing._id });
		expect(await current()).toBeNull();
	});

	test('takes edits to its amount, date, Category, memo, cleared and approved, and stays the starting balance', async () => {
		const { owner, accountId, groceries, startingBalance, balance } =
			await checkingWithStartingBalance();
		const existing = await startingBalance();

		for (const payee of ['Starting Balance', '']) {
			await owner.mutation(api.transactions.update, {
				transactionId: existing._id,
				accountId,
				date: '2026-08-03',
				amount: 260_000,
				payee,
				categoryId: groceries,
				memo: 'Opening'
			});
		}
		await owner.mutation(api.transactions.setCleared, {
			transactionId: existing._id,
			cleared: false
		});

		expect(await startingBalance()).toMatchObject({
			_id: existing._id,
			payeeName: 'Starting Balance',
			date: '2026-08-03',
			amount: 260_000,
			categoryId: groceries,
			memo: 'Opening',
			cleared: false,
			approved: true
		});
		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });
		expect(await startingBalance()).toMatchObject({
			_id: existing._id,
			date: '2026-08-01',
			amount: 180_000,
			categoryId: groceries
		});
		expect(await balance()).toBe(180_000);
	});

	test('is found by searching for its label', async () => {
		const { owner, startingBalance } = await checkingWithStartingBalance();
		const existing = await startingBalance();

		const { page } = await owner.query(api.transactions.list, {
			search: 'starting balance',
			paginationOpts: { numItems: 10, cursor: null }
		});

		expect(page.map((row) => row._id)).toEqual([existing._id]);
	});

	test.each([
		['a Payee', { payee: 'Opening' }],
		['another Account', { moveToSavings: true }],
		['split lines', { split: true }],
		['a Transfer', { transfer: true }]
	])('refuses giving it %s', async (_label, change) => {
		const { owner, accountId, groceries, startingBalance, balance, expectTotalsRebuild } =
			await checkingWithStartingBalance();
		const savingsId = await owner.mutation(api.accounts.create, {
			name: 'Savings',
			kind: 'cash',
			startingBalance: 0
		});
		const existing = await startingBalance();
		assert(existing.categoryId !== null, 'expected the starting balance in Ready to Assign');

		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.update, {
					transactionId: existing._id,
					accountId: 'moveToSavings' in change ? savingsId : accountId,
					date: existing.date,
					amount: existing.amount,
					payee: 'payee' in change ? change.payee : 'Starting Balance',
					memo: '',
					...('split' in change
						? {
								splits: [
									{ categoryId: existing.categoryId, amount: 200_000, memo: '' },
									{ categoryId: groceries, amount: 50_000, memo: 'Pantry' }
								]
							}
						: { categoryId: existing.categoryId }),
					...('transfer' in change ? { transferAccountId: savingsId } : {})
				})
			)
		).toBe('INVALID_INPUT');
		expect(await startingBalance()).toMatchObject({
			_id: existing._id,
			amount: 250_000,
			splits: null,
			transfer: null
		});
		expect(await balance()).toBe(250_000);
		await expectTotalsRebuild();
	});

	test('is never linked as the other side of a Transfer, even after a bank row matches it', async () => {
		const { owner, accountId, startingBalance, balance, matchToAFileRow } =
			await checkingWithStartingBalance();
		const savingsId = await owner.mutation(api.accounts.create, {
			name: 'Savings',
			kind: 'cash',
			startingBalance: 0
		});
		const existing = await startingBalance();
		await matchToAFileRow(existing);
		expect((await startingBalance()).bankRows).toMatchObject([{ matched: true }]);

		expect(
			await owner.query(api.transactions.transferCandidates, {
				transferAccountId: accountId,
				date: existing.date,
				amount: -existing.amount
			})
		).toEqual([]);
		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.create, {
					accountId: savingsId,
					date: existing.date,
					amount: -existing.amount,
					payee: '',
					memo: '',
					transferAccountId: accountId,
					transferTransactionId: existing._id
				})
			)
		).toBe('INVALID_INPUT');
		expect(await startingBalance()).toMatchObject({ _id: existing._id, transfer: null });
		expect(await balance()).toBe(250_000);
	});

	test('a Transaction cannot be created as a starting balance through the register', async () => {
		const { owner, accountId, startingBalances } = await checkingWithStartingBalance();

		await expect(
			owner.mutation(api.transactions.create, {
				accountId,
				date: '2026-08-02',
				amount: 1_000,
				payee: '',
				memo: '',
				kind: 'startingBalance'
			} as never)
		).rejects.toThrow(/kind/);
		expect(await startingBalances()).toHaveLength(1);
	});

	test('setting the starting balance never loses the lines of a split one from before kinds', async () => {
		const {
			t,
			owner,
			accountId,
			groceries,
			startingBalance,
			startingBalances,
			balance,
			expectTotalsRebuild
		} = await checkingWithStartingBalance();
		const existing = await startingBalance();
		assert(existing.categoryId !== null, 'expected the starting balance in Ready to Assign');
		await makeLegacyStartingBalance(t, accountId, [
			{ categoryId: existing.categoryId, amount: 200_000 },
			{ categoryId: groceries, amount: 50_000 }
		]);

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		expect(await startingBalances()).toMatchObject([
			{ amount: 180_000, splits: null },
			{
				_id: existing._id,
				amount: 250_000,
				splits: [
					{ categoryId: existing.categoryId, amount: 200_000 },
					{ categoryId: groceries, amount: 50_000 }
				]
			}
		]);
		expect(await balance()).toBe(430_000);
		await expectTotalsRebuild();
	});

	test('after the cutover date moves earlier, replaces the one starting balance on the new date', async () => {
		const { owner, accountId, startingBalances, balance } = await checkingWithStartingBalance();
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-07-01' });

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		expect(await startingBalances()).toMatchObject([{ date: '2026-07-01', amount: 180_000 }]);
		expect(await balance()).toBe(180_000);
	});

	test('after a file row matches the starting balance, still replaces that one starting balance', async () => {
		const { owner, accountId, startingBalance, matchToAFileRow } =
			await checkingWithStartingBalance();
		const existing = await startingBalance();
		await matchToAFileRow(existing);
		expect((await startingBalance()).bankRows).toMatchObject([
			{ bankText: 'OPENING DEPOSIT', matched: true }
		]);

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		expect(await startingBalance()).toMatchObject({ _id: existing._id, amount: 180_000 });
	});

	test('once deleted, setting the starting balance records a new one', async () => {
		const { owner, accountId, startingBalance, balance } = await checkingWithStartingBalance();
		const existing = await startingBalance();
		await owner.mutation(api.transactions.remove, { transactionId: existing._id });
		expect(await balance()).toBe(0);

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		expect(await startingBalance()).toMatchObject({ date: '2026-08-01', amount: 180_000 });
		expect(await balance()).toBe(180_000);
	});

	test('an imported row whose Bank Text reads Starting Balance is never taken for the starting balance', async () => {
		const { owner, accountId, rows, startingBalance, balance } =
			await checkingWithStartingBalance();
		const genuine = await startingBalance();
		await owner.mutation(api.imports.commit, {
			accountId,
			source: 'csv',
			rows: [{ date: '2026-08-02', amount: 5_000, bankText: 'Starting Balance' }]
		});
		const imported = (await rows()).find((row) => row.amount === 5_000);
		assert(imported !== undefined, 'expected the imported row');
		await owner.mutation(api.transactions.remove, { transactionId: genuine._id });

		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		const after = await rows();
		expect(after.find((row) => row._id === imported._id)).toMatchObject({
			amount: 5_000,
			date: '2026-08-02'
		});
		expect(after.filter((row) => row._id !== imported._id)).toMatchObject([
			{ amount: 180_000, date: '2026-08-01', payeeName: 'Starting Balance' }
		]);
		expect(await balance()).toBe(185_000);
	});

	test('a Transaction entered with the Payee Starting Balance is an ordinary one', async () => {
		const { owner, accountId, groceries, startingBalance, balance } =
			await checkingWithStartingBalance();
		const genuine = await startingBalance();
		const entered = {
			accountId,
			date: '2026-08-02',
			amount: -1_000,
			payee: 'Starting Balance',
			memo: ''
		};
		const transactionId = await owner.mutation(api.transactions.create, entered);

		await owner.mutation(api.transactions.update, {
			transactionId,
			...entered,
			splits: [
				{ categoryId: groceries, amount: -600, memo: '' },
				{ categoryId: groceries, amount: -400, memo: '' }
			]
		});
		await owner.mutation(api.accounts.setStartingBalance, { accountId, startingBalance: 180_000 });

		expect(await balance()).toBe(179_000);
		expect(
			(
				await owner.query(api.transactions.list, {
					accountId,
					paginationOpts: { numItems: 10, cursor: null }
				})
			).page.map(({ _id, amount }) => ({ _id, amount }))
		).toEqual([
			{ _id: transactionId, amount: -1_000 },
			{ _id: genuine._id, amount: 180_000 }
		]);
	});
});
