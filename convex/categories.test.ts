import { describe, expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function startBudget() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 500_000
	});
	const savings = await owner.mutation(api.accounts.create, {
		name: 'Savings',
		kind: 'cash',
		startingBalance: 100_000
	});
	const everyday = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
	const groceries = await owner.mutation(api.categories.create, {
		groupId: everyday,
		name: 'Groceries'
	});
	const { readyToAssignId } = await owner.query(api.categories.list, {});
	if (readyToAssignId === null) throw new Error('Ready to Assign was not created.');
	return { ...backend, checking, savings, everyday, groceries, readyToAssignId };
}

type Budget = Awaited<ReturnType<typeof startBudget>>;

/** The groups and Categories as the owner manages them, by name. */
async function layout(b: Budget) {
	const { groups } = await b.owner.query(api.categories.list, {});
	return groups.map((g) => ({
		name: g.name,
		hidden: g.hidden,
		categories: g.categories.map((c) => (c.hidden ? `${c.name} (hidden)` : c.name))
	}));
}

/**
 * Months of Assigned amounts and Transactions, some for `dining` and some for Groceries. When
 * `dining` is Groceries, its Assigned amounts are added to Groceries' in the same month.
 */
async function enterHistory(b: Budget, dining: Id<'categories'>) {
	const assigned = new Map<string, number>();
	const assign = (month: string, categoryId: Id<'categories'>, amount: number) => {
		const key = `${month}|${categoryId}`;
		assigned.set(key, (assigned.get(key) ?? 0) + amount);
	};
	assign('2026-08', b.groceries, 40_000);
	assign('2026-08', dining, 9_000);
	// September has Dining but no Groceries row, so a row moves across whole.
	assign('2026-09', dining, 12_000);
	// October's rows cancel, so the summed row is zero.
	assign('2026-10', b.groceries, 5_000);
	assign('2026-10', dining, -5_000);
	assign('2026-12', dining, 7_500);
	for (const [key, amount] of assigned) {
		const [month = '', categoryId] = key.split('|');
		await b.owner.mutation(api.budget.setAssigned, {
			month,
			categoryId: categoryId as Id<'categories'>,
			amount
		});
	}

	const spend = (
		accountId: Id<'accounts'>,
		date: string,
		amount: number,
		categoryId: Id<'categories'>
	) =>
		b.owner.mutation(api.transactions.create, {
			accountId,
			date,
			amount,
			payee: 'Sample Noodle Bar',
			categoryId,
			memo: ''
		});
	await spend(b.checking, '2026-08-04', -3_100, dining);
	await spend(b.checking, '2026-08-20', -35_000, b.groceries);
	await spend(b.savings, '2026-09-02', -19_900, dining);
	await spend(b.checking, '2026-09-15', -2_000, b.groceries);
	await spend(b.checking, '2026-10-01', 1_200, dining);
	await spend(b.checking, '2026-11-20', -4_400, dining);
}

/** Groceries and Ready to Assign in each month from August to January. */
async function groceriesByMonth(b: Budget) {
	const months = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];
	return await Promise.all(
		months.map(async (month) => {
			const view = await b.owner.query(api.budget.month, { month, today: '2026-11-25' });
			const row = view.groups.flatMap((g) => g.categories).find((c) => c.id === b.groceries);
			if (!row) throw new Error('Groceries is missing.');
			const { name, assigned, activity, available, status } = row;
			return {
				month,
				readyToAssign: view.readyToAssign,
				groceries: { name, assigned, activity, available, status }
			};
		})
	);
}

async function readTotals(b: Budget) {
	return await b.t.run(async (ctx) =>
		(await ctx.db.query('monthlyTotals').collect())
			.map(({ month, accountId, bucket, amount, count }) => ({
				month,
				accountId,
				bucket,
				amount,
				count
			}))
			.sort((x, y) =>
				`${x.month}${x.accountId}${x.bucket}`.localeCompare(`${y.month}${y.accountId}${y.bucket}`)
			)
	);
}

