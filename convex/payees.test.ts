import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithChecking() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 100_000
	});
	const groupId = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
	const dining = await owner.mutation(api.categories.create, { groupId, name: 'Dining' });
	const groceries = await owner.mutation(api.categories.create, { groupId, name: 'Groceries' });
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

// Invented Payees, Bank Text, and amounts.
const lunch = { date: '2026-08-10', amount: -1_850, payee: 'Sample Noodle Bar', memo: '' };

describe('Payee memory', () => {
	test("remembers the Category a Payee's Transaction was last given", async () => {
		const { owner, checking, dining, groceries, lastCategory } = await budgetWithChecking();

		expect(await lastCategory('Sample Noodle Bar')).toBeNull();
		const id = await owner.mutation(api.transactions.create, {
			accountId: checking,
			...lunch,
			categoryId: dining
		});
		expect(await lastCategory('Sample Noodle Bar')).toBe(dining);
		expect(await lastCategory('  Sample Noodle Bar ')).toBe(dining);

		await owner.mutation(api.transactions.update, {
			transactionId: id,
			accountId: checking,
			...lunch,
			categoryId: groceries
		});
		expect(await lastCategory('Sample Noodle Bar')).toBe(groceries);
	});

	test('an Uncategorized Transaction leaves the memory alone', async () => {
		const { owner, checking, dining, lastCategory } = await budgetWithChecking();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...lunch,
			categoryId: dining
		});

		await owner.mutation(api.transactions.create, { accountId: checking, ...lunch });

		expect(await lastCategory('Sample Noodle Bar')).toBe(dining);
	});

	test('forgets a Category once it is deleted', async () => {
		const { owner, checking, dining, groceries, lastCategory } = await budgetWithChecking();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...lunch,
			categoryId: dining
		});

		await owner.mutation(api.categories.remove, { categoryId: dining, destinationId: groceries });

		expect(await lastCategory('Sample Noodle Bar')).toBeNull();
	});

	test("an import whose Payee has a memory arrives in the Payee's last Category", async () => {
		const { owner, checking, dining, rows, importCsv } = await budgetWithChecking();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			...lunch,
			payee: 'SAMPLE NOODLE BAR 17',
			categoryId: dining
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
		if (!startingRow?.categoryId) throw new Error('expected a starting row');
		// Editing the card's starting row keeps its Payment Category, and Budge remembers that.
		await owner.mutation(api.transactions.update, {
			transactionId: startingRow._id,
			accountId: card,
			date: startingRow.date,
			amount: startingRow.amount,
			payee: 'Starting Balance',
			categoryId: startingRow.categoryId,
			memo: 'Opening debt'
		});

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
		if (imported === undefined) throw new Error('no import');
		await owner.mutation(api.transactions.update, {
			transactionId: imported._id,
			accountId: checking,
			date: imported.date,
			amount: imported.amount,
			payee: 'Sample Noodle Bar',
			categoryId: dining,
			memo: ''
		});
		return { ...budget, imported };
	}

	const byDate = (rows: { date: string }[], date: string) => rows.find((row) => row.date === date);

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
			memo: ''
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
