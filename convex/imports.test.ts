import { Effect } from 'effect';
import { describe, expect, test } from 'vitest';

import { decodeBankFile } from '../src/lib/domain/bankFiles';
import checkingCsv from '../src/lib/domain/fixtures/synthetic/capital-one-checking.csv?raw';
import checkingQfx from '../src/lib/domain/fixtures/synthetic/capital-one-checking.qfx?raw';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

const cutoverDate = '2026-08-01';

async function budgetWithChecking() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 100_000
	});
	const rows = async () =>
		(
			await owner.query(api.transactions.list, {
				accountId: checking,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	const balance = async () =>
		(await owner.query(api.accounts.list, {})).find((account) => account._id === checking)?.balance;
	return { ...backend, checking, rows, balance };
}

const decode = (text: string) => Effect.runSync(decodeBankFile(text, cutoverDate));

// Invented Bank Text and amounts.
const coffee = { date: '2026-08-16', amount: -450, bankText: 'SAMPLE COFFEE 0042' };

describe('importing a bank file', () => {
	test('adds new rows Cleared and Unapproved, counted at once, Payee from Bank Text', async () => {
		const { owner, checking, rows, balance } = await budgetWithChecking();
		const { source, rows: bankRows } = decode(checkingQfx);

		expect(
			await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows })
		).toEqual({ added: 2, matched: 0, skipped: 0 });

		expect(await balance()).toBe(100_000 - 4_250 + 231_042);
		expect(await rows()).toMatchObject([
			{
				date: '2026-08-15',
				amount: 231_042,
				payeeName: 'SAMPLE PAYROLL & CO',
				categoryId: null,
				cleared: true,
				approved: false,
				bankRows: [{ bankText: 'SAMPLE PAYROLL & CO', matched: false }]
			},
			{ date: '2026-08-14', amount: -4_250, cleared: true, approved: false }
		]);
		expect(await owner.query(api.transactions.unapprovedCount, {})).toBe(2);
	});

	test('the same QFX file twice adds nothing the second time', async () => {
		const { owner, checking, rows } = await budgetWithChecking();
		const { source, rows: bankRows } = decode(checkingQfx);
		await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows });

		expect(
			await owner.query(api.imports.preview, { accountId: checking, source, rows: bankRows })
		).toEqual([{ kind: 'skip' }, { kind: 'skip' }]);
		expect(
			await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows })
		).toEqual({ added: 0, matched: 0, skipped: 2 });
		expect(await rows()).toHaveLength(2);
	});

	test('the same CSV file twice adds nothing, yet keeps both identical coffees', async () => {
		const { owner, checking, rows } = await budgetWithChecking();
		const { source, rows: bankRows } = decode(checkingCsv);
		await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows });
		expect(await rows()).toHaveLength(4);

		await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows });
		expect(await rows()).toHaveLength(4);
	});

	test('a CSV row matching a hand-entered Transaction Matches it, keeping what I entered', async () => {
		const { owner, checking, rows, balance } = await budgetWithChecking();
		const { groups } = await owner.query(api.categories.list, {});
		const groupId =
			groups[0]?._id ?? (await owner.mutation(api.categories.createGroup, { name: 'Everyday' }));
		const categoryId = await owner.mutation(api.categories.create, { groupId, name: 'Coffee' });
		const entered = await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-14',
			amount: -450,
			payee: 'Sample Coffee Shop',
			categoryId,
			memo: 'Oat latte'
		});

		const preview = await owner.query(api.imports.preview, {
			accountId: checking,
			source: 'csv',
			rows: [coffee]
		});
		expect(preview).toMatchObject([{ kind: 'match', transaction: { _id: entered } }]);
		expect(
			await owner.mutation(api.imports.commit, {
				accountId: checking,
				source: 'csv',
				rows: [coffee]
			})
		).toEqual({ added: 0, matched: 1, skipped: 0 });

		expect(await balance()).toBe(100_000 - 450);
		expect(await rows()).toMatchObject([
			{
				_id: entered,
				date: '2026-08-14',
				payeeName: 'Sample Coffee Shop',
				categoryId,
				memo: 'Oat latte',
				cleared: true,
				approved: false,
				bankRows: [{ bankText: 'SAMPLE COFFEE 0042', matched: true }]
			}
		]);
	});

	test('two identical coffees stay two, one Matching the hand-entered one', async () => {
		const { owner, checking, rows } = await budgetWithChecking();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-16',
			amount: -450,
			payee: 'Sample Coffee Shop',
			memo: ''
		});

		expect(
			await owner.mutation(api.imports.commit, {
				accountId: checking,
				source: 'csv',
				rows: [coffee, coffee]
			})
		).toEqual({ added: 1, matched: 1, skipped: 0 });
		expect((await rows()).map((row) => row.amount)).toEqual([-450, -450]);
	});

	test('a row with two candidates must be picked before saving', async () => {
		const { owner, checking, rows } = await budgetWithChecking();
		const enter = (date: string) =>
			owner.mutation(api.transactions.create, {
				accountId: checking,
				date,
				amount: -450,
				payee: 'Sample Coffee Shop',
				memo: ''
			});
		const near = await enter('2026-08-15');
		const far = await enter('2026-08-10');

		expect(
			await owner.query(api.imports.preview, { accountId: checking, source: 'csv', rows: [coffee] })
		).toMatchObject([{ kind: 'ask', candidates: [{ _id: near }, { _id: far }] }]);
		expect(
			await publicErrorCode(
				owner.mutation(api.imports.commit, { accountId: checking, source: 'csv', rows: [coffee] })
			)
		).toBe('INVALID_INPUT');

		await owner.mutation(api.imports.commit, {
			accountId: checking,
			source: 'csv',
			rows: [{ ...coffee, pick: far }]
		});
		const byId = new Map((await rows()).map((row) => [row._id, row]));
		expect(byId.get(far)).toMatchObject({ cleared: true, approved: false });
		expect(byId.get(near)).toMatchObject({ cleared: false, approved: true });
	});

	test('Unmatch splits the Bank Row back into its own Transaction, restoring both', async () => {
		const { owner, checking, rows, balance } = await budgetWithChecking();
		const entered = await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-14',
			amount: -450,
			payee: 'Sample Coffee Shop',
			memo: 'Oat latte'
		});
		await owner.mutation(api.imports.commit, {
			accountId: checking,
			source: 'csv',
			rows: [coffee]
		});
		const bankRowId = (await rows())[0]?.bankRows[0]?._id as Id<'imports'>;

		await owner.mutation(api.imports.unmatch, { importId: bankRowId });

		expect(await balance()).toBe(100_000 - 900);
		const after = await rows();
		expect(after).toHaveLength(2);
		expect(after.find((row) => row._id === entered)).toMatchObject({
			payeeName: 'Sample Coffee Shop',
			memo: 'Oat latte',
			cleared: false,
			approved: true,
			bankRows: []
		});
		expect(after.find((row) => row._id !== entered)).toMatchObject({
			date: '2026-08-16',
			amount: -450,
			payeeName: 'SAMPLE COFFEE 0042',
			cleared: true,
			approved: false,
			bankRows: [{ _id: bankRowId, matched: false }]
		});
	});

	test('a deleted imported Transaction does not come back with the same file', async () => {
		const { owner, checking, rows } = await budgetWithChecking();
		const { source, rows: bankRows } = decode(checkingQfx);
		await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows });
		const [first] = await rows();
		await owner.mutation(api.transactions.remove, {
			transactionId: first?._id as Id<'transactions'>
		});

		await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows });
		expect(await rows()).toHaveLength(1);
	});

	test.each([
		['a date before the cutover', { ...coffee, date: '2026-07-31' }, 'csv'],
		['an amount with fractions of a cent', { ...coffee, amount: -4.5 }, 'csv'],
		['blank Bank Text', { ...coffee, bankText: '  ' }, 'csv'],
		['a QFX row without an import ID', coffee, 'qfx'],
		['a CSV row with an import ID', { ...coffee, sourceId: 'X' }, 'csv']
	] as const)('refuses %s', async (_, row, source) => {
		const { owner, checking, rows } = await budgetWithChecking();

		expect(
			await publicErrorCode(
				owner.mutation(api.imports.commit, { accountId: checking, source, rows: [row] })
			)
		).toBe('INVALID_INPUT');
		expect(await rows()).toHaveLength(0);
	});
});

