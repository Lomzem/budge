import { describe, expect, test } from 'vitest';

import { computeBudget, type BudgetInput, type Target } from './budget';

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

test('a Category is left over from last month with what it had Available then', () => {
	const input = budget({
		assignments: [
			{ month: '2026-08', categoryId: 'groceries', amount: 30_000 },
			{ month: '2026-10', categoryId: 'groceries', amount: 10_000 },
			{ month: '2026-10', categoryId: 'rent', amount: 145_000 }
		],
		monthlyTotals: [
			{ month: '2026-08', bucket: 'groceries', amount: -45_000, count: 2 },
			{ month: '2026-10', bucket: 'groceries', amount: -2_000, count: 1 }
		]
	});

	expect(category(computeBudget(input), 'Groceries')).toMatchObject({
		priorAvailable: -15_000,
		assigned: 10_000,
		activity: -2_000,
		available: -7_000
	});
	expect(category(computeBudget(input), 'Rent')).toMatchObject({ priorAvailable: 0 });
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
					priorAvailable: 0,
					assigned: 20_000,
					activity: -6_000,
					available: 14_000,
					status: 'funded',
					target: null
				},
				{
					id: 'rent',
					name: 'Rent',
					priorAvailable: 0,
					assigned: 145_000,
					activity: -150_000,
					available: -5_000,
					status: 'overspent',
					target: null
				}
			]
		}
	]);
	expect(result.overspent).toEqual([{ id: 'rent', name: 'Rent', available: -5_000 }]);
});

describe('a hidden Category', () => {
	const spending = {
		assignments: [
			{ month: '2026-10', categoryId: 'rent', amount: 145_000 },
			{ month: '2026-10', categoryId: 'groceries', amount: 20_000 }
		],
		monthlyTotals: [
			{ month: '2026-10', bucket: 'rent', amount: -150_000, count: 1 },
			{ month: '2026-10', bucket: 'groceries', amount: -6_000, count: 2 }
		]
	} satisfies Partial<BudgetInput<CategoryId, GroupId>>;
	const shown = budget(spending);
	const rentHidden = budget({
		...spending,
		categories: shown.categories.map((c) => (c.id === 'rent' ? { ...c, hidden: true } : c))
	});

	test('leaves the budget table but still counts in its group totals, listed with the hidden ones', () => {
		const result = computeBudget(rentHidden);

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
						priorAvailable: 0,
						assigned: 20_000,
						activity: -6_000,
						available: 14_000,
						status: 'funded',
						target: null
					}
				]
			}
		]);
		expect(result.hidden).toEqual([
			{
				id: 'rent',
				name: 'Rent',
				priorAvailable: 0,
				assigned: 145_000,
				activity: -150_000,
				available: -5_000,
				status: 'overspent',
				target: null
			}
		]);
	});

	test('still counts in Ready to Assign and stays listed while overspent', () => {
		expect(computeBudget(rentHidden).readyToAssign).toEqual(computeBudget(shown).readyToAssign);
		expect(computeBudget(rentHidden).overspent).toEqual([
			{ id: 'rent', name: 'Rent', available: -5_000 }
		]);
	});

	test('in a hidden group leaves the table with its group', () => {
		const result = computeBudget(
			budget({
				...spending,
				groups: shown.groups.map((g) => (g.id === 'everyday' ? { ...g, hidden: true } : g))
			})
		);

		expect(result.groups).toEqual([]);
		expect(result.hidden.map((c) => c.name)).toEqual(['Groceries', 'Rent']);
		expect(result.readyToAssign).toEqual(computeBudget(shown).readyToAssign);
	});
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
		'cash = Ready to Assign + every Available, hidden or not, after any edits (sequence %i)',
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
					// Odd sequences hide Rent, which still holds money.
					categories: budget().categories.map((c) =>
						c.id === 'rent' ? { ...c, hidden: seed % 2 === 1 } : c
					),
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
				const available = [
					...result.groups.flatMap((group) => group.categories),
					...result.hidden
				].reduce((total, c) => total + c.available, 0);
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

