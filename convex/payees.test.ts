import { assert, describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithChecking() {
	const backend = await startBudget({
		accounts: { Checking: ['cash', 100_000] },
		groups: { Everyday: ['Dining', 'Groceries'] }
	});
	const { owner } = backend;
	const { Checking: checking } = backend.accounts;
	const { Dining: dining, Groceries: groceries } = backend.categories;
	const rows = async () =>
		(
			await owner.query(api.transactions.list, {
				accountId: checking,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	const importCsv = (rows: { date: string; amount: number; bankText: string }[]) =>
		owner.mutation(api.imports.commit, { accountId: checking, source: 'csv', rows });
	const lastCategory = (name: string) => owner.query(api.payees.lastCategory, { name });
	return { ...backend, checking, dining, groceries, rows, importCsv, lastCategory };
}

const lunch = { date: '2026-08-10', amount: -1_850, payee: 'Sample Noodle Bar', memo: '' };

type Budget = Awaited<ReturnType<typeof budgetWithChecking>>;
type Row = Awaited<ReturnType<Budget['rows']>>[number];

const editsByControl = [
	{
		control: 'the Transaction dialog',
		edit: (budget: Budget, row: Row, categoryId: Id<'categories'>, remember: boolean) =>
			budget.owner.mutation(api.transactions.update, {
				transactionId: row._id,
				accountId: budget.checking,
				date: row.date,
				amount: row.amount,
				payee: row.payeeName ?? '',
				categoryId,
				memo: '',
				...(remember ? { rememberCategory: true } : {})
			})
	},
	{
		control: "the row's Category",
		edit: (budget: Budget, row: Row, categoryId: Id<'categories'>, remember: boolean) =>
			budget.owner.mutation(api.transactions.categorize, {
				transactionId: row._id,
				choice: { kind: 'category', categoryId, ...(remember ? { remember: true } : {}) }
			})
	}
];

const byDate = <Row extends { date: string }>(rows: Row[], date: string) =>
	rows.find((row) => row.date === date);

describe.each(editsByControl)('remembering a Category through $control', ({ edit }) => {
	test('a one-off Category changes only its Transaction, and only an explicit remember changes what later imports arrive as', async () => {
		const budget = await budgetWithChecking();
		const { dining, groceries, rows, importCsv } = budget;
		const imported = async (date: string, amount: number) => {
			await importCsv([{ date, amount, bankText: 'SAMPLE NOODLE 0042' }]);
			const row = byDate(await rows(), date);
			assert(row !== undefined, `no import on ${date}`);
			return row;
		};

		const first = await imported('2026-08-10', -1_100);
		await edit(budget, first, dining, false);
		const second = await imported('2026-08-11', -1_200);
		expect(second).toMatchObject({ categoryId: null, approved: false });

		await edit(budget, second, dining, true);
		const exception = await imported('2026-08-12', -1_300);
		expect(exception).toMatchObject({ categoryId: dining, approved: false });

		await edit(budget, exception, groceries, false);
		expect(await imported('2026-08-13', -1_400)).toMatchObject({
			categoryId: dining,
			approved: false
		});

		await edit(budget, exception, groceries, true);
		expect(await imported('2026-08-14', -1_500)).toMatchObject({
			categoryId: groceries,
			approved: false
		});

		expect(Object.fromEntries((await rows()).map((row) => [row.date, row.categoryId]))).toEqual({
			'2026-08-10': dining,
			'2026-08-11': dining,
			'2026-08-12': groceries,
			'2026-08-13': dining,
			'2026-08-14': groceries
		});
	});
});

describe('Payee memory', () => {
	test('forgets a Category once it is deleted', async () => {
		const { owner, checking, dining, groceries, lastCategory } = await budgetWithChecking();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...lunch,
			categoryId: dining,
			rememberCategory: true
		});
		expect(await lastCategory('Sample Noodle Bar')).toBe(dining);

		await owner.mutation(api.categories.remove, { categoryId: dining, destinationId: groceries });

		expect(await lastCategory('Sample Noodle Bar')).toBeNull();
	});

	test("an import whose Payee has a memory arrives in the Payee's last Category", async () => {
		const { owner, checking, dining, rows, importCsv } = await budgetWithChecking();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...lunch,
			payee: 'SAMPLE NOODLE BAR 17',
			categoryId: dining,
			rememberCategory: true
		});

		await importCsv([{ date: '2026-08-20', amount: -2_100, bankText: 'SAMPLE NOODLE BAR 17' }]);

		expect((await rows())[0]).toMatchObject({
			amount: -2_100,
			payeeName: 'SAMPLE NOODLE BAR 17',
			categoryId: dining,
			approved: false
		});
	});

	test("never offers a card's Payment Category, by hand or on import", async () => {
		const { owner, checking, importCsv, lastCategory } = await budgetWithChecking();
		const card = await owner.mutation(api.accounts.create, {
			name: 'Sample Card',
			kind: 'creditCard',
			startingBalance: -20_000
		});
		const [startingRow] = (
			await owner.query(api.transactions.list, {
				accountId: card,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page;
		assert(startingRow?.categoryId, 'expected a starting row');
		const startingRowEditKeepingItsPaymentCategory = {
			transactionId: startingRow._id,
			accountId: card,
			date: startingRow.date,
			amount: startingRow.amount,
			payee: 'Starting Balance',
			categoryId: startingRow.categoryId,
			memo: 'Opening debt'
		};
		await owner.mutation(api.transactions.update, startingRowEditKeepingItsPaymentCategory);

		expect(await lastCategory('Starting Balance')).toBeNull();
		await importCsv([{ date: '2026-08-20', amount: 5_000, bankText: 'Starting Balance' }]);
		const [imported] = (
			await owner.query(api.transactions.list, {
				accountId: checking,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.amount === 5_000);
		expect(imported).toMatchObject({
			payeeName: 'Starting Balance',
			categoryId: null,
			approved: false
		});
	});
});

describe('rename memory', () => {
	async function renameFirstImport() {
		const budget = await budgetWithChecking();
		const { owner, checking, dining, rows, importCsv } = budget;
		await importCsv([{ date: '2026-08-12', amount: -1_200, bankText: 'SQ *SAMPLE NOODLE 0042' }]);
		const [imported] = await rows();
		assert(imported !== undefined, 'no import');
		await owner.mutation(api.transactions.update, {
			transactionId: imported._id,
			accountId: checking,
			date: imported.date,
			amount: imported.amount,
			payee: 'Sample Noodle Bar',
			categoryId: dining,
			memo: '',
			rememberCategory: true
		});
		return { ...budget, imported };
	}

	test('a second file with the same Bank Text arrives with the renamed Payee and its last Category', async () => {
		const { dining, rows, importCsv } = await renameFirstImport();

		await importCsv([{ date: '2026-08-19', amount: -1_350, bankText: 'SQ *SAMPLE NOODLE 0042' }]);

		expect(byDate(await rows(), '2026-08-19')).toMatchObject({
			payeeName: 'Sample Noodle Bar',
			categoryId: dining,
			cleared: true,
			approved: false,
			bankRows: [{ bankText: 'SQ *SAMPLE NOODLE 0042' }]
		});
	});

	test('one file with several Bank Texts for the same Payee gives each its rename and Category', async () => {
		const { owner, checking, dining, rows, importCsv } = await renameFirstImport();
		await importCsv([{ date: '2026-08-14', amount: -900, bankText: 'SAMPLE NOODLE ONLINE' }]);
		const online = byDate(await rows(), '2026-08-14');
		assert(online !== undefined, 'no import');
		await owner.mutation(api.transactions.update, {
			transactionId: online._id,
			accountId: checking,
			date: online.date,
			amount: online.amount,
			payee: 'Sample Noodle Bar',
			memo: ''
		});

		await importCsv([
			{ date: '2026-08-21', amount: -1_100, bankText: 'SQ *SAMPLE NOODLE 0042' },
			{ date: '2026-08-22', amount: -1_400, bankText: 'SAMPLE NOODLE ONLINE' },
			{ date: '2026-08-23', amount: -1_500, bankText: 'SQ *SAMPLE NOODLE 0042' }
		]);

		const after = await rows();
		for (const date of ['2026-08-21', '2026-08-22', '2026-08-23']) {
			expect(byDate(after, date)).toMatchObject({
				payeeName: 'Sample Noodle Bar',
				categoryId: dining
			});
		}
	});

	test('a Bank Text one character off gets no rename', async () => {
		const { rows, importCsv } = await renameFirstImport();

		await importCsv([{ date: '2026-08-19', amount: -1_350, bankText: 'SQ *SAMPLE NOODLE 0043' }]);

		expect(byDate(await rows(), '2026-08-19')).toMatchObject({
			payeeName: 'SQ *SAMPLE NOODLE 0043',
			categoryId: null
		});
	});

	test('renaming again updates what the Bank Text arrives as', async () => {
		const { owner, checking, groceries, imported, rows, importCsv } = await renameFirstImport();
		await owner.mutation(api.transactions.update, {
			transactionId: imported._id,
			accountId: checking,
			date: imported.date,
			amount: imported.amount,
			payee: 'Sample Noodle Market',
			categoryId: groceries,
			memo: '',
			rememberCategory: true
		});

		await importCsv([{ date: '2026-08-19', amount: -1_350, bankText: 'SQ *SAMPLE NOODLE 0042' }]);

		expect(byDate(await rows(), '2026-08-19')).toMatchObject({
			payeeName: 'Sample Noodle Market',
			categoryId: groceries
		});
	});

	test('a Transaction entered by hand, with no Bank Text, writes no rename', async () => {
		const { owner, checking, rows, importCsv } = await budgetWithChecking();
		const id = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...lunch,
			payee: 'SQ *SAMPLE NOODLE 0042'
		});
		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: checking,
			...lunch
		});

		await importCsv([{ date: '2026-08-25', amount: -999, bankText: 'SQ *SAMPLE NOODLE 0042' }]);

		expect(byDate(await rows(), '2026-08-25')).toMatchObject({
			payeeName: 'SQ *SAMPLE NOODLE 0042'
		});
	});

	test('Unmatching a Bank Row brings it back under its renamed Payee', async () => {
		const { owner, checking, dining, rows, importCsv } = await renameFirstImport();
		const handEntered = await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-20',
			amount: -1_500,
			payee: 'Lunch out',
			memo: ''
		});
		await importCsv([{ date: '2026-08-21', amount: -1_500, bankText: 'SQ *SAMPLE NOODLE 0042' }]);
		const matched = (await rows()).find((row) => row._id === handEntered);
		const importId = matched?.bankRows[0]?._id as Id<'imports'>;

		await owner.mutation(api.imports.unmatch, { importId });

		expect(byDate(await rows(), '2026-08-21')).toMatchObject({
			payeeName: 'Sample Noodle Bar',
			categoryId: dining
		});
	});
});
