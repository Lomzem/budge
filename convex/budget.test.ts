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
					kind: 'normal',
					assigned: 30_000,
					activity: 2_000,
					available: 22_000,
					categories: [
						{
							id: b.groceries,
							name: 'Groceries',
							priorAvailable: -10_000,
							assigned: 30_000,
							activity: 2_000,
							available: 22_000,
							status: 'funded',
							target: null,
							payment: null
						},
						{
							id: b.rent,
							name: 'Rent',
							priorAvailable: 0,
							assigned: 0,
							activity: 0,
							available: 0,
							status: 'empty',
							target: null,
							payment: null
						}
					]
				}
			],
			hidden: [],
			overspent: [],
			upcoming: []
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

describe('moving money', () => {
	test('shifts Available between two Categories and leaves Ready to Assign unchanged', async () => {
		const b = await budgetWithCategories();
		await b.assign('2026-10', b.groceries, 40_000);
		await b.spend('2026-10-03', -35_000, b.groceries);
		const before = await b.view('2026-10');

		await b.owner.mutation(api.budget.moveMoney, {
			month: '2026-10',
			fromCategoryId: b.groceries,
			toCategoryId: b.rent,
			amount: 10_000
		});

		const after = await b.view('2026-10');
		expect(after.readyToAssign).toEqual(before.readyToAssign);
		expect(after.groups[0]?.categories).toMatchObject([
			{ name: 'Groceries', assigned: 30_000, available: -5_000 },
			{ name: 'Rent', assigned: 10_000, available: 10_000 }
		]);
	});

	interface Move {
		fromCategoryId: Id<'categories'>;
		toCategoryId: Id<'categories'>;
	}
	test.each([
		['to the same Category', (m: Move) => ({ toCategoryId: m.fromCategoryId })],
		['to Ready to Assign', (_: Move, rta: Id<'categories'>) => ({ toCategoryId: rta })],
		['from Ready to Assign', (_: Move, rta: Id<'categories'>) => ({ fromCategoryId: rta })],
		['of a zero amount', () => ({ amount: 0 })],
		['of a negative amount', () => ({ amount: -1_000 })],
		['before the cutover month', () => ({ month: '2026-07' })]
	])('refuses a move %s', async (_, change) => {
		const b = await budgetWithCategories();
		const move = { fromCategoryId: b.groceries, toCategoryId: b.rent };

		expect(
			await publicErrorCode(
				b.owner.mutation(api.budget.moveMoney, {
					month: '2026-10',
					amount: 1_000,
					...move,
					...change(move, b.readyToAssignId)
				})
			)
		).toBe('INVALID_INPUT');
	});
});

describe('Cover', () => {
	test('assigns exactly what brings Available back to zero, taken from Ready to Assign', async () => {
		const b = await budgetWithCategories();
		// September's overspending carries into October, which overspends again.
		await b.spend('2026-09-20', -20_000, b.groceries);
		await b.assign('2026-10', b.groceries, 5_000);
		await b.spend('2026-10-03', -2_000, b.groceries);
		const before = await b.view('2026-10');

		const covered = await b.owner.mutation(api.budget.cover, {
			month: '2026-10',
			categoryId: b.groceries
		});

		const after = await b.view('2026-10');
		expect(covered).toBe(17_000);
		expect(after.groups[0]?.categories[0]).toMatchObject({
			name: 'Groceries',
			assigned: 22_000,
			available: 0,
			status: 'empty'
		});
		expect(after.readyToAssign.amount).toBe(before.readyToAssign.amount - 17_000);
		expect(after.overspent).toEqual([]);
	});

	test('changes nothing once a Category is no longer overspent', async () => {
		const b = await budgetWithCategories();
		await b.assign('2026-10', b.groceries, 5_000);
		const before = await b.view('2026-10');

		expect(
			await b.owner.mutation(api.budget.cover, { month: '2026-10', categoryId: b.groceries })
		).toBe(0);
		expect(await b.view('2026-10')).toEqual(before);
	});

	test('refuses Ready to Assign', async () => {
		const b = await budgetWithCategories();

		expect(
			await publicErrorCode(
				b.owner.mutation(api.budget.cover, { month: '2026-10', categoryId: b.readyToAssignId })
			)
		).toBe('INVALID_INPUT');
	});
});

describe('Targets', () => {
	test('"Assign $X" assigns what the Target still needs, so it reads Funded', async () => {
		const b = await budgetWithCategories();
		await b.assign('2026-09', b.groceries, 15_000);
		await b.spend('2026-09-20', -5_000, b.groceries);
		await b.owner.mutation(api.categories.setTarget, {
			categoryId: b.groceries,
			target: { kind: 'monthly', amount: 40_000, mode: 'refill', dueDay: 20 }
		});
		const before = await b.view('2026-10');
		expect(before.groups[0]?.categories[0]).toMatchObject({
			name: 'Groceries',
			status: 'underfunded',
			target: { needed: 30_000 }
		});
		expect(before.upcoming).toEqual([
			{ id: b.groceries, name: 'Groceries', dueDate: '2026-10-20', amount: 40_000, funded: false }
		]);

		const assigned = await b.owner.mutation(api.budget.assignTarget, {
			month: '2026-10',
			categoryId: b.groceries
		});

		const after = await b.view('2026-10');
		expect(assigned).toBe(30_000);
		expect(after.groups[0]?.categories[0]).toMatchObject({
			assigned: 30_000,
			available: 40_000,
			status: 'funded',
			target: { needed: 0, progress: 1 }
		});
		expect(after.upcoming).toMatchObject([{ id: b.groceries, funded: true }]);
		expect(after.readyToAssign.amount).toBe(before.readyToAssign.amount - 30_000);
		// Nothing is left to assign.
		expect(
			await b.owner.mutation(api.budget.assignTarget, { month: '2026-10', categoryId: b.groceries })
		).toBe(0);
	});

	test('a repeating By date Target rolls to its next date only after its due month ends', async () => {
		const b = await budgetWithCategories();
		await b.owner.mutation(api.categories.setTarget, {
			categoryId: b.rent,
			target: { kind: 'byDate', amount: 12_000, firstDate: '2026-11-03', everyMonths: 3 }
		});
		for (const month of ['2026-10', '2026-11']) {
			await b.owner.mutation(api.budget.assignTarget, { month, categoryId: b.rent });
		}
		await b.spend('2026-11-03', -12_000, b.rent);

		const rentIn = async (month: string) =>
			(await b.view(month, '2026-11-25')).groups[0]?.categories[1];
		// Late in November the date has passed, but November is still its due month.
		expect(await rentIn('2026-11')).toMatchObject({
			name: 'Rent',
			assigned: 6_000,
			target: { dueDate: '2026-11-03', needed: 0 }
		});
		// December through February saves for the next date: $120 ÷ 3.
		expect(await rentIn('2026-12')).toMatchObject({
			target: { dueDate: '2027-02-03', needed: 4_000 }
		});
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
					hidden: false,
					categories: [
						{ _id: b.groceries, name: 'Groceries', hidden: false },
						{ _id: b.rent, name: 'Rent', hidden: false }
					]
				},
				{
					_id: bills,
					name: 'Bills',
					hidden: false,
					categories: [{ _id: phone, name: 'Phone', hidden: false }]
				}
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
