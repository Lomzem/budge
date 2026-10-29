// The budget rules: one entry point turns stored Assigned amounts and monthly totals into
// everything the budget screen shows. Callers never assemble these numbers from smaller pieces.

import { monthOf } from './dates';

export type CategoryKind = 'normal' | 'readyToAssign';

export interface BudgetInput<C extends string, G extends string> {
	/** The viewed month, `YYYY-MM`. */
	month: string;
	today: string;
	cutoverDate: string | null;
	groups: readonly { id: G; name: string; position: number; kind: CategoryKind }[];
	categories: readonly {
		id: C;
		groupId: G;
		name: string;
		position: number;
		kind: CategoryKind;
	}[];
	assignments: readonly { month: string; categoryId: C; amount: number }[];
	/** Summed Transactions per month and bucket, over every Account. */
	monthlyTotals: readonly {
		month: string;
		bucket: C | 'uncategorized';
		amount: number;
		count: number;
	}[];
	/**
	 * Ready to Assign and Uncategorized Transactions dated after `today`. Their inflows wait for
	 * their date before they count.
	 */
	transactionsAfterToday: readonly { date: string; amount: number; categoryId: C | null }[];
}

/**
 * How a Category's Available stands. `underfunded` arrives with Targets, which say how much a
 * Category needs.
 */
export type AvailableStatus = 'funded' | 'underfunded' | 'overspent' | 'empty';

export interface CategoryBudget<C extends string> {
	id: C;
	name: string;
	assigned: number;
	activity: number;
	available: number;
	status: AvailableStatus;
}

export interface GroupBudget<C extends string, G extends string> {
	id: G;
	name: string;
	assigned: number;
	activity: number;
	available: number;
	categories: CategoryBudget<C>[];
}

export interface Budget<C extends string, G extends string> {
	month: string;
	/** The cutover month, before which there is nothing to budget; `null` until it is set. */
	firstMonth: string | null;
	/** Global: the same in every month. It may go negative. */
	readyToAssign: {
		amount: number;
		/** How much of `amount` is Uncategorized Transactions. */
		uncategorized: number;
	};
	/** How many Transactions still need a Category. */
	uncategorizedCount: number;
	groups: GroupBudget<C, G>[];
	/** Categories with a negative Available, in table order, until they are Covered. */
	overspent: { id: C; name: string; available: number }[];
}

const sum = (
	rows: readonly CategoryBudget<string>[],
	field: 'assigned' | 'activity' | 'available'
) => rows.reduce((total, row) => total + row[field], 0);

function statusOf(available: number): AvailableStatus {
	if (available < 0) return 'overspent';
	return available > 0 ? 'funded' : 'empty';
}

/** Per Category: the amount in `month` (`now`) and through the end of `month` (`through`). */
function sumByCategory<C extends string>(
	month: string,
	rows: readonly { month: string; key: C; amount: number }[]
): Map<C, { now: number; through: number }> {
	const sums = new Map<C, { now: number; through: number }>();
	for (const row of rows) {
		if (row.month > month) continue;
		const sum = sums.get(row.key) ?? { now: 0, through: 0 };
		sum.through += row.amount;
		if (row.month === month) sum.now += row.amount;
		sums.set(row.key, sum);
	}
	return sums;
}

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export function computeBudget<C extends string, G extends string>(
	input: BudgetInput<C, G>
): Budget<C, G> {
	const { month } = input;
	const assigned = sumByCategory(
		month,
		input.assignments.map((row) => ({ ...row, key: row.categoryId }))
	);
	const activity = sumByCategory(
		month,
		input.monthlyTotals.flatMap((row) =>
			row.bucket === 'uncategorized' ? [] : [{ ...row, key: row.bucket }]
		)
	);

	const groups = input.groups
		.filter((group) => group.kind === 'normal')
		.toSorted(byPosition)
		.map((group) => {
			const categories = input.categories
				.filter((c) => c.groupId === group.id && c.kind === 'normal')
				.toSorted(byPosition)
				.map((c): CategoryBudget<C> => {
					const a = assigned.get(c.id) ?? { now: 0, through: 0 };
					const t = activity.get(c.id) ?? { now: 0, through: 0 };
					const available = a.through + t.through;
					return {
						id: c.id,
						name: c.name,
						assigned: a.now,
						activity: t.now,
						available,
						status: statusOf(available)
					};
				});
			return {
				id: group.id,
				name: group.name,
				assigned: sum(categories, 'assigned'),
				activity: sum(categories, 'activity'),
				available: sum(categories, 'available'),
				categories
			};
		});
	const overspent = groups
		.flatMap((group) => group.categories)
		.filter((c) => c.available < 0)
		.map(({ id, name, available }) => ({ id, name, available }));

	const readyToAssignIds = new Set<string>(
		input.categories.filter((c) => c.kind === 'readyToAssign').map((c) => c.id)
	);
	// Uncategorized counts exactly as if categorized to Ready to Assign.
	let readyToAssign = 0;
	let uncategorized = 0;
	let uncategorizedCount = 0;
	for (const row of input.monthlyTotals) {
		if (row.bucket === 'uncategorized') {
			uncategorized += row.amount;
			uncategorizedCount += row.count;
		} else if (readyToAssignIds.has(row.bucket)) {
			readyToAssign += row.amount;
		}
	}
	for (const transaction of input.transactionsAfterToday) {
		if (transaction.amount <= 0 || transaction.date <= input.today) continue;
		if (transaction.categoryId === null) uncategorized -= transaction.amount;
		else if (readyToAssignIds.has(transaction.categoryId)) readyToAssign -= transaction.amount;
	}
	readyToAssign += uncategorized;
	for (const row of input.assignments) readyToAssign -= row.amount;

	return {
		month,
		firstMonth: input.cutoverDate === null ? null : monthOf(input.cutoverDate),
		readyToAssign: { amount: readyToAssign, uncategorized },
		uncategorizedCount,
		groups,
		overspent
	};
}
