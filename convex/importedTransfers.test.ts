import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithTwoCashAccounts() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const account = (name: string, startingBalance: number) =>
		owner.mutation(api.accounts.create, { name, kind: 'cash', startingBalance });
	const checking = await account('Checking', 100_000);
	const savings = await account('Savings', 500_000);
	const rows = async (accountId: Id<'accounts'>) =>
		(
			await owner.query(api.transactions.list, {
				accountId,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	const importCsv = (
		accountId: Id<'accounts'>,
		row: { date: string; amount: number; bankText: string }
	) => owner.mutation(api.imports.commit, { accountId, source: 'csv', rows: [row] });
	const balances = async () =>
		Object.fromEntries(
			(await owner.query(api.accounts.list, {})).map((row) => [row.name, row.balance])
		);
	return { ...backend, checking, savings, rows, importCsv, balances };
}

// Invented Bank Text and amounts.
const outOfChecking = { date: '2026-08-20', amount: -25_000, bankText: 'SAMPLE XFER TO SAV 0001' };
const intoSavings = { date: '2026-08-22', amount: 25_000, bankText: 'SAMPLE XFER FROM CHK 0001' };

/** The owner categorizes a Transaction as a Transfer, keeping its date, amount, and memo. */
const asTransfer = (
	row: { _id: Id<'transactions'>; accountId: Id<'accounts'>; date: string; amount: number },
	transferAccountId: Id<'accounts'>
) => ({
	transactionId: row._id,
	accountId: row.accountId,
	date: row.date,
	amount: row.amount,
	payee: '',
	memo: '',
	transferAccountId
});

describe('a Transfer from an imported Transaction', () => {
	test("creates the other side uncleared, which that Account's import Matches", async () => {
		const { owner, checking, savings, rows, importCsv, balances } =
			await budgetWithTwoCashAccounts();
		await importCsv(checking, outOfChecking);
		const [imported] = await rows(checking);
		if (imported === undefined) throw new Error('The import added nothing.');

		await owner.mutation(api.transactions.update, asTransfer(imported, savings));

		expect(await rows(savings)).toMatchObject([
			{ date: '2026-08-20', amount: 25_000, cleared: false, transfer: { accountId: checking } }
		]);

		expect(await importCsv(savings, intoSavings)).toEqual({ added: 0, matched: 1, skipped: 0 });

		expect(await rows(checking)).toMatchObject([
			{ amount: -25_000, cleared: true, transfer: { accountId: savings } }
		]);
		expect(await rows(savings)).toMatchObject([
			{
				date: '2026-08-20',
				amount: 25_000,
				cleared: true,
				transfer: { accountId: checking },
				bankRows: [{ bankText: 'SAMPLE XFER FROM CHK 0001', matched: true }]
			}
		]);
		expect(await balances()).toMatchObject({ Checking: 75_000, Savings: 525_000 });
	});
});

describe('when both sides are already imported', () => {
	async function bothImported() {
		const backend = await budgetWithTwoCashAccounts();
		await backend.importCsv(backend.checking, outOfChecking);
		await backend.importCsv(backend.savings, intoSavings);
		const [fromChecking] = await backend.rows(backend.checking);
		const [toSavings] = await backend.rows(backend.savings);
		if (fromChecking === undefined || toSavings === undefined) {
			throw new Error('The imports added nothing.');
		}
		return { ...backend, fromChecking, toSavings };
	}

	test('Budge offers the other import, with the opposite amount, within 10 days', async () => {
		const { owner, checking, savings, importCsv, fromChecking, toSavings } = await bothImported();
		// Not offered: the same amount, the wrong date, and one already a Transfer side.
		await importCsv(savings, { ...intoSavings, amount: -25_000, bankText: 'SAMPLE FEE' });
		await importCsv(savings, { ...intoSavings, date: '2026-09-05', bankText: 'SAMPLE LATE' });
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			transferAccountId: savings,
			date: '2026-08-21',
			amount: -25_000,
			payee: '',
			memo: ''
		});

		expect(
			await owner.query(api.transactions.transferCandidates, {
				transferAccountId: savings,
				date: fromChecking.date,
				amount: fromChecking.amount
			})
		).toEqual([
			{
				_id: toSavings._id,
				date: '2026-08-22',
				amount: 25_000,
				payeeName: 'SAMPLE XFER FROM CHK 0001',
				memo: null
			}
		]);
	});

	test('linking it makes one pair without a third Transaction', async () => {
		const { owner, checking, savings, rows, balances, fromChecking, toSavings } =
			await bothImported();

		await owner.mutation(api.transactions.update, {
			...asTransfer(fromChecking, savings),
			transferTransactionId: toSavings._id
		});

		expect(await rows(checking)).toMatchObject([
			{ _id: fromChecking._id, cleared: true, approved: true, transfer: { accountId: savings } }
		]);
		expect(await rows(savings)).toMatchObject([
			{
				_id: toSavings._id,
				date: '2026-08-20',
				amount: 25_000,
				payeeName: null,
				categoryId: null,
				cleared: true,
				approved: true,
				transfer: { accountId: checking },
				bankRows: [{ bankText: 'SAMPLE XFER FROM CHK 0001', matched: false }]
			}
		]);
		expect(await balances()).toMatchObject({ Checking: 75_000, Savings: 525_000 });
	});

	test('linking it in place of a created other side deletes that side', async () => {
		const { owner, savings, rows, fromChecking, toSavings } = await bothImported();
		await owner.mutation(api.transactions.update, asTransfer(fromChecking, savings));
		expect(await rows(savings)).toHaveLength(2);

		await owner.mutation(api.transactions.update, {
			...asTransfer(fromChecking, savings),
			transferTransactionId: toSavings._id
		});

		expect(await rows(savings)).toMatchObject([
			{ _id: toSavings._id, transfer: { accountId: fromChecking.accountId } }
		]);
	});

	test.each([
		['entered by hand', { amount: 25_000, imported: false }],
		['with the same amount', { amount: -25_000, imported: true }]
	])('refuses to link one %s', async (_, { amount, imported }) => {
		const { owner, savings, rows, importCsv, fromChecking } = await bothImported();
		if (imported) await importCsv(savings, { ...intoSavings, amount, bankText: 'SAMPLE FEE' });
		else {
			await owner.mutation(api.transactions.create, {
				accountId: savings,
				date: '2026-08-21',
				amount,
				payee: 'Sample Payee',
				memo: ''
			});
		}
		const other = (await rows(savings)).find(
			(row) => row.date === (imported ? '2026-08-22' : '2026-08-21') && row.amount === amount
		);
		if (other === undefined) throw new Error('The other Transaction is missing.');

		expect(
			await publicErrorCode(
				owner.mutation(api.transactions.update, {
					...asTransfer(fromChecking, savings),
					transferTransactionId: other._id
				})
			)
		).toBe('INVALID_INPUT');
	});
});

test.each(['create-then-import', 'link-existing'] as const)(
	'a Cash-to-Cash Transfer by %s leaves the budget as it was before either import',
	async (path) => {
		const { owner, checking, savings, rows, importCsv } = await budgetWithTwoCashAccounts();
		const budget = () => owner.query(api.budget.month, { month: '2026-08', today: '2026-08-31' });
		const before = await budget();

		await importCsv(checking, outOfChecking);
		if (path === 'link-existing') await importCsv(savings, intoSavings);
		const [fromChecking] = await rows(checking);
		const [toSavings] = await rows(savings);
		if (fromChecking === undefined) throw new Error('The import added nothing.');
		await owner.mutation(api.transactions.update, {
			...asTransfer(fromChecking, savings),
			...(path === 'link-existing' && toSavings ? { transferTransactionId: toSavings._id } : {})
		});
		if (path === 'create-then-import') await importCsv(savings, intoSavings);

		expect(await rows(savings)).toHaveLength(1);
		expect(await budget()).toEqual(before);
	}
);
