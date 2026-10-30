import { describe, expect, test } from 'vitest';

import { readAllPages } from '../src/lib/domain/pages';
import { api } from './_generated/api';
import type { MutationCtx } from './_generated/server';
import schema from './schema';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

// One row in every table the export must cover. A table added to the schema fails the coverage
// test until it gets a row here, so its export (and any secret it holds) is checked.
async function seedEveryTable(ctx: MutationCtx) {
	await ctx.db.insert('settings', { cutoverDate: '2026-08-01' });
	const accountId = await ctx.db.insert('accounts', {
		name: 'Checking',
		kind: 'cash',
		position: 0
	});
	const groupId = await ctx.db.insert('categoryGroups', {
		name: 'Bills',
		position: 0,
		kind: 'normal'
	});
	const categoryId = await ctx.db.insert('categories', {
		groupId,
		name: 'Rent',
		position: 0,
		kind: 'normal',
		target: { kind: 'monthly', amount: 120_000, mode: 'refill' }
	});
	await ctx.db.insert('assignments', { month: '2026-08', categoryId, amount: 120_000 });
	const payeeId = await ctx.db.insert('payees', { name: 'Landlord', lastCategoryId: categoryId });
	await ctx.db.insert('payeeRenames', { bankText: 'SAMPLE LANDLORD RENT', payeeId });
	const transactionId = await ctx.db.insert('transactions', {
		accountId,
		date: '2026-08-02',
		amount: -120_000,
		payeeId,
		categoryId,
		memo: 'August',
		cleared: 'cleared'
	});
	await ctx.db.insert('imports', {
		source: 'qfx',
		sourceId: 'SAMPLE-0001',
		accountId,
		date: '2026-08-02',
		amount: -120_000,
		bankText: 'SAMPLE LANDLORD RENT',
		transactionId,
		matched: true,
		state: 'linked'
	});
	await ctx.db.insert('monthlyTotals', {
		month: '2026-08',
		accountId,
		bucket: categoryId,
		amount: -120_000,
		count: 1
	});
}

const seededTables = [
	'settings',
	'accounts',
	'categoryGroups',
	'categories',
	'assignments',
	'payees',
	'payeeRenames',
	'transactions',
	'imports'
];

function keysAnywhere(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap(keysAnywhere);
	if (value !== null && typeof value === 'object') {
		return Object.entries(value).flatMap(([key, inner]) => [key, ...keysAnywhere(inner)]);
	}
	return [];
}

type Owner = ReturnType<typeof newBackend>['owner'];

// What the export dialog does: every page of every exportable table, a few rows at a time.
async function exportAll(owner: Owner, numItems = 2) {
	const exported: Record<string, unknown[]> = {};
	for (const table of await owner.query(api.export.tables, {})) {
		exported[table] = await readAllPages(
			(paginationOpts) => owner.query(api.export.page, { table, paginationOpts }),
			{ numItems }
		);
	}
	return exported;
}

describe('the export', () => {
	test('covers every table but the rebuildable monthly totals', async () => {
		const { t, owner } = newBackend();
		await t.run(seedEveryTable);

		const exported = await exportAll(owner);

		expect([...seededTables, 'monthlyTotals'].sort()).toEqual(Object.keys(schema.tables).sort());
		expect(Object.keys(exported).sort()).toEqual([...seededTables].sort());
		for (const table of seededTables) {
			expect(exported[table], table).toHaveLength(1);
		}
		expect(exported.transactions?.[0]).toMatchObject({
			date: '2026-08-02',
			amount: -120_000,
			memo: 'August',
			cleared: 'cleared'
		});
		expect(exported.categories?.[0]).toMatchObject({
			target: { kind: 'monthly', amount: 120_000, mode: 'refill' }
		});
	});

	test('reads a table across pages without losing or repeating a row', async () => {
		const { t, owner } = newBackend();
		await t.run(async (ctx) => {
			for (const name of ['Grocer', 'Landlord', 'Utility', 'Cafe', 'Gym']) {
				await ctx.db.insert('payees', { name });
			}
		});

		const exported = await exportAll(owner, 2);

		expect((exported.payees as { name: string }[]).map((payee) => payee.name).sort()).toEqual([
			'Cafe',
			'Grocer',
			'Gym',
			'Landlord',
			'Utility'
		]);
	});

	test('splits a page too large to read at once, losing and repeating no row', async () => {
		const { t, owner } = newBackend();
		// Six memos near a document's size limit outweigh one page's byte limit.
		const memo = 'x'.repeat(800_000);
		await t.run(async (ctx) => {
			const accountId = await ctx.db.insert('accounts', {
				name: 'Checking',
				kind: 'cash',
				position: 0
			});
			for (let day = 1; day <= 6; day++) {
				await ctx.db.insert('transactions', {
					accountId,
					date: `2026-08-0${String(day)}`,
					amount: -day,
					memo,
					cleared: 'uncleared'
				});
			}
		});

		const exported = await exportAll(owner, 500);

		expect((exported.transactions as { amount: number }[]).map((row) => row.amount)).toEqual([
			-1, -2, -3, -4, -5, -6
		]);
	});

	test('refuses the rebuildable monthly totals', async () => {
		const { owner } = newBackend();

		await expect(
			owner.query(api.export.page, {
				table: 'monthlyTotals',
				paginationOpts: { numItems: 10, cursor: null }
			})
		).rejects.toThrow();
	});

	test('holds no Bank Connection provider field or token', async () => {
		const { t, owner } = newBackend();
		await t.run(seedEveryTable);

		const keys = keysAnywhere(await exportAll(owner));

		expect(keys).not.toContain('provider');
		expect(keys.filter((key) => /token/i.test(key))).toEqual([]);
	});

	test('lists an empty table as empty', async () => {
		const { owner } = newBackend();

		const exported = await exportAll(owner);

		expect(exported.accounts).toEqual([]);
		expect(exported.transactions).toEqual([]);
	});
});
