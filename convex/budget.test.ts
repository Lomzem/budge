import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithCategories() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 300_000
	});
	const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
	const groceries = await owner.mutation(api.categories.create, {
		groupId: everyday,
		name: 'Groceries'
	});
	const rent = await owner.mutation(api.categories.create, { groupId: everyday, name: 'Rent' });
	const { readyToAssignId } = await owner.query(api.categories.list, {});
	if (readyToAssignId === null) throw new Error('Ready to Assign was not created.');

	const spend = (date: string, amount: number, categoryId?: Id<'categories'>) =>
		owner.mutation(api.transactions.create, {
			accountId: checking,
			date,
			amount,
			payee: 'Corner Grocer',
			...(categoryId === undefined ? {} : { categoryId }),
			memo: ''
		});
	const assign = (month: string, categoryId: Id<'categories'>, amount: number) =>
		owner.mutation(api.budget.setAssigned, { month, categoryId, amount });
	const view = (month: string, today = '2026-10-15') =>
		owner.query(api.budget.month, { month, today });
	return { ...backend, checking, everyday, groceries, rent, readyToAssignId, spend, assign, view };
}

describe('the budget query', () => {
	test('follows Transactions and Assigned edits across past and future months', async () => {
		const b = await budgetWithCategories();
		await b.assign('2026-08', b.groceries, 40_000);
		await b.assign('2026-08', b.rent, 150_000);
		await b.spend('2026-08-01', -150_000, b.rent);
		await b.spend('2026-08-10', -35_000, b.groceries);
		await b.spend('2026-09-12', -20_000, b.groceries);
		await b.assign('2026-10', b.groceries, 30_000);
		await b.spend('2026-10-05', 2_000, b.groceries);
		// Planning ahead: December's rent, and a paycheck that hasn't arrived.
		await b.assign('2026-12', b.rent, 150_000);
		await b.spend('2026-10-31', 230_000, b.readyToAssignId);
		const uncategorizedId = await b.spend('2026-10-12', -4_000);
		await b.spend('2026-10-20', 10_000);
		// Fixing a past month recalculates every later Available.
		await b.assign('2026-08', b.groceries, 45_000);

		expect(await b.view('2026-10')).toEqual({
			month: '2026-10',
			firstMonth: '2026-08',
			readyToAssign: { amount: -79_000, uncategorized: -4_000 },
			uncategorizedCount: 2,
			groups: [
				{
					id: b.everyday,
					name: 'Everyday',
					assigned: 30_000,
					activity: 2_000,
					available: 22_000,
					categories: [
						{
							id: b.groceries,
							name: 'Groceries',
							assigned: 30_000,
							activity: 2_000,
							available: 22_000,
							status: 'funded'
						},
						{
							id: b.rent,
							name: 'Rent',
							assigned: 0,
							activity: 0,
							available: 0,
							status: 'empty'
						}
					]
				}
			],
			overspent: []
		});
		expect((await b.view('2026-09')).overspent).toEqual([
			{ id: b.groceries, name: 'Groceries', available: -10_000 }
		]);

		// Payday: the paycheck and the Uncategorized inflow now count.
		const payday = await b.view('2026-12', '2026-10-31');
		expect(payday.readyToAssign).toEqual({ amount: 161_000, uncategorized: 6_000 });

		// Categorizing the Uncategorized outflow moves it from Ready to Assign to Groceries.
		await b.owner.mutation(api.transactions.update, {
			transactionId: uncategorizedId,
			accountId: b.checking,
			date: '2026-10-12',
			amount: -4_000,
			payee: 'Corner Grocer',
			categoryId: b.groceries,
			memo: ''
		});
		const afterCategorizing = await b.view('2026-12', '2026-10-31');
		expect(afterCategorizing.readyToAssign).toEqual({ amount: 165_000, uncategorized: 10_000 });
		expect(afterCategorizing.uncategorizedCount).toBe(1);
		expect(afterCategorizing.groups[0]?.categories.map((c) => c.available)).toEqual([
			18_000, 150_000
		]);
	});

	test('setting Assigned to 0 removes the row', async () => {
		const b = await budgetWithCategories();
		await b.assign('2026-10', b.groceries, 5_000);
		await b.assign('2026-10', b.groceries, 0);

		expect(await b.t.run((ctx) => ctx.db.query('assignments').collect())).toEqual([]);
		expect((await b.view('2026-10')).readyToAssign.amount).toBe(300_000);
	});

	test.each([
		['Ready to Assign', { month: '2026-10' }, 'readyToAssign'],
		['a month before the cutover month', { month: '2026-07' }, 'groceries'],
		['a month that is not YYYY-MM', { month: '2026-10-01' }, 'groceries'],
		['a fractional amount', { month: '2026-10', amount: 10.5 }, 'groceries']
	] as const)('Assigned refuses %s', async (_, change, target) => {
		const b = await budgetWithCategories();
		const categoryId = target === 'readyToAssign' ? b.readyToAssignId : b.groceries;

		expect(
			await publicErrorCode(
				b.owner.mutation(api.budget.setAssigned, { categoryId, amount: 5_000, ...change })
			)
		).toBe('INVALID_INPUT');
	});
});

describe('Categories', () => {
	test('list in their groups, ready for a Transaction to take', async () => {
		const b = await budgetWithCategories();
		const bills = await b.owner.mutation(api.categories.createGroup, { name: ' Bills ' });
		const phone = await b.owner.mutation(api.categories.create, { groupId: bills, name: 'Phone' });

		expect(await b.owner.query(api.categories.list, {})).toEqual({
			readyToAssignId: b.readyToAssignId,
			groups: [
				{
					_id: b.everyday,
					name: 'Everyday',
					categories: [
						{ _id: b.groceries, name: 'Groceries' },
						{ _id: b.rent, name: 'Rent' }
					]
				},
				{ _id: bills, name: 'Bills', categories: [{ _id: phone, name: 'Phone' }] }
			]
		});
	});

	test('cannot be added to the Ready to Assign system group', async () => {
		const b = await budgetWithCategories();
		const systemGroup = await b.t.run(
			async (ctx) => (await ctx.db.get('categories', b.readyToAssignId))?.groupId
		);
		if (systemGroup === undefined) throw new Error('No system group.');

		expect(
			await publicErrorCode(
				b.owner.mutation(api.categories.create, { groupId: systemGroup, name: 'Sneaky' })
			)
		).toBe('INVALID_INPUT');
	});

	test('show on the Transaction list, with none for Uncategorized', async () => {
		const b = await budgetWithCategories();
		await b.spend('2026-08-10', -35_000, b.groceries);
		await b.spend('2026-08-11', -500);

		const { page } = await b.owner.query(api.transactions.list, {
			accountId: b.checking,
			paginationOpts: { numItems: 10, cursor: null }
		});
		expect(page.map((row) => [row.payeeName, row.categoryName])).toEqual([
			['Corner Grocer', null],
			['Corner Grocer', 'Groceries'],
			['Starting Balance', 'Ready to Assign']
		]);
	});
});
