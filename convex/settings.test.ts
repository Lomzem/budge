import { assert, describe, expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id, TableNames } from './_generated/dataModel';
import { refreshDerivedFields } from './lib/transactions';
import schema from './schema';
import { newBackend, publicErrorCode, startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

describe('the cutover date', () => {
	test('is unset until the owner sets it', async () => {
		const { owner } = newBackend();

		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: null });

		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: '2026-08-01' });
	});

	test('must be a real date', async () => {
		const { owner } = newBackend();

		expect(
			await publicErrorCode(
				owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-02-30' })
			)
		).toBe('INVALID_INPUT');
	});
});

type Backend = ReturnType<typeof newBackend>['t'];

async function persisted(t: Backend) {
	return await t.run(async (ctx) => {
		const tables: Record<string, unknown[]> = {};
		for (const table of Object.keys(schema.tables) as TableNames[]) {
			tables[table] = await ctx.db.query(table).collect();
		}
		return tables;
	});
}

async function septemberBudget() {
	const budget = await startBudget({
		cutoverDate: '2026-09-01',
		accounts: { Checking: ['cash', 100_000], Card: ['creditCard', -20_000] },
		groups: { Everyday: ['Groceries', 'Dining'] }
	});
	const { owner, accounts, categories } = budget;
	const record = (fields: {
		accountId: Id<'accounts'>;
		date: string;
		amount: number;
		payee: string;
		categoryId?: Id<'categories'>;
		transferAccountId?: Id<'accounts'>;
		splits?: { categoryId: Id<'categories'>; amount: number; memo: string }[];
	}) => owner.mutation(api.transactions.create, { memo: '', ...fields });

	const groceries = await record({
		accountId: accounts.Checking,
		date: '2026-09-10',
		amount: -12_000,
		payee: 'Corner Grocer',
		categoryId: categories.Groceries
	});
	await owner.mutation(api.transactions.setCleared, { transactionId: groceries, cleared: true });
	await owner.mutation(api.imports.commit, {
		accountId: accounts.Checking,
		source: 'csv',
		rows: [{ date: '2026-10-05', amount: -4_500, bankText: 'SAMPLE COFFEE CART' }]
	});
	const { balance } = await owner.query(api.reconciliation.clearedBalance, {
		accountId: accounts.Checking
	});
	await owner.mutation(api.reconciliation.reconcile, {
		accountId: accounts.Checking,
		balance,
		date: '2026-10-06'
	});
	await record({
		accountId: accounts.Checking,
		date: '2026-10-15',
		amount: -10_000,
		payee: '',
		transferAccountId: accounts.Card
	});
	await record({
		accountId: accounts.Card,
		date: '2026-10-20',
		amount: -9_000,
		payee: 'Night Market',
		categoryId: categories.Dining
	});
	await record({
		accountId: accounts.Checking,
		date: '2026-10-25',
		amount: -8_000,
		payee: 'Big Box',
		splits: [
			{ categoryId: categories.Groceries, amount: -5_000, memo: '' },
			{ categoryId: categories.Dining, amount: -3_000, memo: '' }
		]
	});
	await record({
		accountId: accounts.Checking,
		date: '2026-11-05',
		amount: -3_000,
		payee: 'Corner Grocer',
		categoryId: categories.Groceries
	});
	const assign = (month: string, categoryId: Id<'categories'>, amount: number) =>
		owner.mutation(api.budget.setAssigned, { month, categoryId, amount });
	await assign('2026-09', categories.Groceries, 15_000);
	await assign('2026-10', categories.Dining, 10_000);
	await assign('2026-11', categories.Groceries, 5_000);
	return budget;
}

const today = '2026-11-13';

