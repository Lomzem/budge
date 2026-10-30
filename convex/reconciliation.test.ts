import { describe, expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetToReconcile() {
	const backend = newBackend();
	const { owner, t } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 300_000
	});
	const discover = await owner.mutation(api.accounts.create, {
		name: 'Discover',
		kind: 'creditCard',
		startingBalance: -20_000
	});
	const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
	const groceries = await owner.mutation(api.categories.create, {
		groupId: everyday,
		name: 'Groceries'
	});

	/** Enters a Groceries purchase, Cleared unless `cleared` is false. */
	const buy = async (accountId: Id<'accounts'>, amount: number, cleared = true) => {
		const id = await owner.mutation(api.transactions.create, {
			accountId,
			date: '2026-08-10',
			amount,
			payee: 'Sample Grocer',
			categoryId: groceries,
			memo: ''
		});
		if (cleared) await owner.mutation(api.transactions.setCleared, { transactionId: id, cleared });
		return id;
	};
	const reconcile = (accountId: Id<'accounts'>, balance: number) =>
		owner.mutation(api.reconciliation.reconcile, { accountId, balance, date: '2026-08-31' });
	const rows = async (accountId: Id<'accounts'>) =>
		(
			await owner.query(api.transactions.list, {
				accountId,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page;
	const account = async (accountId: Id<'accounts'>) => {
		const found = (await owner.query(api.accounts.list, {})).find((a) => a._id === accountId);
		if (found === undefined) throw new Error('No such Account');
		return found;
	};
	const view = () => owner.query(api.budget.month, { month: '2026-08', today: '2026-08-31' });
	const available = async (name: string) =>
		(await view()).groups.flatMap((g) => g.categories).find((c) => c.name === name)?.available;
	/** The monthly totals, which must equal a rebuild from the Transactions. */
	const expectTotalsInStep = async () => {
		const read = () =>
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
		const kept = await read();
		await t.mutation(internal.monthlyTotals.rebuild, {});
		expect(kept).toEqual(await read());
	};
	return {
		...backend,
		checking,
		discover,
		groceries,
		buy,
		reconcile,
		rows,
		account,
		view,
		available,
		expectTotalsInStep
	};
}

describe('reconciling a Cash Account', () => {
	test('a matching balance locks the Cleared Transactions as Reconciled', async () => {
		const b = await budgetToReconcile();
		await b.buy(b.checking, -4_250);
		await b.buy(b.checking, -1_000, false);
		expect(await b.owner.query(api.reconciliation.clearedBalance, { accountId: b.checking })).toBe(
			295_750
		);

		expect(await b.reconcile(b.checking, 295_750)).toBe(0);

		expect((await b.rows(b.checking)).map((r) => [r.amount, r.cleared, r.reconciled])).toEqual([
			[-1_000, false, false],
			[-4_250, true, true],
			[300_000, true, true]
		]);
		expect(await b.account(b.checking)).toMatchObject({
			balance: 294_750,
			lastReconciledOn: '2026-08-31'
		});
		expect((await b.view()).readyToAssign.amount).toBe(300_000);
	});

	test('a difference records one Reconciliation Adjustment in Ready to Assign, then locks', async () => {
		const b = await budgetToReconcile();
		await b.buy(b.checking, -4_250);

		expect(await b.reconcile(b.checking, 295_000)).toBe(-750);

		const [adjustment, ...rest] = await b.rows(b.checking);
		expect(adjustment).toMatchObject({
			date: '2026-08-31',
			amount: -750,
			payeeName: 'Reconciliation Adjustment',
			categoryName: 'Ready to Assign',
			cleared: true,
			reconciled: true,
			approved: true
		});
		expect(rest.map((r) => r.reconciled)).toEqual([true, true]);
		expect(await b.account(b.checking)).toMatchObject({ balance: 295_000 });
		expect(await b.owner.query(api.reconciliation.clearedBalance, { accountId: b.checking })).toBe(
			295_000
		);
		expect((await b.view()).readyToAssign.amount).toBe(299_250);
		await b.expectTotalsInStep();
	});

	test("the adjustment's Category can be changed afterwards", async () => {
		const b = await budgetToReconcile();
		await b.reconcile(b.checking, 299_000);
		const [adjustment] = await b.rows(b.checking);
		if (adjustment === undefined) throw new Error('No adjustment');

		await b.owner.mutation(api.transactions.update, {
			transactionId: adjustment._id,
			accountId: b.checking,
			date: adjustment.date,
			amount: adjustment.amount,
			payee: 'Reconciliation Adjustment',
			categoryId: b.groceries,
			memo: 'Missed receipt'
		});

		expect((await b.view()).readyToAssign.amount).toBe(300_000);
		expect(await b.available('Groceries')).toBe(-1_000);
	});

	test('refuses a date before the cutover, and leaves everything as it was', async () => {
		const b = await budgetToReconcile();

		expect(
			await publicErrorCode(
				b.owner.mutation(api.reconciliation.reconcile, {
					accountId: b.checking,
					balance: 1,
					date: '2026-07-31'
				})
			)
		).toBe('INVALID_INPUT');

		expect(await b.rows(b.checking)).toMatchObject([{ amount: 300_000, reconciled: false }]);
		expect(await b.account(b.checking)).toMatchObject({ lastReconciledOn: null });
	});
});

describe('reconciling a Credit Card Account', () => {
	test('a matching balance locks its Cleared Transactions', async () => {
		const b = await budgetToReconcile();
		await b.buy(b.discover, -5_000);

		expect(await b.reconcile(b.discover, -25_000)).toBe(0);

		expect((await b.rows(b.discover)).map((r) => r.reconciled)).toEqual([true, true]);
		expect(await b.account(b.discover)).toMatchObject({ lastReconciledOn: '2026-08-31' });
		expect(await b.available('Discover')).toBe(5_000);
	});

	test('a difference moves its full amount from Ready to Assign into the Payment Category', async () => {
		const b = await budgetToReconcile();
		await b.buy(b.discover, -5_000);

		// The bank says the card owes $3.00 more than Budge has cleared.
		expect(await b.reconcile(b.discover, -25_300)).toBe(-300);

		expect(await b.rows(b.discover)).toMatchObject([
			{ amount: -300, payeeName: 'Reconciliation Adjustment', reconciled: true },
			{ reconciled: true },
			{ reconciled: true }
		]);
		expect(await b.account(b.discover)).toMatchObject({ balance: -25_300 });
		expect((await b.view()).readyToAssign.amount).toBe(299_700);
		expect(await b.available('Discover')).toBe(5_300);
		await b.expectTotalsInStep();
	});
});

describe('a Reconciled Transaction', () => {
	async function reconciledPurchase() {
		const b = await budgetToReconcile();
		const id = await b.buy(b.checking, -4_250);
		await b.reconcile(b.checking, 295_750);
		const edit = (change: Partial<{ accountId: Id<'accounts'>; date: string; amount: number }>) =>
			b.owner.mutation(api.transactions.update, {
				transactionId: id,
				accountId: b.checking,
				date: '2026-08-10',
				amount: -4_250,
				payee: 'Sample Grocer',
				categoryId: b.groceries,
				memo: '',
				...change
			});
		return { ...b, id, edit };
	}

	test('refuses amount, date, and Account edits, deletion, and uncleared', async () => {
		const b = await reconciledPurchase();

		for (const attempt of [
			b.edit({ amount: -4_000 }),
			b.edit({ date: '2026-08-11' }),
			b.edit({ accountId: b.discover }),
			b.owner.mutation(api.transactions.remove, { transactionId: b.id }),
			b.owner.mutation(api.transactions.setCleared, { transactionId: b.id, cleared: false })
		]) {
			expect(await publicErrorCode(attempt)).toBe('INVALID_INPUT');
		}
		expect((await b.rows(b.checking))[0]).toMatchObject({ amount: -4_250, reconciled: true });
	});

	test('keeps its Category, Payee, and memo editable, and stays Reconciled', async () => {
		const b = await reconciledPurchase();

		await b.owner.mutation(api.transactions.update, {
			transactionId: b.id,
			accountId: b.checking,
			date: '2026-08-10',
			amount: -4_250,
			payee: 'Another Grocer',
			memo: 'Snacks'
		});

		expect((await b.rows(b.checking))[0]).toMatchObject({
			payeeName: 'Another Grocer',
			categoryName: null,
			memo: 'Snacks',
			reconciled: true
		});
	});

	test('can be edited and deleted once the owner unlocks it, back to Cleared', async () => {
		const b = await reconciledPurchase();

		await b.owner.mutation(api.transactions.unlock, { transactionId: b.id });
		expect((await b.rows(b.checking))[0]).toMatchObject({ cleared: true, reconciled: false });
		await b.edit({ amount: -4_000 });
		expect(await b.owner.query(api.reconciliation.clearedBalance, { accountId: b.checking })).toBe(
			296_000
		);

		await b.owner.mutation(api.transactions.remove, { transactionId: b.id });
		expect(await b.rows(b.checking)).toHaveLength(1);
	});

	test('refuses Unmatch, which would take it back to uncleared', async () => {
		const b = await budgetToReconcile();
		await b.buy(b.checking, -450, false);
		await b.owner.mutation(api.imports.commit, {
			accountId: b.checking,
			source: 'csv',
			rows: [{ date: '2026-08-12', amount: -450, bankText: 'SAMPLE GROCER 0042' }]
		});
		await b.reconcile(b.checking, 299_550);
		const bankRow = (await b.rows(b.checking))[0]?.bankRows[0];
		if (bankRow === undefined) throw new Error('No Bank Row');

		expect(
			await publicErrorCode(b.owner.mutation(api.imports.unmatch, { importId: bankRow._id }))
		).toBe('INVALID_INPUT');
		expect(await b.rows(b.checking)).toHaveLength(2);
	});

	test("on one side of a Transfer, keeps the other side's amount and date too", async () => {
		const b = await budgetToReconcile();
		const payment = await b.owner.mutation(api.transactions.create, {
			accountId: b.checking,
			transferAccountId: b.discover,
			date: '2026-08-20',
			amount: -10_000,
			payee: '',
			memo: ''
		});
		const [cardSide] = await b.rows(b.discover);
		if (cardSide === undefined) throw new Error('No card side');
		await b.owner.mutation(api.transactions.setCleared, {
			transactionId: cardSide._id,
			cleared: true
		});
		await b.reconcile(b.discover, -10_000);

		for (const attempt of [
			b.owner.mutation(api.transactions.update, {
				transactionId: payment,
				accountId: b.checking,
				transferAccountId: b.discover,
				date: '2026-08-20',
				amount: -12_000,
				payee: '',
				memo: ''
			}),
			b.owner.mutation(api.transactions.remove, { transactionId: payment })
		]) {
			expect(await publicErrorCode(attempt)).toBe('INVALID_INPUT');
		}
		expect((await b.rows(b.discover))[0]).toMatchObject({ amount: 10_000, reconciled: true });
	});

	test('as an imported card payment, cannot be linked as a Transfer side dated otherwise', async () => {
		const b = await budgetToReconcile();
		const importRow = (accountId: Id<'accounts'>, date: string, amount: number) =>
			b.owner.mutation(api.imports.commit, {
				accountId,
				source: 'csv',
				rows: [{ date, amount, bankText: 'SAMPLE PAYMENT 0007' }]
			});
		await importRow(b.discover, '2026-08-22', 10_000);
		await b.reconcile(b.discover, -10_000);
		await importRow(b.checking, '2026-08-20', -10_000);
		const fromChecking = (await b.rows(b.checking)).find((row) => row.amount === -10_000);
		const intoCard = (await b.rows(b.discover)).find((row) => row.amount === 10_000);
		if (fromChecking === undefined || intoCard === undefined) throw new Error('No import');

		expect(
			await publicErrorCode(
				b.owner.mutation(api.transactions.update, {
					transactionId: fromChecking._id,
					accountId: b.checking,
					transferAccountId: b.discover,
					transferTransactionId: intoCard._id,
					date: '2026-08-20',
					amount: -10_000,
					payee: '',
					memo: ''
				})
			)
		).toBe('INVALID_INPUT');
		expect((await b.rows(b.discover)).find((row) => row._id === intoCard._id)).toMatchObject({
			date: '2026-08-22',
			reconciled: true
		});
	});
});