describe('Targets', () => {
	/** The budget with Groceries given `target`, and Groceries' row from it. */
	function groceriesWith(target: Target, change: Partial<BudgetInput<CategoryId, GroupId>> = {}) {
		const input = budget(change);
		return category(
			computeBudget({
				...input,
				categories: input.categories.map((c) => (c.id === 'groceries' ? { ...c, target } : c))
			}),
			'Groceries'
		);
	}

	test('a due day never changes what a Monthly Target needs', () => {
		const leftOver = {
			assignments: [{ month: '2026-09', categoryId: 'groceries' as const, amount: 10_000 }]
		};
		for (const mode of ['refill', 'setAside'] as const) {
			const without = groceriesWith({ kind: 'monthly', amount: 50_000, mode }, leftOver);
			const withDay = groceriesWith(
				{ kind: 'monthly', amount: 50_000, mode, dueDay: 20 },
				leftOver
			);
			expect(withDay.target?.needed).toBe(without.target?.needed);
		}
	});

	describe('a refill Monthly Target', () => {
		const refill: Target = { kind: 'monthly', amount: 50_000, mode: 'refill' };

		test('needs what tops Available up to the amount, counting what was left over', () => {
			const groceries = groceriesWith(refill, {
				assignments: [
					{ month: '2026-09', categoryId: 'groceries', amount: 40_000 },
					{ month: '2026-10', categoryId: 'groceries', amount: 5_000 }
				],
				monthlyTotals: [{ month: '2026-09', bucket: 'groceries', amount: -25_000, count: 2 }]
			});

			// $150 left over and $50 Assigned leave $300 to reach $500, so the bar is 40% full.
			expect(groceries).toMatchObject({
				status: 'underfunded',
				target: { definition: refill, needed: 30_000, progress: 0.4 }
			});
		});
	});

	describe('a set aside Monthly Target', () => {
		const setAside: Target = { kind: 'monthly', amount: 20_000, mode: 'setAside' };
		const leftOver = {
			assignments: [{ month: '2026-09', categoryId: 'groceries' as const, amount: 100_000 }]
		};

		test('needs the amount Assigned this month, whatever was left over', () => {
			expect(groceriesWith(setAside, leftOver)).toMatchObject({
				status: 'underfunded',
				target: { needed: 20_000 }
			});
		});

		test('reads Funded once the amount is Assigned', () => {
			const funded = groceriesWith(setAside, {
				assignments: [
					...leftOver.assignments,
					{ month: '2026-10', categoryId: 'groceries', amount: 20_000 }
				]
			});

			expect(funded).toMatchObject({ status: 'funded', target: { needed: 0 } });
		});
	});

	describe('a By date Target', () => {
		const prime: Target = { kind: 'byDate', amount: 13_900, firstDate: '2027-03-03' };

		test('spreads the amount evenly over the months left, counting both ends', () => {
			// November through March is five months: $139 ÷ 5.
			expect(groceriesWith(prime, { month: '2026-11' })).toMatchObject({
				status: 'underfunded',
				target: { needed: 2_780 }
			});
		});

		test('rounds each month up to the cent, after what was left over and Assigned', () => {
			const groceries = groceriesWith(
				{ kind: 'byDate', amount: 10_000, firstDate: '2027-01-15' },
				{
					month: '2026-11',
					assignments: [
						{ month: '2026-10', categoryId: 'groceries', amount: 1_000 },
						{ month: '2026-11', categoryId: 'groceries', amount: 500 }
					]
				}
			);

			// $90 still to save over three months is $30.00 each; $5 is already Assigned.
			expect(groceries).toMatchObject({ target: { needed: 2_500 } });
			expect(
				groceriesWith(
					{ kind: 'byDate', amount: 10_000, firstDate: '2027-01-15' },
					{
						month: '2026-11'
					}
				)
			).toMatchObject({ target: { needed: 3_334 } });
		});

		test('repeating, uses its date through the due month, then the date N months on', () => {
			const yearly: Target = { ...prime, everyMonths: 12 };
			const spentOnTime = {
				assignments: [{ month: '2027-03', categoryId: 'groceries' as const, amount: 13_900 }],
				monthlyTotals: [
					{ month: '2027-03', bucket: 'groceries' as const, amount: -13_900, count: 1 }
				]
			};

			expect(groceriesWith(yearly, { ...spentOnTime, month: '2027-03' })).toMatchObject({
				status: 'funded',
				target: { dueDate: '2027-03-03', needed: 0 }
			});
			// April through next March is twelve months: $139 ÷ 12, rounded up.
			expect(groceriesWith(yearly, { ...spentOnTime, month: '2027-04' })).toMatchObject({
				status: 'underfunded',
				target: { dueDate: '2028-03-03', needed: 1_159 }
			});
		});

		test('repeating, is counted from the first date, so a late day of the month stays put', () => {
			const monthly: Target = {
				kind: 'byDate',
				amount: 3_000,
				firstDate: '2027-01-31',
				everyMonths: 1
			};

			expect(groceriesWith(monthly, { month: '2027-02' })).toMatchObject({
				target: { dueDate: '2027-02-28' }
			});
			expect(groceriesWith(monthly, { month: '2027-03' })).toMatchObject({
				target: { dueDate: '2027-03-31' }
			});
		});

		test('not repeating, still wants the whole amount once its date has passed', () => {
			expect(groceriesWith(prime, { month: '2027-05' })).toMatchObject({
				target: { dueDate: '2027-03-03', needed: 13_900 }
			});
		});
	});
});

