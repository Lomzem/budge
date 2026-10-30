// The budget rules: one entry point turns stored Assigned amounts and monthly totals into
// everything the budget screen shows. Callers never assemble these numbers from smaller pieces.

import { addDays, addMonths, addMonthsToDate, dayOfMonth, monthOf, monthsBetween } from './dates';

/**
 * Ready to Assign and each Credit Card Account's Payment Category are system Categories, each in
 * its own system group; Budge manages them.
 */
export type CategoryKind = 'normal' | 'readyToAssign' | 'creditCardPayment';
export type GroupKind = 'normal' | 'readyToAssign' | 'creditCardPayments';

/**
 * How much a Category needs and by when. A Monthly Target either refills Available up to `amount`
 * or sets aside `amount` on top of what was left over. A By date Target needs `amount` Available
 * by `firstDate`, then again every `everyMonths` months when it repeats.
 */
export type Target =
	| { kind: 'monthly'; amount: number; mode: 'refill' | 'setAside'; dueDay?: number }
	| { kind: 'byDate'; amount: number; firstDate: string; everyMonths?: number };

/** The longest a By date Target may wait between repeats: ten years is already beyond any bill. */
export const MAX_REPEAT_MONTHS = 120;

/** Whether `months` is a repeat interval a By date Target accepts: whole months, 1 to the max. */
export function isRepeatInterval(months: number): boolean {
	return Number.isInteger(months) && months >= 1 && months <= MAX_REPEAT_MONTHS;
}

export interface TargetProgress {
	definition: Target;
	/** What the Target still needs Assigned this month. */
	needed: number;
	/** How full the progress bar is this month, from 0 to 1. */
	progress: number;
	/** The date a By date Target is due as of this month; `null` for a Monthly Target. */
	dueDate: string | null;
}

export interface BudgetInput<C extends string, G extends string, A extends string = string> {
	/** The viewed month, `YYYY-MM`. */
	month: string;
	today: string;
	cutoverDate: string | null;
	/** A hidden group leaves the budget table with all its Categories. */
	groups: readonly {
		id: G;
		name: string;
		position: number;
		kind: GroupKind;
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
		/** A Payment Category's Credit Card Account. */
		accountId?: A | undefined;
	}[];
	assignments: readonly { month: string; categoryId: C; amount: number }[];
	/**
	 * Summed Transactions per month, Account, and bucket. Transfer sides sum in `transfer`; between
	 * Cash Accounts they touch no Category and not Ready to Assign. On a Credit Card Account, every
	 * total also moves its amount, reversed, into that card's Payment Category.
	 */
	monthlyTotals: readonly {
		month: string;
		accountId: A;
		bucket: C | 'uncategorized' | 'transfer';
		amount: number;
		count: number;
	}[];
	/**
	 * Ready to Assign and Uncategorized Transactions dated after `today`, Transfer sides left out.
	 * Their inflows wait for their date before they count.
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
	/** What a Payment Category still waits on, or `null` for any other Category. */
	payment: PaymentBudget<C> | null;
}

export interface PaymentBudget<C extends string> {
	/**
	 * Overspent Categories whose card purchases this Payment Category holds money for that isn't
	 * there yet, in table order. A Category is waited on for at most what it is overspent by,
	 * shared out across cards in table order.
	 */
	waitingOn: { id: C; name: string; amount: number }[];
	/** Card debt Available doesn't cover yet: the debt minus Available, never below zero. */
	uncovered: number;
}

export interface GroupBudget<C extends string, G extends string> {
	id: G;
	name: string;
	kind: 'normal' | 'creditCardPayments';
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

export function computeBudget<C extends string, G extends string, A extends string>(
	input: BudgetInput<C, G, A>
): Budget<C, G> {
	const { month } = input;
	const paymentCategoryOf = new Map<A, C>();
	for (const c of input.categories) {
		if (c.kind === 'creditCardPayment' && c.accountId !== undefined) {
			paymentCategoryOf.set(c.accountId, c.id);
		}
	}
	// Each total counts in its own Category, and a card's also moves into its Payment Category:
	// a purchase in full, even past what the Category has, and a refund back out.
	const activityRows = input.monthlyTotals.flatMap((row) => {
		const rows: { month: string; key: C; amount: number }[] = [];
		if (row.bucket !== 'uncategorized' && row.bucket !== 'transfer') {
			rows.push({ month: row.month, key: row.bucket, amount: row.amount });
		}
		const payment = paymentCategoryOf.get(row.accountId);
		if (payment !== undefined) rows.push({ month: row.month, key: payment, amount: -row.amount });
		return rows;
	});
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
				activity: sumByCategory(viewed, activityRows)
			};
			sumsByMonth.set(viewed, sums);
		}
		return sums;
	};

	const budgetOf = (
		c: BudgetInput<C, G, A>['categories'][number],
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
			target,
			payment: null
		};
	};

	const groupPosition = new Map<G, number>(input.groups.map((g) => [g.id, g.position]));
	const byTableOrder = (a: { groupId: G; position: number }, b: typeof a) =>
		(groupPosition.get(a.groupId) ?? 0) - (groupPosition.get(b.groupId) ?? 0) ||
		a.position - b.position;
	// What each overspent Category is still short, shared out to the cards that waited on it.
	const shortOf = new Map<C, number>();
	for (const c of input.categories) {
		if (c.kind !== 'normal') continue;
		const { available } = budgetOf(c);
		if (available < 0) shortOf.set(c.id, -available);
	}
	const paymentOf = (accountId: A, available: number): PaymentBudget<C> => {
		let balance = 0;
		const spentIn = new Map<string, number>();
		for (const row of input.monthlyTotals) {
			if (row.accountId !== accountId || row.month > month) continue;
			balance += row.amount;
			spentIn.set(row.bucket, (spentIn.get(row.bucket) ?? 0) - row.amount);
		}
		const waitingOn: PaymentBudget<C>['waitingOn'] = [];
		for (const c of input.categories.filter((c) => c.kind === 'normal').toSorted(byTableOrder)) {
			const short = shortOf.get(c.id) ?? 0;
			const amount = Math.min(short, spentIn.get(c.id) ?? 0);
			if (amount <= 0) continue;
			shortOf.set(c.id, short - amount);
			waitingOn.push({ id: c.id, name: c.name, amount });
		}
		return { waitingOn, uncovered: Math.max(0, -balance - available) };
	};

	const groups: GroupBudget<C, G>[] = [];
	const hidden: CategoryBudget<C>[] = [];
	const upcoming: Budget<C, G>['upcoming'] = [];
	const windowEnd = addDays(input.today, UPCOMING_DAYS);
	const overspent: Budget<C, G>['overspent'] = [];
	for (const group of input.groups.toSorted(byPosition)) {
		if (group.kind === 'readyToAssign') continue;
		// Hidden Categories leave the table but still count in their group's totals.
		const all: CategoryBudget<C>[] = [];
		const shown: CategoryBudget<C>[] = [];
		for (const c of input.categories
			.filter((c) => c.groupId === group.id && c.kind !== 'readyToAssign')
			.toSorted(byPosition)) {
			const row = budgetOf(c);
			if (c.kind === 'creditCardPayment' && c.accountId !== undefined) {
				row.payment = paymentOf(c.accountId, row.available);
			}
			all.push(row);
			const isHidden = group.hidden === true || c.hidden === true;
			(isHidden ? hidden : shown).push(row);
			const dueDate = c.target === undefined ? null : nextDue(c.target, input.today);
			if (c.target !== undefined && dueDate !== null && dueDate < windowEnd) {
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
			kind: group.kind,
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
