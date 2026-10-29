import { describe, expect, test } from 'vitest';

import { computeBudget, type BudgetInput } from './budget';

// A small budget: one Category Group with Groceries and Rent, plus Ready to Assign in its hidden
// system group. Amounts are cents.
type CategoryId = 'groceries' | 'rent' | 'readyToAssign';
type GroupId = 'everyday' | 'system';

function budget(
	change: Partial<BudgetInput<CategoryId, GroupId>> = {}
): BudgetInput<CategoryId, GroupId> {
	return {
		month: '2026-10',
		today: '2026-10-15',
		cutoverDate: '2026-08-01',
		groups: [
			{ id: 'system', name: 'Ready to Assign', position: 0, kind: 'readyToAssign' },
			{ id: 'everyday', name: 'Everyday', position: 1, kind: 'normal' }
		],
		categories: [
			{
				id: 'readyToAssign',
				groupId: 'system',
				name: 'Ready to Assign',
				position: 0,
				kind: 'readyToAssign'
			},
			{ id: 'rent', groupId: 'everyday', name: 'Rent', position: 1, kind: 'normal' },
			{ id: 'groceries', groupId: 'everyday', name: 'Groceries', position: 0, kind: 'normal' }
		],
		assignments: [],
		monthlyTotals: [],
		transactionsAfterToday: [],
		...change
	};
}

function category(result: ReturnType<typeof computeBudget>, name: string) {
	const found = result.groups.flatMap((group) => group.categories).find((c) => c.name === name);
	if (!found) throw new Error(`No Category named ${name}`);
	return found;
}

describe('Available', () => {
	test('is prior Available plus Assigned plus Activity, and a negative carries forward', () => {
		const input = budget({
			assignments: [
				{ month: '2026-08', categoryId: 'groceries', amount: 30_000 },
				{ month: '2026-10', categoryId: 'groceries', amount: 10_000 }
			],
			monthlyTotals: [
				{ month: '2026-08', bucket: 'groceries', amount: -20_000, count: 3 },
				// September overspends Groceries by $150; nothing resets it at month-end.
				{ month: '2026-09', bucket: 'groceries', amount: -25_000, count: 4 },
				{ month: '2026-10', bucket: 'groceries', amount: -2_000, count: 1 }
			]
		});

		expect(category(computeBudget({ ...input, month: '2026-09' }), 'Groceries')).toMatchObject({
			assigned: 0,
			activity: -25_000,
			available: -15_000
		});
		expect(category(computeBudget(input), 'Groceries')).toMatchObject({
			assigned: 10_000,
			activity: -2_000,
			available: -7_000
		});
	});
});

describe('Ready to Assign', () => {
	test('is the same in every month, and Assigned in a future month reduces it now', () => {
		const input = budget({
			monthlyTotals: [{ month: '2026-08', bucket: 'readyToAssign', amount: 300_000, count: 1 }],
			assignments: [
				{ month: '2026-08', categoryId: 'rent', amount: 145_000 },
				{ month: '2026-12', categoryId: 'groceries', amount: 20_000 }
			]
		});

		for (const month of ['2026-08', '2026-10', '2027-01']) {
			expect(computeBudget({ ...input, month }).readyToAssign.amount).toBe(135_000);
		}
	});

	test('counts future-dated income only once its date arrives', () => {
		const paycheck = { date: '2026-10-31', amount: 230_000, categoryId: 'readyToAssign' as const };
		// A future-dated outflow still counts now: money can't be spent twice.
		const bill = { date: '2026-10-20', amount: -5_000, categoryId: null };
		const input = budget({
			monthlyTotals: [
				{ month: '2026-08', bucket: 'readyToAssign', amount: 100_000, count: 1 },
				{ month: '2026-10', bucket: 'readyToAssign', amount: 230_000, count: 1 },
				{ month: '2026-10', bucket: 'uncategorized', amount: -5_000, count: 1 }
			],
			transactionsAfterToday: [paycheck, bill]
		});

		expect(computeBudget(input).readyToAssign.amount).toBe(95_000);
		expect(computeBudget({ ...input, today: '2026-10-31' }).readyToAssign.amount).toBe(325_000);
	});
});

test('a refund to a normal Category adds to that Category, not to Ready to Assign', () => {
	const result = computeBudget(
		budget({
			monthlyTotals: [
				{ month: '2026-08', bucket: 'readyToAssign', amount: 100_000, count: 1 },
				{ month: '2026-10', bucket: 'groceries', amount: 1_250, count: 1 }
			],
			transactionsAfterToday: []
		})
	);

	expect(category(result, 'Groceries')).toMatchObject({ activity: 1_250, available: 1_250 });
	expect(result.readyToAssign.amount).toBe(100_000);
});