describe('the Upcoming list', () => {
	/** The budget with each Category in `targets` given its Target, and maybe more Categories. */
	function withTargets(
		targets: Partial<Record<string, Target>>,
		change: Partial<BudgetInput<string, GroupId>> = {}
	) {
		const input: BudgetInput<string, GroupId> = { ...budget(), ...change };
		return computeBudget({
			...input,
			categories: input.categories.map((c) => {
				const target = targets[c.id];
				return target === undefined ? c : { ...c, target };
			})
		});
	}

	test('lists Targets due in the next 30 days, soonest first, funded or not', () => {
		const result = withTargets(
			{
				rent: { kind: 'monthly', amount: 145_000, mode: 'refill', dueDay: 1 },
				groceries: { kind: 'monthly', amount: 20_000, mode: 'setAside', dueDay: 20 }
			},
			{ assignments: [{ month: '2026-10', categoryId: 'groceries', amount: 20_000 }] }
		);

		expect(result.upcoming).toEqual([
			{ id: 'groceries', name: 'Groceries', dueDate: '2026-10-20', amount: 20_000, funded: true },
			{ id: 'rent', name: 'Rent', dueDate: '2026-11-01', amount: 145_000, funded: false }
		]);
	});

	test('judges each Target funded in its due month, whichever month is viewed', () => {
		const rent: Target = { kind: 'monthly', amount: 145_000, mode: 'refill', dueDay: 1 };
		const novemberRent = {
			assignments: [{ month: '2026-11', categoryId: 'rent' as const, amount: 145_000 }]
		};

		for (const month of ['2026-09', '2026-10', '2026-12']) {
			expect(withTargets({ rent }, { ...novemberRent, month }).upcoming).toMatchObject([
				{ id: 'rent', dueDate: '2026-11-01', funded: true }
			]);
		}
	});

	test('leaves out Targets due later, Monthly Targets with no due day, and hidden Categories', () => {
		const categories: BudgetInput<string, GroupId>['categories'] = [
			...budget().categories,
			{ id: 'prime', groupId: 'everyday', name: 'Prime', position: 2, kind: 'normal' },
			{ id: 'gift', groupId: 'everyday', name: 'Gift', position: 3, kind: 'normal' },
			{ id: 'old', groupId: 'everyday', name: 'Old', position: 4, kind: 'normal', hidden: true }
		];
		const result = withTargets(
			{
				// The last day in the window, and the first day after it.
				prime: { kind: 'byDate', amount: 13_900, firstDate: '2026-11-13' },
				gift: { kind: 'byDate', amount: 5_000, firstDate: '2026-11-14' },
				groceries: { kind: 'monthly', amount: 20_000, mode: 'refill' },
				old: { kind: 'monthly', amount: 1_000, mode: 'refill', dueDay: 16 }
			},
			{ categories }
		);

		expect(result.upcoming.map((row) => row.name)).toEqual(['Prime']);
	});

	test('takes the next date of a repeating By date Target once its date has passed', () => {
		const result = withTargets({
			groceries: { kind: 'byDate', amount: 5_000, firstDate: '2026-09-20', everyMonths: 1 },
			// Its due month hasn't ended, but its date has passed and it won't repeat.
			rent: { kind: 'byDate', amount: 5_000, firstDate: '2026-10-01' }
		});

		expect(result.upcoming).toMatchObject([{ id: 'groceries', dueDate: '2026-10-20' }]);
	});
});
