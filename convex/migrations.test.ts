import { afterEach, assert, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { makeLegacyStartingBalance, newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

afterEach(() => {
	vi.useRealTimers();
});

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

	test('gives a card whose starting debt still carries the Starting Balance Payee what a new card gets', async () => {
		const current = await budgetWithCard();
		const legacy = await budgetWithCard();
		await makeLegacy(legacy);
		await makeLegacyStartingBalance(legacy.t, legacy.card);

		expect(await legacy.t.mutation(internal.migrations.backfillPaymentCategories, {})).toEqual({
			repaired: 1,
			unmatched: []
		});

		expect(await legacy.view()).toEqual(await current.view());
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

	test('leaves a legacy starting debt split under the Starting Balance Payee, and names its card', async () => {
		const legacy = await budgetWithCard();
		await makeLegacy(legacy);
		const { owner, t, card } = legacy;
		const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
		const [groceries, dining] = await Promise.all(
			['Groceries', 'Dining Out'].map((name) =>
				owner.mutation(api.categories.create, { groupId: everyday, name })
			)
		);
		assert(groceries !== undefined && dining !== undefined, 'No Categories.');
		await makeLegacyStartingBalance(t, card, [
			{ categoryId: groceries, amount: -15_000 },
			{ categoryId: dining, amount: -5_000 }
		]);
		const startingRow = await t.run(async (ctx) =>
			ctx.db
				.query('transactions')
				.withIndex('by_account_date', (q) => q.eq('accountId', card).eq('date', '2026-08-01'))
				.unique()
		);
		assert(startingRow !== null, 'No starting row.');
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

describe('backfilling the Starting Balance kind', () => {
	async function legacyBudget() {
		const backend = newBackend();
		const { owner, t } = backend;
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
		const checking = await owner.mutation(api.accounts.create, {
			name: 'Checking',
			kind: 'cash',
			startingBalance: 300_000
		});
		const card = await owner.mutation(api.accounts.create, {
			name: 'Discover',
			kind: 'creditCard',
			startingBalance: -20_000
		});
		const rows = async (accountId: Id<'accounts'>) =>
			(
				await owner.query(api.transactions.list, {
					accountId,
					paginationOpts: { numItems: 20, cursor: null }
				})
			).page;
		const view = async () => ({
			accounts: (await owner.query(api.accounts.list, {})).map(({ name, balance }) => ({
				name,
				balance
			})),
			rows: [...(await rows(checking)), ...(await rows(card))].map(
				({ _id, date, amount, payeeName, categoryId, cleared }) => ({
					_id,
					date,
					amount,
					payeeName,
					categoryId,
					cleared
				})
			)
		});
		const backfill = () => t.mutation(internal.migrations.backfillStartingBalanceKind, {});
		const giveLegacyStartingBalancePayee = (transactionId: Id<'transactions'>) =>
			t.run(async (ctx) => {
				const payee = await ctx.db
					.query('payees')
					.withIndex('by_name', (q) => q.eq('name', 'Starting Balance'))
					.unique();
				assert(payee !== null, 'expected the legacy Starting Balance Payee');
				await ctx.db.patch('transactions', transactionId, { payeeId: payee._id });
			});
		const totalsRebuildUnchanged = async () => {
			const totals = () =>
				t.run(async (ctx) =>
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
			const kept = await totals();
			await t.mutation(internal.monthlyTotals.rebuild, {});
			return { kept, rebuilt: await totals() };
		};
		return {
			...backend,
			checking,
			card,
			rows,
			view,
			backfill,
			giveLegacyStartingBalancePayee,
			totalsRebuildUnchanged
		};
	}

	test('gives each legacy starting balance its kind, keeps every amount, date and Category, and a rerun changes nothing', async () => {
		const legacy = await legacyBudget();
		const { owner, checking, card } = legacy;
		await makeLegacyStartingBalance(legacy.t, checking);
		await makeLegacyStartingBalance(legacy.t, card);
		const before = await legacy.view();

		expect(await legacy.backfill()).toEqual({ converted: 2, unresolved: [] });

		expect(await legacy.view()).toEqual(before);
		const { kept, rebuilt } = await legacy.totalsRebuildUnchanged();
		expect(rebuilt).toEqual(kept);
		expect(
			await owner.query(api.transactions.list, {
				search: 'starting balance',
				paginationOpts: { numItems: 20, cursor: null }
			})
		).toMatchObject({
			page: [{ payeeName: 'Starting Balance' }, { payeeName: 'Starting Balance' }]
		});
		await owner.mutation(api.accounts.setStartingBalance, {
			accountId: checking,
			startingBalance: 310_000
		});
		const [startingBalance, ...others] = await legacy.rows(checking);
		expect(others).toEqual([]);
		expect(startingBalance).toMatchObject({
			_id: before.rows[0]?._id,
			amount: 310_000,
			payeeName: 'Starting Balance'
		});

		const settled = await legacy.view();
		expect(await legacy.backfill()).toEqual({ converted: 0, unresolved: [] });
		expect(await legacy.view()).toEqual(settled);
	});

	test('changes nothing on a budget that never had legacy starting balances', async () => {
		const current = await legacyBudget();
		const before = await current.view();

		expect(await current.backfill()).toEqual({ converted: 0, unresolved: [] });

		expect(await current.view()).toEqual(before);
	});

	test('leaves an imported row and a Transfer that carry the legacy Payee as they are', async () => {
		const legacy = await legacyBudget();
		const { owner, checking, card } = legacy;
		await makeLegacyStartingBalance(legacy.t, checking);
		await owner.mutation(api.imports.commit, {
			accountId: checking,
			source: 'csv',
			rows: [{ date: '2026-08-04', amount: 7_500, bankText: 'SAMPLE REFUND' }]
		});
		const transferId = await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-06',
			amount: -10_000,
			payee: '',
			memo: '',
			transferAccountId: card
		});
		const imported = (await legacy.rows(checking)).find((row) => row.amount === 7_500);
		assert(imported !== undefined, 'expected the imported row');
		await legacy.giveLegacyStartingBalancePayee(imported._id);
		await legacy.giveLegacyStartingBalancePayee(transferId);
		const before = await legacy.view();

		expect(await legacy.backfill()).toEqual({ converted: 1, unresolved: [] });

		expect((await legacy.view()).accounts).toEqual(before.accounts);
		expect(
			(await legacy.rows(checking)).filter((row) => row.payeeName === 'Starting Balance')
		).toMatchObject([{ amount: -10_000 }, { amount: 7_500 }, { amount: 300_000 }]);
		await owner.mutation(api.accounts.setStartingBalance, {
			accountId: checking,
			startingBalance: 310_000
		});
		expect((await legacy.rows(checking)).map(({ amount }) => amount).sort((a, b) => a - b)).toEqual(
			[-10_000, 7_500, 310_000]
		);
	});

	test('reports an Account with a split legacy starting balance, or with two, and changes nothing there', async () => {
		const legacy = await legacyBudget();
		const { owner, t, checking, card } = legacy;
		const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
		const groceries = await owner.mutation(api.categories.create, {
			groupId: everyday,
			name: 'Groceries'
		});
		const dining = await owner.mutation(api.categories.create, {
			groupId: everyday,
			name: 'Dining Out'
		});
		await makeLegacyStartingBalance(t, checking, [
			{ categoryId: groceries, amount: 200_000 },
			{ categoryId: dining, amount: 100_000 }
		]);
		await makeLegacyStartingBalance(t, card);
		const secondId = await owner.mutation(api.transactions.create, {
			accountId: card,
			date: '2026-08-01',
			amount: -2_500,
			payee: '',
			memo: ''
		});
		await legacy.giveLegacyStartingBalancePayee(secondId);
		const before = await legacy.view();

		const result = await legacy.backfill();

		expect(result.converted).toBe(0);
		expect([...result.unresolved].sort()).toEqual([checking, card].sort());
		expect(await legacy.view()).toEqual(before);
		expect(await legacy.backfill()).toEqual(result);
	});

	test('reports an Account whose only legacy-named row was entered after the Account was made, and changes nothing there', async () => {
		vi.useFakeTimers({ now: new Date('2026-08-01T12:00:00Z'), toFake: ['Date'] });
		const legacy = await legacyBudget();
		const { owner, t, checking } = legacy;
		await makeLegacyStartingBalance(t, checking);
		const [genuine] = await legacy.rows(checking);
		assert(genuine !== undefined, 'expected the legacy starting balance');
		await owner.mutation(api.transactions.remove, { transactionId: genuine._id });
		vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-09',
			amount: 5_000,
			payee: 'Starting Balance',
			memo: 'owner-named deposit'
		});
		const before = await legacy.view();

		expect(await legacy.backfill()).toEqual({ converted: 0, unresolved: [checking] });

		expect(await legacy.view()).toEqual(before);
	});

	test('reports an Account that already has a starting balance beside a legacy one', async () => {
		const legacy = await legacyBudget();
		const { owner, t, checking } = legacy;
		await makeLegacyStartingBalance(t, checking);
		await owner.mutation(api.accounts.setStartingBalance, {
			accountId: checking,
			startingBalance: 50_000
		});
		const before = await legacy.view();

		expect(await legacy.backfill()).toEqual({ converted: 0, unresolved: [checking] });

		expect(await legacy.view()).toEqual(before);
	});
});