describe('approving', () => {
	test('editing approves, and Approve all approves the rest; Unapproved list first', async () => {
		const { owner, checking } = await budgetWithChecking();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-30',
			amount: -1_000,
			payee: 'Sample Market',
			memo: ''
		});
		const { source, rows: bankRows } = decode(checkingCsv);
		await owner.mutation(api.imports.commit, { accountId: checking, source, rows: bankRows });
		const list = async (approval: 'unapproved' | 'approved') =>
			(
				await owner.query(api.transactions.list, {
					accountId: checking,
					approval,
					paginationOpts: { numItems: 50, cursor: null }
				})
			).page;

		const unapproved = await list('unapproved');
		expect(unapproved.map((row) => row.date)).toEqual([
			'2026-08-16',
			'2026-08-16',
			'2026-08-15',
			'2026-08-14'
		]);
		expect((await list('approved')).map((row) => row.payeeName)).toEqual([
			'Sample Market',
			'Starting Balance'
		]);

		const [first, second] = unapproved;
		if (first === undefined || second === undefined) throw new Error('expected rows');
		await owner.mutation(api.transactions.update, {
			transactionId: first._id,
			accountId: checking,
			date: first.date,
			amount: first.amount,
			payee: 'Sample Coffee Shop',
			memo: ''
		});
		await owner.mutation(api.transactions.approve, { transactionId: second._id });
		expect(await owner.query(api.transactions.unapprovedCount, {})).toBe(2);

		expect(await owner.mutation(api.transactions.approveAll, { accountId: checking })).toBe(2);
		expect(await owner.query(api.transactions.unapprovedCount, {})).toBe(0);
		expect(await list('unapproved')).toEqual([]);
	});
});