describe('deleting a Category', () => {
	test('leaves every month as if its history had been in the destination all along', async () => {
		const deleted = await startBudget();
		const dining = await deleted.owner.mutation(api.categories.create, {
			groupId: deleted.everyday,
			name: 'Dining Out'
		});
		await enterHistory(deleted, dining);
		await deleted.owner.mutation(api.categories.remove, {
			categoryId: dining,
			destinationId: deleted.groceries
		});

		const allAlong = await startBudget();
		await enterHistory(allAlong, allAlong.groceries);

		expect(await groceriesByMonth(deleted)).toEqual(await groceriesByMonth(allAlong));
		expect(await layout(deleted)).toEqual([
			{ name: 'Everyday', hidden: false, categories: ['Groceries'] }
		]);
		const kept = await readTotals(deleted);
		await deleted.t.mutation(internal.monthlyTotals.rebuild, {});
		expect(await readTotals(deleted)).toEqual(kept);
	});

	test('rebuilds the totals it touches from the Transactions, not the cache', async () => {
		const b = await startBudget();
		const dining = await b.owner.mutation(api.categories.create, {
			groupId: b.everyday,
			name: 'Dining Out'
		});
		await enterHistory(b, dining);
		// The cache has drifted for both Categories where Dining Out has history: August in
		// Checking holds both.
		await b.t.run(async (ctx) => {
			for (const row of await ctx.db.query('monthlyTotals').collect()) {
				const touched =
					row.bucket === dining ||
					(row.bucket === b.groceries && row.month === '2026-08' && row.accountId === b.checking);
				if (touched) await ctx.db.patch('monthlyTotals', row._id, { amount: row.amount + 999 });
			}
		});
		await b.owner.mutation(api.categories.remove, {
			categoryId: dining,
			destinationId: b.groceries
		});

		const kept = await readTotals(b);
		await b.t.mutation(internal.monthlyTotals.rebuild, {});
		expect(kept).toEqual(await readTotals(b));
	});
});

describe('deleting a Category Group', () => {
	test('moves its Categories, with their history, to the end of the group picked', async () => {
		const b = await startBudget();
		const fun = await b.owner.mutation(api.categories.createGroup, { name: 'Fun' });
		const games = await b.owner.mutation(api.categories.create, { groupId: fun, name: 'Games' });
		await b.owner.mutation(api.categories.create, { groupId: fun, name: 'Concerts' });
		await b.owner.mutation(api.budget.setAssigned, {
			month: '2026-09',
			categoryId: games,
			amount: 6_000
		});

		expect(
			await publicErrorCode(b.owner.mutation(api.categories.removeGroup, { groupId: fun }))
		).toBe('INVALID_INPUT');
		await b.owner.mutation(api.categories.removeGroup, {
			groupId: fun,
			destinationGroupId: b.everyday
		});

		expect(await layout(b)).toEqual([
			{ name: 'Everyday', hidden: false, categories: ['Groceries', 'Games', 'Concerts'] }
		]);
		const september = await b.owner.query(api.budget.month, {
			month: '2026-09',
			today: '2026-09-15'
		});
		expect(september.groups[0]?.categories[1]).toMatchObject({ name: 'Games', available: 6_000 });
	});

	test('with no Categories needs no destination', async () => {
		const b = await startBudget();
		const empty = await b.owner.mutation(api.categories.createGroup, { name: 'Someday' });
		await b.owner.mutation(api.categories.removeGroup, { groupId: empty });
		expect((await layout(b)).map((g) => g.name)).toEqual(['Everyday']);
	});
});

test('renaming trims the name and refuses a blank one', async () => {
	const b = await startBudget();
	await b.owner.mutation(api.categories.rename, { categoryId: b.groceries, name: ' Food ' });
	await b.owner.mutation(api.categories.renameGroup, { groupId: b.everyday, name: 'Daily' });
	expect(
		await publicErrorCode(
			b.owner.mutation(api.categories.rename, { categoryId: b.groceries, name: '  ' })
		)
	).toBe('INVALID_INPUT');
	expect(await layout(b)).toEqual([{ name: 'Daily', hidden: false, categories: ['Food'] }]);
});

