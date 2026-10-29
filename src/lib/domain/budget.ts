// The budget rules: one entry point turns stored Assigned amounts and monthly totals into
// everything the budget screen shows. Callers never assemble these numbers from smaller pieces.

import { addDays, addMonths, addMonthsToDate, dayOfMonth, monthOf, monthsBetween } from './dates';

export type CategoryKind = 'normal' | 'readyToAssign';

/**
 * How much a Category needs and by when. A Monthly Target either refills Available up to `amount`
 * or sets aside `amount` on top of what was left over. A By date Target needs `amount` Available
 * by `firstDate`, then again every `everyMonths` months when it repeats.
 */
export type Target =
	| { kind: 'monthly'; amount: number; mode: 'refill' | 'setAside'; dueDay?: number }
	| { kind: 'byDate'; amount: number; firstDate: string; everyMonths?: number };

export interface TargetProgress {
	definition: Target;
	/** What the Target still needs Assigned this month. */
	needed: number;
	/** How full the progress bar is this month, from 0 to 1. */
	progress: number;
	/** The date a By date Target is due as of this month; `null` for a Monthly Target. */
	dueDate: string | null;
}

export interface BudgetInput<C extends string, G extends string> {
	/** The viewed month, `YYYY-MM`. */
	month: string;
	today: string;
	cutoverDate: string | null;
	/** A hidden group leaves the budget table with all its Categories. */
	groups: readonly {
		id: G;
		name: string;
		position: number;
		kind: CategoryKind;
		hidden?: boolean | undefined;
	}[];
	categories: readonly {
		id: C;
		groupId: G;
		name: string;
		position: number;
		kind: CategoryKind;
		hidden?: boolean | undefined;
		target?: Target | undefined;
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
	/** Available at the end of last month, left over into this one. */
	priorAvailable: number;
	assigned: number;
	activity: number;
	available: number;
	status: AvailableStatus;
	target: TargetProgress | null;
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
	/** The budget table: shown groups with their shown Categories, and totals over those. */
	groups: GroupBudget<C, G>[];
	/**
	 * Hidden Categories, and those in hidden groups, in table order. They leave the table but still
	 * hold their Available and count in Ready to Assign.
	 */
	hidden: CategoryBudget<C>[];
	/**
	 * Categories with a negative Available, hidden or not, in table order, until they are Covered.
	 */
	overspent: { id: C; name: string; available: number }[];
	/**
	 * Targets due in the 30 days from `today`, soonest first, whichever month is viewed. Each is
	 * funded when its Category needs nothing more and isn't overspent in the month it is due.
	 */
	upcoming: { id: C; name: string; dueDate: string; amount: number; funded: boolean }[];
}

/** How many days ahead the Upcoming list looks, starting with `today`. */
const UPCOMING_DAYS = 30;

const sum = (
	rows: readonly CategoryBudget<string>[],
	field: 'assigned' | 'activity' | 'available'
) => rows.reduce((total, row) => total + row[field], 0);

function statusOf(available: number, target: TargetProgress | null): AvailableStatus {
	if (available < 0) return 'overspent';
	if (target !== null) return target.needed > 0 ? 'underfunded' : 'funded';
	return available > 0 ? 'funded' : 'empty';
}

/**
 * A Target's progress in `month`. `goal` is what the Target wants this month, and `funded` what
 * already counts toward it.
 */
function progressOf(
	definition: Target,
	month: string,
	numbers: { priorAvailable: number; assigned: number }
): TargetProgress {
	let goal: number;
	let funded: number;
	let dueDate: string | null = null;
	if (definition.kind === 'byDate') {
		const due = byDateDue(definition, month);
		dueDate = due;
		// Counting both ends; a date already past wants everything now.
		const monthsLeft = Math.max(1, monthsBetween(month, monthOf(due)) + 1);
		goal = Math.ceil((definition.amount - numbers.priorAvailable) / monthsLeft);
		funded = numbers.assigned;
	} else {
		goal = definition.amount;
		funded =
			definition.mode === 'setAside' ? numbers.assigned : numbers.priorAvailable + numbers.assigned;
	}
	return {
		definition,
		needed: Math.max(0, goal - funded),
		progress: goal <= 0 ? 1 : Math.min(1, Math.max(0, funded / goal)),
		dueDate
	};
}

/** The first date on or after `today` that `target` falls due, or `null` when it never will. */
function nextDue(target: Target, today: string): string | null {
	if (target.kind === 'monthly') {
		if (target.dueDay === undefined) return null;
		// A short month moves the day to its last, so the next date may be two months on.
		for (let ahead = 0; ahead <= 2; ahead++) {
			const date = dayOfMonth(addMonths(monthOf(today), ahead), target.dueDay);
			if (date >= today) return date;
		}
		return null;
	}
	const every = target.everyMonths;
	if (target.firstDate >= today) return target.firstDate;
	if (every === undefined || every < 1) return null;
	const behind = monthsBetween(monthOf(target.firstDate), monthOf(today));
	for (let step = Math.ceil(behind / every); ; step++) {
		const date = addMonthsToDate(target.firstDate, step * every);
		if (date >= today) return date;
	}
}

/**
 * The date a By date Target is due as of `month`. A repeating one keeps each date through its
 * month, then moves `everyMonths` on; every date is counted from the first, so nothing is stored.
 */
function byDateDue(definition: Extract<Target, { kind: 'byDate' }>, month: string): string {
	const every = definition.everyMonths;
	const behind = monthsBetween(monthOf(definition.firstDate), month);
	if (every === undefined || every < 1 || behind <= 0) return definition.firstDate;
	return addMonthsToDate(definition.firstDate, Math.ceil(behind / every) * every);
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
	type Sums = Map<C, { now: number; through: number }>;
	const sumsByMonth = new Map<string, { assigned: Sums; activity: Sums }>();
	const sumsIn = (viewed: string) => {
		let sums = sumsByMonth.get(viewed);
		if (sums === undefined) {
			sums = {
				assigned: sumByCategory(
					viewed,
					input.assignments.map((row) => ({ ...row, key: row.categoryId }))
				),
				activity: sumByCategory(
					viewed,
					input.monthlyTotals.flatMap((row) =>
						row.bucket === 'uncategorized' ? [] : [{ ...row, key: row.bucket }]
					)
				)
			};
			sumsByMonth.set(viewed, sums);
		}
		return sums;
	};

	const budgetOf = (
		c: BudgetInput<C, G>['categories'][number],
		viewed = month
	): CategoryBudget<C> => {
		const sums = sumsIn(viewed);
		const a = sums.assigned.get(c.id) ?? { now: 0, through: 0 };
		const t = sums.activity.get(c.id) ?? { now: 0, through: 0 };
		const available = a.through + t.through;
		const priorAvailable = available - a.now - t.now;
		const target =
			c.target === undefined
				? null
				: progressOf(c.target, viewed, { priorAvailable, assigned: a.now });
		return {
			id: c.id,
			name: c.name,
			priorAvailable,
			assigned: a.now,
			activity: t.now,
			available,
			status: statusOf(available, target),
			target
		};
	};

	const groups: GroupBudget<C, G>[] = [];
	const hidden: CategoryBudget<C>[] = [];
	const upcoming: Budget<C, G>['upcoming'] = [];
	const windowEnd = addDays(input.today, UPCOMING_DAYS);
	const overspent: Budget<C, G>['overspent'] = [];
	for (const group of input.groups.filter((g) => g.kind === 'normal').toSorted(byPosition)) {
		// Hidden Categories leave the table but still count in their group's totals.
		const all: CategoryBudget<C>[] = [];
		const shown: CategoryBudget<C>[] = [];
		for (const c of input.categories
			.filter((c) => c.groupId === group.id && c.kind === 'normal')
			.toSorted(byPosition)) {
			const row = budgetOf(c);
			all.push(row);
			const isHidden = group.hidden === true || c.hidden === true;
			(isHidden ? hidden : shown).push(row);
			const dueDate = c.target === undefined ? null : nextDue(c.target, input.today);
			if (!isHidden && c.target !== undefined && dueDate !== null && dueDate < windowEnd) {
				const due = budgetOf(c, monthOf(dueDate));
				upcoming.push({
					id: c.id,
					name: c.name,
					dueDate,
					amount: c.target.amount,
					funded: due.available >= 0 && due.target?.needed === 0
				});
			}
			if (row.available < 0) {
				overspent.push({ id: row.id, name: row.name, available: row.available });
			}
		}
		if (group.hidden === true) continue;
		groups.push({
			id: group.id,
			name: group.name,
			assigned: sum(all, 'assigned'),
			activity: sum(all, 'activity'),
			available: sum(all, 'available'),
			categories: shown
		});
	}

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
		hidden,
		overspent,
		// Stable, so Targets due the same day stay in table order.
		upcoming: upcoming.toSorted((a, b) =>
			a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
		)
	};
}
