import { describe, expect, test } from 'vitest';

import { computeBudget, type BudgetInput, type Target } from './budget';

// A small budget: one Category Group with Groceries and Rent, plus Ready to Assign in its hidden
// system group, and a Checking Account. Amounts are cents.
type CategoryId = 'groceries' | 'rent' | 'readyToAssign' | 'discoverPayment' | 'visaPayment';
type GroupId = 'everyday' | 'system' | 'cards';
type AccountId = 'checking' | 'savings' | 'discover' | 'visa';
type Input = BudgetInput<CategoryId, GroupId, AccountId>;

function budget(change: Partial<Input> = {}): Input {
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
				{ month: '2026-08', accountId: 'checking', bucket: 'groceries', amount: -20_000, count: 3 },
				// September overspends Groceries by $150; nothing resets it at month-end.
				{ month: '2026-09', accountId: 'checking', bucket: 'groceries', amount: -25_000, count: 4 },
				{ month: '2026-10', accountId: 'checking', bucket: 'groceries', amount: -2_000, count: 1 }
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
			{ month: '2026-08', accountId: 'checking', bucket: 'groceries', amount: -45_000, count: 2 },
			{ month: '2026-10', accountId: 'checking', bucket: 'groceries', amount: -2_000, count: 1 }
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
			monthlyTotals: [
				{
					month: '2026-08',
					accountId: 'checking',
					bucket: 'readyToAssign',
					amount: 300_000,
					count: 1
				}
			],
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
				{
					month: '2026-08',
					accountId: 'checking',
					bucket: 'readyToAssign',
					amount: 100_000,
					count: 1
				},
				{
					month: '2026-10',
					accountId: 'checking',
					bucket: 'readyToAssign',
					amount: 230_000,
					count: 1
				},
				{
					month: '2026-10',
					accountId: 'checking',
					bucket: 'uncategorized',
					amount: -5_000,
					count: 1
				}
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
				{
					month: '2026-08',
					accountId: 'checking',
					bucket: 'readyToAssign',
					amount: 100_000,
					count: 1
				},
				{ month: '2026-10', accountId: 'checking', bucket: 'groceries', amount: 1_250, count: 1 }
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
			{
				month: '2026-09',
				accountId: 'checking',
				bucket: 'readyToAssign',
				amount: 230_000,
				count: 1
			},
			{
				month: '2026-10',
				accountId: 'checking',
				bucket: 'readyToAssign',
				amount: -4_000,
				count: 1
			},
			{ month: '2026-10', accountId: 'checking', bucket: 'readyToAssign', amount: 50_000, count: 1 }
		],
		transactionsAfterToday: [{ date: '2026-10-28', amount: 50_000, categoryId: 'readyToAssign' }]
	});
	const uncategorized = budget({
		monthlyTotals: [
			{
				month: '2026-09',
				accountId: 'checking',
				bucket: 'readyToAssign',
				amount: 230_000,
				count: 1
			},
			{
				month: '2026-10',
				accountId: 'checking',
				bucket: 'uncategorized',
				amount: -4_000,
				count: 1
			},
			{ month: '2026-10', accountId: 'checking', bucket: 'uncategorized', amount: 50_000, count: 1 }
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

test('a Transfer between Cash Accounts touches no Category and not Ready to Assign', () => {
	const without = budget({
		monthlyTotals: [
			{
				month: '2026-09',
				accountId: 'checking',
				bucket: 'readyToAssign',
				amount: 230_000,
				count: 1
			},
			{ month: '2026-10', accountId: 'checking', bucket: 'groceries', amount: -6_000, count: 1 }
		],
		assignments: [{ month: '2026-10', categoryId: 'groceries', amount: 10_000 }]
	});
	const withTransfer = {
		...without,
		monthlyTotals: [
			...without.monthlyTotals,
			// Both sides of a $500 Transfer, one in each Account.
			{
				month: '2026-10',
				accountId: 'checking',
				bucket: 'transfer' as const,
				amount: -50_000,
				count: 1
			},
			{
				month: '2026-10',
				accountId: 'checking',
				bucket: 'transfer' as const,
				amount: 50_000,
				count: 1
			}
		]
	};

	const result = computeBudget(withTransfer);
	expect(result).toEqual(computeBudget(without));
	expect(result.readyToAssign).toEqual({ amount: 220_000, uncategorized: 0 });
	expect(result.uncategorizedCount).toBe(0);
});

test('groups show their totals, and overspent Categories are listed in table order', () => {
	const result = computeBudget(
		budget({
			assignments: [
				{ month: '2026-10', categoryId: 'rent', amount: 145_000 },
				{ month: '2026-10', categoryId: 'groceries', amount: 20_000 }
			],
			monthlyTotals: [
				{ month: '2026-10', accountId: 'checking', bucket: 'rent', amount: -150_000, count: 1 },
				{ month: '2026-10', accountId: 'checking', bucket: 'groceries', amount: -6_000, count: 2 }
			]
		})
	);

	expect(result.groups).toEqual([
		{
			id: 'everyday',
			name: 'Everyday',
			kind: 'normal',
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
					target: null,
					payment: null
				},
				{
					id: 'rent',
					name: 'Rent',
					priorAvailable: 0,
					assigned: 145_000,
					activity: -150_000,
					available: -5_000,
					status: 'overspent',
					target: null,
					payment: null
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
			{ month: '2026-10', accountId: 'checking', bucket: 'rent', amount: -150_000, count: 1 },
			{ month: '2026-10', accountId: 'checking', bucket: 'groceries', amount: -6_000, count: 2 }
		]
	} satisfies Partial<Input>;
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
				kind: 'normal',
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
						target: null,
						payment: null
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
				target: null,
				payment: null
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

/**
 * The small budget with a Discover Credit Card Account, its Payment Category in the system
 * Credit Card Payments group.
 */
function withCard(change: Partial<Input> = {}): Input {
	const input = budget(change);
	return {
		...input,
		groups: [
			...input.groups,
			{ id: 'cards', name: 'Credit Card Payments', position: -1, kind: 'creditCardPayments' }
		],
		categories: [
			...input.categories,
			{
				id: 'discoverPayment',
				groupId: 'cards',
				name: 'Discover',
				position: 0,
				kind: 'creditCardPayment',
				accountId: 'discover'
			}
		]
	};
}

describe('a Credit Card Account', () => {
	const income = {
		month: '2026-08',
		accountId: 'checking',
		bucket: 'readyToAssign',
		amount: 100_000,
		count: 1
	} as const;
	const groceries30 = { month: '2026-10', categoryId: 'groceries', amount: 3_000 } as const;
	const purchase = {
		month: '2026-10',
		accountId: 'discover',
		bucket: 'groceries',
		amount: -5_000,
		count: 1
	} as const;

	test('moves a categorized purchase in full to its Payment Category, overspending the Category', () => {
		const result = computeBudget(
			withCard({ assignments: [groceries30], monthlyTotals: [income, purchase] })
		);

		expect(category(result, 'Groceries')).toMatchObject({ activity: -5_000, available: -2_000 });
		expect(category(result, 'Discover')).toMatchObject({ activity: 5_000, available: 5_000 });
		expect(result.readyToAssign.amount).toBe(97_000);
		expect(result.groups.map((g) => g.name)).toEqual(['Credit Card Payments', 'Everyday']);
	});

	test('reverses the move for a refund', () => {
		const refund = { ...purchase, amount: 2_000 };
		const result = computeBudget(
			withCard({ assignments: [groceries30], monthlyTotals: [income, purchase, refund] })
		);

		expect(category(result, 'Groceries')).toMatchObject({ available: 0 });
		expect(category(result, 'Discover')).toMatchObject({ activity: 3_000, available: 3_000 });
	});

	test('moves an Uncategorized purchase as if categorized to Ready to Assign', () => {
		const categorized = withCard({
			monthlyTotals: [income, { ...purchase, bucket: 'readyToAssign' }]
		});
		const uncategorized = withCard({
			monthlyTotals: [income, { ...purchase, bucket: 'uncategorized' }]
		});

		const result = computeBudget(uncategorized);
		expect(result.readyToAssign).toEqual({ amount: 95_000, uncategorized: -5_000 });
		expect(result.uncategorizedCount).toBe(1);
		expect(category(result, 'Discover').available).toBe(5_000);
		expect(computeBudget(categorized).readyToAssign.amount).toBe(95_000);
		expect(category(computeBudget(categorized), 'Discover').available).toBe(5_000);
	});

	test('counts a card payment, a Transfer from a Cash Account, in the Payment Category only', () => {
		const without = withCard({ assignments: [groceries30], monthlyTotals: [income, purchase] });
		const payment = [
			{ month: '2026-10', accountId: 'checking', bucket: 'transfer', amount: -4_000, count: 1 },
			{ month: '2026-10', accountId: 'discover', bucket: 'transfer', amount: 4_000, count: 1 }
		] as const;
		const result = computeBudget({
			...without,
			monthlyTotals: [...without.monthlyTotals, ...payment]
		});

		expect(category(result, 'Discover')).toMatchObject({ activity: 1_000, available: 1_000 });
		expect(category(result, 'Groceries')).toEqual(category(computeBudget(without), 'Groceries'));
		expect(result.readyToAssign).toEqual(computeBudget(without).readyToAssign);
	});

	test("leaves a card's starting debt out of every Category and Ready to Assign", () => {
		// The starting balance sits in the card's own Payment Category, where the move cancels it.
		const startingDebt = {
			month: '2026-08',
			accountId: 'discover',
			bucket: 'discoverPayment',
			amount: -60_000,
			count: 1
		} as const;
		const result = computeBudget(withCard({ monthlyTotals: [income, startingDebt] }));

		expect(category(result, 'Discover')).toMatchObject({ activity: 0, available: 0 });
		expect(result.readyToAssign).toEqual({ amount: 100_000, uncategorized: 0 });
		expect(result.uncategorizedCount).toBe(0);
	});

	describe('Payment Category', () => {
		test('says how much is waiting on each overspent Category, and the debt not yet covered', () => {
			const rentByCash = {
				month: '2026-10',
				accountId: 'checking',
				bucket: 'rent',
				amount: -1_000,
				count: 1
			} as const;
			const startingDebt = {
				month: '2026-08',
				accountId: 'discover',
				bucket: 'discoverPayment',
				amount: -60_000,
				count: 1
			} as const;
			const result = computeBudget(
				withCard({
					assignments: [groceries30],
					monthlyTotals: [income, startingDebt, purchase, rentByCash]
				})
			);

			// Rent is overspent by cash, so the card waits on nothing there.
			expect(category(result, 'Discover').payment).toEqual({
				waitingOn: [{ id: 'groceries', name: 'Groceries', amount: 2_000 }],
				uncovered: 60_000
			});
			expect(category(result, 'Groceries').payment).toBeNull();
		});

		test('waits on no more than a Category is overspent, shared across cards in order', () => {
			const input = withCard({
				assignments: [groceries30],
				monthlyTotals: [
					income,
					{ ...purchase, amount: -2_000 },
					{ ...purchase, accountId: 'visa', amount: -4_000 }
				]
			});
			const visa = {
				id: 'visaPayment',
				groupId: 'cards',
				name: 'Visa',
				position: 1,
				kind: 'creditCardPayment',
				accountId: 'visa'
			} as const;
			const result = computeBudget({ ...input, categories: [...input.categories, visa] });

			// $60 of card purchases against $30 Assigned leaves Groceries overspent by $30.
			expect(category(result, 'Groceries').available).toBe(-3_000);
			expect(category(result, 'Discover').payment?.waitingOn).toEqual([
				{ id: 'groceries', name: 'Groceries', amount: 2_000 }
			]);
			expect(category(result, 'Visa').payment?.waitingOn).toEqual([
				{ id: 'groceries', name: 'Groceries', amount: 1_000 }
			]);
		});
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
	const accounts = ['checking', 'savings', 'discover'] as const;
	const isCash = (accountId: AccountId) => accountId !== 'discover';

	test.each([1, 2, 3, 4, 5, 6, 7, 8])(
		'cash = Ready to Assign + every Available, hidden or not, after any edits (sequence %i)',
		(seed) => {
			const rand = random(seed);
			const transactions: {
				accountId: AccountId;
				date: string;
				amount: number;
				categoryId: CategoryId | null;
			}[] = [
				// The card's starting debt, which sits in its own Payment Category.
				{
					accountId: 'discover',
					date: '2026-08-01',
					amount: -60_000,
					categoryId: 'discoverPayment'
				}
			];
			// Transfers: each is a pair of sides with opposite amounts, `amount` into `to`. With the
			// card, it is a card payment from a Cash Account.
			const transfers: { date: string; amount: number; from: AccountId; to: AccountId }[] = [];
			const assigned = new Map<string, number>();

			// Every Transaction has happened by now.
			const today = '2027-01-01';
			const check = () => {
				const totals = new Map<string, { amount: number; count: number }>();
				const sides = transfers.flatMap(({ date, amount, from, to }) => [
					{ accountId: to, date, amount, bucket: 'transfer' },
					{ accountId: from, date, amount: -amount, bucket: 'transfer' }
				]);
				const all = [
					...transactions.map((t) => ({ ...t, bucket: t.categoryId ?? 'uncategorized' })),
					...sides
				];
				for (const t of all) {
					const key = `${t.date.slice(0, 7)}|${t.accountId}|${t.bucket}`;
					const row = totals.get(key) ?? { amount: 0, count: 0 };
					row.amount += t.amount;
					row.count += 1;
					totals.set(key, row);
				}
				const input = withCard({
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
						const [month = '', accountId, bucket] = key.split('|');
						return {
							month,
							accountId: accountId as AccountId,
							bucket: bucket as CategoryId | 'uncategorized' | 'transfer',
							...row
						};
					})
				});

				const cash = all.reduce((total, t) => total + (isCash(t.accountId) ? t.amount : 0), 0);
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
				const action = transactions.length === 0 ? 0 : rand.int(5);
				const entry = () => ({
					accountId: rand.pick(accounts),
					date: `${rand.pick(months)}-${String(1 + rand.int(28)).padStart(2, '0')}`,
					amount: rand.int(200_000) - 120_000,
					categoryId: rand.pick(buckets)
				});
				if (action === 0) transactions.push(entry());
				else if (action === 1) transactions[rand.int(transactions.length)] = entry();
				else if (action === 2) transactions.splice(rand.int(transactions.length), 1);
				else if (action === 3) {
					const { date, amount } = entry();
					if (transfers.length > 0 && rand.int(3) === 0) transfers.pop();
					else if (rand.int(2) === 0)
						transfers.push({ date, amount, from: 'checking', to: 'savings' });
					else transfers.push({ date, amount: Math.abs(amount), from: 'checking', to: 'discover' });
				}
				// Setting Assigned, sometimes back to zero.
				else
					assigned.set(
						`${rand.pick(months)}|${rand.pick(['groceries', 'rent', 'discoverPayment'])}`,
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
	function groceriesWith(target: Target, change: Partial<Input> = {}) {
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
				monthlyTotals: [
					{
						month: '2026-09',
						accountId: 'checking',
						bucket: 'groceries',
						amount: -25_000,
						count: 2
					}
				]
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
					{
						month: '2027-03',
						accountId: 'checking' as const,
						bucket: 'groceries' as const,
						amount: -13_900,
						count: 1
					}
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

	test('lists hidden Categories too, and leaves out Targets due later and Monthly Targets with no due day', () => {
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

		expect(result.upcoming.map((row) => row.name)).toEqual(['Old', 'Prime']);
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