describe('reordering', () => {
	test('moves a Category within its group or into another', async () => {
		const b = await startBudget();
		const bills = await b.owner.mutation(api.categories.createGroup, { name: 'Bills' });
		const rent = await b.owner.mutation(api.categories.create, { groupId: bills, name: 'Rent' });
		await b.owner.mutation(api.categories.create, { groupId: bills, name: 'Phone' });
		const coffee = await b.owner.mutation(api.categories.create, {
			groupId: b.everyday,
			name: 'Coffee'
		});

		await b.owner.mutation(api.categories.move, {
			categoryId: coffee,
			groupId: b.everyday,
			index: 0
		});
		expect((await layout(b))[0]?.categories).toEqual(['Coffee', 'Groceries']);

		await b.owner.mutation(api.categories.move, {
			categoryId: rent,
			groupId: b.everyday,
			index: 1
		});
		expect(await layout(b)).toEqual([
			{ name: 'Everyday', hidden: false, categories: ['Coffee', 'Rent', 'Groceries'] },
			{ name: 'Bills', hidden: false, categories: ['Phone'] }
		]);

		// An index past the end puts it last.
		await b.owner.mutation(api.categories.move, {
			categoryId: coffee,
			groupId: b.everyday,
			index: 9
		});
		expect((await layout(b))[0]?.categories).toEqual(['Rent', 'Groceries', 'Coffee']);
	});

	test('moves a Category Group', async () => {
		const b = await startBudget();
		await b.owner.mutation(api.categories.createGroup, { name: 'Bills' });
		await b.owner.mutation(api.categories.createGroup, { name: 'Goals' });
		await b.owner.mutation(api.categories.moveGroup, { groupId: b.everyday, index: 2 });
		expect((await layout(b)).map((g) => g.name)).toEqual(['Bills', 'Goals', 'Everyday']);
	});
});

test('hiding takes a Category or group out of the budget table, and unhiding brings it back', async () => {
	const b = await startBudget();
	await b.owner.mutation(api.budget.setAssigned, {
		month: '2026-10',
		categoryId: b.groceries,
		amount: 25_000
	});
	const view = () => b.owner.query(api.budget.month, { month: '2026-10', today: '2026-10-15' });
	const before = await view();

	await b.owner.mutation(api.categories.setHidden, { categoryId: b.groceries, hidden: true });
	const hidden = await view();
	expect(hidden.groups[0]?.categories).toEqual([]);
	expect(hidden.hidden).toMatchObject([{ name: 'Groceries', available: 25_000 }]);
	expect(hidden.readyToAssign).toEqual(before.readyToAssign);
	expect(await layout(b)).toEqual([
		{ name: 'Everyday', hidden: false, categories: ['Groceries (hidden)'] }
	]);

	await b.owner.mutation(api.categories.setHidden, { categoryId: b.groceries, hidden: false });
	await b.owner.mutation(api.categories.setGroupHidden, { groupId: b.everyday, hidden: true });
	expect((await view()).groups).toEqual([]);
	expect((await layout(b))[0]?.hidden).toBe(true);

	await b.owner.mutation(api.categories.setGroupHidden, { groupId: b.everyday, hidden: false });
	expect(await view()).toEqual(before);
});