describe('previewing a later cutover date', () => {
	test('folds each Account’s earlier Transactions into a Starting Balance on the new date, shows the budget it leaves, and changes nothing', async () => {
		const { t, owner, categories } = await septemberBudget();
		const before = await persisted(t);

		const preview = await owner.query(api.settings.previewLaterCutover, {
			cutoverDate: '2026-11-01',
			today
		});

		assert(preview.kind === 'ready', `expected a ready preview, got ${preview.kind}`);
		expect(preview).toMatchObject({ from: '2026-09-01', to: '2026-11-01' });
		const folded = preview.accounts.map((account) => ({
			name: account.name,
			startingBalance: account.startingBalance,
			transactions: account.transactions.map((row) => [
				row.date,
				row.amount,
				row.fromBank ? 'bank' : 'by hand',
				row.cleared
			]),
			proposedStartingBalance: account.proposedStartingBalance
		}));
		expect(folded).toEqual([
			{
				name: 'Checking',
				startingBalance: { amount: 100_000, date: '2026-09-01', cleared: 'reconciled' },
				transactions: [
					['2026-09-10', -12_000, 'by hand', 'reconciled'],
					['2026-10-05', -4_500, 'bank', 'reconciled'],
					['2026-10-15', -10_000, 'by hand', 'uncleared'],
					['2026-10-25', -8_000, 'by hand', 'uncleared']
				],
				proposedStartingBalance: 65_500
			},
			{
				name: 'Card',
				startingBalance: { amount: -20_000, date: '2026-09-01', cleared: 'cleared' },
				transactions: [
					['2026-10-15', 10_000, 'by hand', 'uncleared'],
					['2026-10-20', -9_000, 'by hand', 'uncleared']
				],
				proposedStartingBalance: -19_000
			}
		]);
		expect(preview.cautions).toEqual(
			expect.arrayContaining([
				{ kind: 'reconciled', accountName: 'Checking', count: 2, total: -16_500 },
				{ kind: 'uncleared', accountName: 'Checking', count: 2, total: -18_000 },
				{ kind: 'uncleared', accountName: 'Card', count: 2, total: 1_000 }
			])
		);
		expect(preview.cautions).toHaveLength(3);
		const { categories: changed, ...budget } = preview.budget;
		expect(budget).toEqual({
			month: '2026-11',
			readyToAssign: { before: 65_500, after: 60_500 },
			removedAssignments: { count: 2, total: 25_000, months: ['2026-09', '2026-10'] }
		});
		expect(changed.map((c) => [c.name, c.before, c.after])).toEqual([
			['Card', -1_000, 0],
			['Groceries', 0, 2_000],
			['Dining', -2_000, 0]
		]);
		expect(changed.find((c) => c.name === 'Groceries')?.categoryId).toBe(categories.Groceries);

		expect(await persisted(t)).toEqual(before);
		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: '2026-09-01' });
	});

	test('names what must be resolved first, and works out no balance for an Account it touches', async () => {
		const { t, owner, accounts } = await startBudget({
			cutoverDate: '2026-09-01',
			accounts: {
				Checking: ['cash', 100_000],
				Savings: ['cash', 50_000],
				Wallet: ['cash', 2_000]
			}
		});
		const changed = await owner.mutation(api.transactions.create, {
			accountId: accounts.Checking,
			date: '2026-10-02',
			amount: -2_500,
			payee: 'Corner Grocer',
			memo: ''
		});
		const early = await t.run(async (ctx) => {
			await ctx.db.insert('imports', {
				source: 'plaid',
				accountId: accounts.Checking,
				date: '2026-10-03',
				amount: -2_700,
				bankText: 'SAMPLE CORNER GROCER',
				transactionId: changed,
				matched: true,
				state: 'changed'
			});
			await refreshDerivedFields(ctx, changed);
			const savingsSide = await ctx.db.insert('transactions', {
				accountId: accounts.Savings,
				date: '2026-10-31',
				amount: -5_000,
				cleared: 'uncleared',
				approved: true
			});
			const late = await ctx.db.insert('transactions', {
				accountId: accounts.Checking,
				date: '2026-11-02',
				amount: 5_000,
				cleared: 'uncleared',
				approved: true,
				transferTransactionId: savingsSide
			});
			await ctx.db.patch('transactions', savingsSide, { transferTransactionId: late });
			return savingsSide;
		});
		await t.mutation(internal.monthlyTotals.rebuild, {});
		const before = await persisted(t);

		const preview = await owner.query(api.settings.previewLaterCutover, {
			cutoverDate: '2026-11-01',
			today
		});

		assert(preview.kind === 'blocked', `expected a blocked preview, got ${preview.kind}`);
		expect(preview.mustResolve).toEqual([
			{
				kind: 'bankChange',
				transactionId: changed,
				accountName: 'Checking',
				date: '2026-10-02',
				amount: -2_500,
				payeeName: 'Corner Grocer'
			},
			{
				kind: 'transferAcrossDate',
				transactionId: early,
				accountName: 'Savings',
				date: '2026-10-31',
				amount: -5_000,
				otherAccountName: 'Checking',
				otherDate: '2026-11-02'
			}
		]);
		expect(
			preview.accounts.map((account) => [account.name, account.proposedStartingBalance])
		).toEqual([
			['Checking', null],
			['Savings', null],
			['Wallet', 2_000]
		]);
		expect(preview).not.toHaveProperty('budget');
		expect(preview).not.toHaveProperty('fingerprint');
		expect(await persisted(t)).toEqual(before);
	});

	test('counts a Starting Balance dated after the new date as something to resolve', async () => {
		const { owner, accounts } = await startBudget({
			cutoverDate: '2026-09-01',
			accounts: { Checking: ['cash', 100_000] }
		});
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
		await owner.mutation(api.transactions.create, {
			accountId: accounts.Checking,
			date: '2026-08-10',
			amount: -2_500,
			payee: 'Corner Grocer',
			memo: ''
		});

		const preview = await owner.query(api.settings.previewLaterCutover, {
			cutoverDate: '2026-08-20',
			today
		});

		assert(preview.kind === 'blocked', `expected a blocked preview, got ${preview.kind}`);
		expect(preview.mustResolve).toEqual([
			{ kind: 'startingBalanceLater', accountName: 'Checking', date: '2026-09-01' }
		]);
		expect(preview.accounts).toMatchObject([
			{ name: 'Checking', startingBalance: null, proposedStartingBalance: null }
		]);
	});
});