describe('Uncategorized Transactions', () => {
	const categorized = budget({
		monthlyTotals: [
			{ month: '2026-09', bucket: 'readyToAssign', amount: 230_000, count: 1 },
			{ month: '2026-10', bucket: 'readyToAssign', amount: -4_000, count: 1 },
			{ month: '2026-10', bucket: 'readyToAssign', amount: 50_000, count: 1 }
		],
		transactionsAfterToday: [{ date: '2026-10-28', amount: 50_000, categoryId: 'readyToAssign' }]
	});
	const uncategorized = budget({
		monthlyTotals: [
			{ month: '2026-09', bucket: 'readyToAssign', amount: 230_000, count: 1 },
			{ month: '2026-10', bucket: 'uncategorized', amount: -4_000, count: 1 },
			{ month: '2026-10', bucket: 'uncategorized', amount: 50_000, count: 1 }
		],
		transactionsAfterToday: [{ date: '2026-10-28', amount: 50_000, categoryId: null }]
	});

	test('count exactly as if categorized to Ready to Assign', () => {
		expect(computeBudget(uncategorized).readyToAssign.amount).toBe(
			computeBudget(categorized).readyToAssign.amount
		);
		expect(computeBudget(uncategorized).readyToAssign.amount).toBe(226_000);
	});

	test('are reported as the part of Ready to Assign they make up, and counted', () => {
		const result = computeBudget(uncategorized);

		expect(result.readyToAssign.uncategorized).toBe(-4_000);
		expect(result.uncategorizedCount).toBe(2);
		expect(computeBudget(categorized)).toMatchObject({
			readyToAssign: { uncategorized: 0 },
			uncategorizedCount: 0
		});
	});
});

test('groups show their totals, and overspent Categories are listed in table order', () => {
	const result = computeBudget(
		budget({
			assignments: [
				{ month: '2026-10', categoryId: 'rent', amount: 145_000 },
				{ month: '2026-10', categoryId: 'groceries', amount: 20_000 }
			],
			monthlyTotals: [
				{ month: '2026-10', bucket: 'rent', amount: -150_000, count: 1 },
				{ month: '2026-10', bucket: 'groceries', amount: -6_000, count: 2 }
			]
		})
	);

	expect(result.groups).toEqual([
		{
			id: 'everyday',
			name: 'Everyday',
			assigned: 165_000,
			activity: -156_000,
			available: 9_000,
			categories: [
				{
					id: 'groceries',
					name: 'Groceries',
					assigned: 20_000,
					activity: -6_000,
					available: 14_000,
					status: 'funded'
				},
				{
					id: 'rent',
					name: 'Rent',
					assigned: 145_000,
					activity: -150_000,
					available: -5_000,
					status: 'overspent'
				}
			]
		}
	]);
	expect(result.overspent).toEqual([{ id: 'rent', name: 'Rent', available: -5_000 }]);
});

test('a Category with nothing Available has no funding status', () => {
	expect(category(computeBudget(budget()), 'Rent').status).toBe('empty');
});

test('the budget starts in the cutover month', () => {
	expect(computeBudget(budget()).firstMonth).toBe('2026-08');
	expect(computeBudget(budget({ cutoverDate: null })).firstMonth).toBeNull();
});

describe('the cash invariant', () => {
	/** A small seeded generator, so a failing sequence can be replayed. */
	function random(seed: number) {
		let state = seed;
		const next = () => {
			state = (Math.imul(state, 1_103_515_245) + 12_345) & 0x7fffffff;
			return state / 2_147_483_648;
		};
		return {
			int: (below: number) => Math.floor(next() * below),
			pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
		};
	}

	const months = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
	const buckets = ['groceries', 'rent', 'readyToAssign', null] as const;

	// Cash Accounts only; Credit Card Accounts join the invariant with their Payment Categories.
	test.each([1, 2, 3, 4, 5, 6, 7, 8])(
		'cash = Ready to Assign + every Available after any edits (sequence %i)',
		(seed) => {
			const rand = random(seed);
			const transactions: { date: string; amount: number; categoryId: CategoryId | null }[] = [];
			const assigned = new Map<string, number>();

			// Every Transaction has happened by now.
			const today = '2027-01-01';
			const check = () => {
				const totals = new Map<string, { amount: number; count: number }>();
				for (const t of transactions) {
					const key = `${t.date.slice(0, 7)}|${t.categoryId ?? 'uncategorized'}`;
					const row = totals.get(key) ?? { amount: 0, count: 0 };
					row.amount += t.amount;
					row.count += 1;
					totals.set(key, row);
				}
				const input = budget({
					today,
					month: '2026-12',
					assignments: [...assigned].map(([key, amount]) => {
						const [month = '', categoryId] = key.split('|');
						return { month, categoryId: categoryId as CategoryId, amount };
					}),
					monthlyTotals: [...totals].map(([key, row]) => {
						const [month = '', bucket] = key.split('|');
						return { month, bucket: bucket as CategoryId | 'uncategorized', ...row };
					})
				});

				const cash = transactions.reduce((total, t) => total + t.amount, 0);
				const result = computeBudget(input);
				const available = result.groups.reduce((total, group) => total + group.available, 0);
				expect(result.readyToAssign.amount + available).toBe(cash);
				expect(computeBudget({ ...input, month: '2026-09' }).readyToAssign).toEqual(
					result.readyToAssign
				);
			};

			for (let step = 0; step < 60; step++) {
				const action = transactions.length === 0 ? 0 : rand.int(4);
				const entry = () => ({
					date: `${rand.pick(months)}-${String(1 + rand.int(28)).padStart(2, '0')}`,
					amount: rand.int(200_000) - 120_000,
					categoryId: rand.pick(buckets)
				});
				if (action === 0) transactions.push(entry());
				else if (action === 1) transactions[rand.int(transactions.length)] = entry();
				else if (action === 2) transactions.splice(rand.int(transactions.length), 1);
				// Setting Assigned, sometimes back to zero.
				else
					assigned.set(
						`${rand.pick(months)}|${rand.pick(['groceries', 'rent'])}`,
						rand.pick([0, 5_000, 40_000, 125_000])
					);
				// After every edit, not only at the end.
				check();
			}
		}
	);
});