test('Budge manages Ready to Assign and its group, so the owner cannot change them', async () => {
	const b = await startBudget();
	const systemGroup = await b.t.run(async (ctx) => {
		const category = await ctx.db.get('categories', b.readyToAssignId);
		if (category === null) throw new Error('Ready to Assign is missing.');
		return category.groupId;
	});
	const rta = b.readyToAssignId;
	const attempts = [
		b.owner.mutation(api.categories.rename, { categoryId: rta, name: 'Mine' }),
		b.owner.mutation(api.categories.move, { categoryId: rta, groupId: b.everyday, index: 0 }),
		b.owner.mutation(api.categories.move, {
			categoryId: b.groceries,
			groupId: systemGroup,
			index: 0
		}),
		b.owner.mutation(api.categories.setHidden, { categoryId: rta, hidden: true }),
		b.owner.mutation(api.categories.remove, { categoryId: rta, destinationId: b.groceries }),
		b.owner.mutation(api.categories.remove, { categoryId: b.groceries, destinationId: rta }),
		b.owner.mutation(api.categories.renameGroup, { groupId: systemGroup, name: 'Mine' }),
		b.owner.mutation(api.categories.moveGroup, { groupId: systemGroup, index: 0 }),
		b.owner.mutation(api.categories.setGroupHidden, { groupId: systemGroup, hidden: true }),
		b.owner.mutation(api.categories.removeGroup, {
			groupId: b.everyday,
			destinationGroupId: systemGroup
		}),
		b.owner.mutation(api.categories.removeGroup, { groupId: systemGroup })
	];
	for (const attempt of attempts) expect(await publicErrorCode(attempt)).toBe('INVALID_INPUT');
	expect(await layout(b)).toEqual([{ name: 'Everyday', hidden: false, categories: ['Groceries'] }]);
	expect((await b.owner.query(api.categories.list, {})).readyToAssignId).toBe(rta);
});

describe('a Target', () => {
	const groceriesIn = async (b: Budget) =>
		(await b.owner.query(api.budget.month, { month: '2026-10', today: '2026-10-15' })).groups[0]
			?.categories[0];

	test('can be set, edited, switched to another kind, and cleared', async () => {
		const b = await startBudget();
		const setTarget = (
			target: Parameters<typeof b.owner.mutation<typeof api.categories.setTarget>>[1]['target']
		) => b.owner.mutation(api.categories.setTarget, { categoryId: b.groceries, target });

		await setTarget({ kind: 'monthly', amount: 50_000, mode: 'refill', dueDay: 1 });
		expect(await groceriesIn(b)).toMatchObject({
			target: { definition: { kind: 'monthly', amount: 50_000, mode: 'refill', dueDay: 1 } }
		});

		await setTarget({ kind: 'monthly', amount: 20_000, mode: 'setAside' });
		expect((await groceriesIn(b))?.target?.definition).toEqual({
			kind: 'monthly',
			amount: 20_000,
			mode: 'setAside'
		});

		await setTarget({ kind: 'byDate', amount: 13_900, firstDate: '2027-03-03' });
		expect((await groceriesIn(b))?.target?.definition).toEqual({
			kind: 'byDate',
			amount: 13_900,
			firstDate: '2027-03-03'
		});

		await setTarget(null);
		expect(await groceriesIn(b)).toMatchObject({ target: null });
	});

	test.each([
		['no amount', { kind: 'monthly', amount: 0, mode: 'refill' }],
		['a fraction of a cent', { kind: 'monthly', amount: 10.5, mode: 'refill' }],
		['a due day past 31', { kind: 'monthly', amount: 5_000, mode: 'refill', dueDay: 32 }],
		['a due day of 0', { kind: 'monthly', amount: 5_000, mode: 'refill', dueDay: 0 }],
		['a date that does not exist', { kind: 'byDate', amount: 5_000, firstDate: '2027-02-30' }],
		[
			'a repeat of no months',
			{ kind: 'byDate', amount: 5_000, firstDate: '2027-02-03', everyMonths: 0 }
		],
		[
			'a repeat of part of a month',
			{ kind: 'byDate', amount: 5_000, firstDate: '2027-02-03', everyMonths: 1.5 }
		]
	] as const)('refuses %s', async (_, target) => {
		const b = await startBudget();

		expect(
			await publicErrorCode(
				b.owner.mutation(api.categories.setTarget, { categoryId: b.groceries, target })
			)
		).toBe('INVALID_INPUT');
		expect(await groceriesIn(b)).toMatchObject({ target: null });
	});

	test('cannot be given to Ready to Assign', async () => {
		const b = await startBudget();

		expect(
			await publicErrorCode(
				b.owner.mutation(api.categories.setTarget, {
					categoryId: b.readyToAssignId,
					target: { kind: 'monthly', amount: 5_000, mode: 'refill' }
				})
			)
		).toBe('INVALID_INPUT');
	});
});