describe('a later cutover date preview it cannot work out', () => {
	test.each([
		{ cutoverDate: '2026-09-01', today, reason: 'notLater' },
		{ cutoverDate: '2026-08-20', today, reason: 'notLater' },
		{ cutoverDate: '2026-11-14', today, reason: 'notYet' }
	] as const)('$cutoverDate on $today is $reason', async ({ cutoverDate, reason }) => {
		const { owner } = await startBudget({
			cutoverDate: '2026-09-01',
			accounts: { Checking: ['cash', 100_000] }
		});

		const preview = await owner.query(api.settings.previewLaterCutover, { cutoverDate, today });

		assert(preview.kind === 'unsupported', `expected an unsupported preview, got ${preview.kind}`);
		expect(preview.reason).toBe(reason);
		expect(preview.message).not.toBe('');
	});

	test('says so when no cutover date is set yet', async () => {
		const { owner } = newBackend();

		expect(
			await owner.query(api.settings.previewLaterCutover, { cutoverDate: '2026-11-01', today })
		).toMatchObject({ kind: 'unsupported', reason: 'noCutoverDate' });
	});

	test('names its limit rather than previewing part of a large history', async () => {
		const { t, owner, accounts } = await startBudget({
			cutoverDate: '2026-09-01',
			accounts: { Checking: ['cash', 100_000] }
		});
		await t.run(async (ctx) => {
			for (let n = 0; n < 500; n++) {
				await ctx.db.insert('transactions', {
					accountId: accounts.Checking,
					date: '2026-10-01',
					amount: -100,
					cleared: 'uncleared',
					approved: true
				});
			}
		});

		const preview = await owner.query(api.settings.previewLaterCutover, {
			cutoverDate: '2026-11-01',
			today
		});

		assert(preview.kind === 'unsupported', `expected an unsupported preview, got ${preview.kind}`);
		expect(preview.reason).toBe('tooMany');
		expect(preview.message).toContain('More than 500 Transactions');
	});

	test('with nothing dated before the new date, says there is nothing to fold', async () => {
		const { owner } = await startBudget({ cutoverDate: '2026-09-01' });

		expect(
			await owner.query(api.settings.previewLaterCutover, { cutoverDate: '2026-11-01', today })
		).toEqual({ kind: 'nothingBefore', from: '2026-09-01', to: '2026-11-01' });
	});
});

describe('a later cutover date preview that can proceed', () => {
	test('says when a bank Account now feeds another Account, as its earlier history stays in the old one', async () => {
		const { t, owner, accounts } = await startBudget({
			cutoverDate: '2026-09-01',
			accounts: { Checking: ['cash', 100_000], Savings: ['cash', 50_000] }
		});
		const imported = await owner.mutation(api.transactions.create, {
			accountId: accounts.Checking,
			date: '2026-10-03',
			amount: -2_500,
			payee: 'Corner Grocer',
			memo: ''
		});
		await t.run(async (ctx) => {
			const connectionId = await ctx.db.insert('bankConnections', {
				name: 'Sample Bank (Sandbox)',
				status: 'ok',
				provider: { kind: 'sandbox' }
			});
			const connectionAccountId = await ctx.db.insert('connectionAccounts', {
				connectionId,
				externalId: 'account-synthetic-checking',
				state: 'mapped',
				accountId: accounts.Savings
			});
			await ctx.db.insert('imports', {
				source: 'plaid',
				sourceId: 'synthetic-grocer',
				accountId: accounts.Checking,
				connectionAccountId,
				date: '2026-10-03',
				amount: -2_500,
				bankText: 'SAMPLE CORNER GROCER',
				transactionId: imported,
				matched: false,
				state: 'linked'
			});
		});

		const preview = await owner.query(api.settings.previewLaterCutover, {
			cutoverDate: '2026-11-01',
			today
		});

		assert(preview.kind === 'ready', `expected a ready preview, got ${preview.kind}`);
		expect(preview.cautions).toContainEqual({
			kind: 'remapped',
			accountName: 'Checking',
			count: 1,
			total: -2_500,
			nowAccountName: 'Savings'
		});
		expect(preview.accounts[0]).toMatchObject({
			name: 'Checking',
			transactions: [{ date: '2026-10-03', fromBank: true }],
			proposedStartingBalance: 97_500
		});
	});

	test('identifies the history it folds: a change there gives another fingerprint, a later one does not', async () => {
		const { owner, accounts } = await startBudget({
			cutoverDate: '2026-09-01',
			accounts: { Checking: ['cash', 100_000] }
		});
		const entry = (date: string, amount: number) => ({
			accountId: accounts.Checking,
			date,
			amount,
			payee: 'Corner Grocer',
			memo: ''
		});
		const folded = await owner.mutation(api.transactions.create, entry('2026-10-03', -2_500));
		const later = await owner.mutation(api.transactions.create, entry('2026-11-03', -1_500));
		const fingerprint = async () => {
			const preview = await owner.query(api.settings.previewLaterCutover, {
				cutoverDate: '2026-11-01',
				today
			});
			assert(preview.kind === 'ready', `expected a ready preview, got ${preview.kind}`);
			return preview.fingerprint;
		};
		const first = await fingerprint();

		expect(await fingerprint()).toBe(first);
		await owner.mutation(api.transactions.update, {
			transactionId: later,
			...entry('2026-11-03', -1_700)
		});
		expect(await fingerprint()).toBe(first);
		await owner.mutation(api.transactions.update, {
			transactionId: folded,
			...entry('2026-10-03', -2_700)
		});
		expect(await fingerprint()).not.toBe(first);
	});
});
