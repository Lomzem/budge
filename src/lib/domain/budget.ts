import { addDays, addMonths, addMonthsToDate, dayOfMonth, monthOf, monthsBetween } from './dates';

export type CategoryKind = 'normal' | 'readyToAssign' | 'creditCardPayment';
export type GroupKind = 'normal' | 'readyToAssign' | 'creditCardPayments';

export type Target =
	| { kind: 'monthly'; amount: number; mode: 'refill' | 'setAside'; dueDay?: number }
	| { kind: 'byDate'; amount: number; firstDate: string; everyMonths?: number };

export const MAX_REPEAT_MONTHS = 120;

export function isRepeatInterval(months: number): boolean {
	return Number.isInteger(months) && months >= 1 && months <= MAX_REPEAT_MONTHS;
}

export interface TargetProgress {
	definition: Target;

	needed: number;

	progress: number;

	dueDate: string | null;
}

export interface BudgetInput<C extends string, G extends string, A extends string = string> {
	month: string;
	today: string;
	cutoverDate: string | null;

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

		accountId?: A | undefined;
	}[];
	assignments: readonly { month: string; categoryId: C; amount: number }[];

	monthlyTotals: readonly {
		month: string;
		accountId: A;
		bucket: C | 'uncategorized' | 'transfer';
		amount: number;
		count: number;
	}[];

	transactionsAfterToday: readonly { date: string; amount: number; categoryId: C | null }[];
}

export type AvailableStatus = 'funded' | 'underfunded' | 'overspent' | 'empty';

export interface CategoryBudget<C extends string> {
	id: C;
	name: string;

	priorAvailable: number;
	assigned: number;
	activity: number;
	available: number;
	status: AvailableStatus;
	target: TargetProgress | null;

	payment: PaymentBudget<C> | null;
}

export interface PaymentBudget<C extends string> {
	waitingOn: { id: C; name: string; amount: number }[];

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

	firstMonth: string | null;

	readyToAssign: {
		amount: number;

		uncategorized: number;
	};

	uncategorizedCount: number;

	groups: GroupBudget<C, G>[];

	hidden: CategoryBudget<C>[];

	overspent: { id: C; name: string; available: number }[];

	upcoming: { id: C; name: string; dueDate: string; amount: number; funded: boolean }[];
}

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

function nextDue(target: Target, today: string): string | null {
	if (target.kind === 'monthly') {
		if (target.dueDay === undefined) return null;
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

function byDateDue(definition: Extract<Target, { kind: 'byDate' }>, month: string): string {
	const every = definition.everyMonths;
	const behind = monthsBetween(monthOf(definition.firstDate), month);
	if (every === undefined || every < 1 || behind <= 0) return definition.firstDate;
	return addMonthsToDate(definition.firstDate, Math.ceil(behind / every) * every);
}

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
	const paymentCategoryOf = paymentCategories(input.categories);

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

	const windowEnd = addDays(input.today, UPCOMING_DAYS);

	const upcomingOf = (c: BudgetInput<C, G, A>['categories'][number]) => {
		if (c.target === undefined) return undefined;
		const dueDate = nextDue(c.target, input.today);
		if (dueDate === null || dueDate >= windowEnd) return undefined;
		const due = budgetOf(c, monthOf(dueDate));
		return {
			id: c.id,
			name: c.name,
			dueDate,
			amount: c.target.amount,
			funded: due.available >= 0 && due.target?.needed === 0
		};
	};

	const groups: GroupBudget<C, G>[] = [];
	const hidden: CategoryBudget<C>[] = [];
	const upcoming: Budget<C, G>['upcoming'] = [];
	const overspent: Budget<C, G>['overspent'] = [];
	for (const group of input.groups.toSorted(byPosition)) {
		if (group.kind === 'readyToAssign') continue;
		const shownAndHidden: CategoryBudget<C>[] = [];
		const shown: CategoryBudget<C>[] = [];
		for (const c of input.categories
			.filter((c) => c.groupId === group.id && c.kind !== 'readyToAssign')
			.toSorted(byPosition)) {
			const row = budgetOf(c);
			if (c.kind === 'creditCardPayment' && c.accountId !== undefined) {
				row.payment = paymentOf(c.accountId, row.available);
			}
			shownAndHidden.push(row);
			const isHidden = group.hidden === true || c.hidden === true;
			(isHidden ? hidden : shown).push(row);
			const soon = upcomingOf(c);
			if (soon !== undefined) upcoming.push(soon);
			if (row.available < 0) {
				overspent.push({ id: row.id, name: row.name, available: row.available });
			}
		}
		if (group.hidden === true) continue;
		groups.push({
			id: group.id,
			name: group.name,
			kind: group.kind,
			assigned: sum(shownAndHidden, 'assigned'),
			activity: sum(shownAndHidden, 'activity'),
			available: sum(shownAndHidden, 'available'),
			categories: shown
		});
	}

	const { uncategorizedCount, ...readyToAssign } = readyToAssignOf(input);
	return {
		month,
		firstMonth: input.cutoverDate === null ? null : monthOf(input.cutoverDate),
		readyToAssign,
		uncategorizedCount,
		groups,
		hidden,
		overspent,
		upcoming: upcoming.toSorted(byDueDate)
	};
}

function paymentCategories<C extends string, G extends string, A extends string>(
	categories: BudgetInput<C, G, A>['categories']
): Map<A, C> {
	const paymentCategoryOf = new Map<A, C>();
	for (const c of categories) {
		if (c.kind === 'creditCardPayment' && c.accountId !== undefined) {
			paymentCategoryOf.set(c.accountId, c.id);
		}
	}
	return paymentCategoryOf;
}

function readyToAssignOf<C extends string, G extends string, A extends string>(
	input: BudgetInput<C, G, A>
) {
	const readyToAssignIds = new Set<string>(
		input.categories.filter((c) => c.kind === 'readyToAssign').map((c) => c.id)
	);
	let amount = 0;
	let uncategorized = 0;
	let uncategorizedCount = 0;
	for (const row of input.monthlyTotals) {
		if (row.bucket === 'uncategorized') {
			uncategorized += row.amount;
			uncategorizedCount += row.count;
		} else if (readyToAssignIds.has(row.bucket)) {
			amount += row.amount;
		}
	}
	for (const transaction of input.transactionsAfterToday) {
		if (transaction.amount <= 0 || transaction.date <= input.today) continue;
		if (transaction.categoryId === null) uncategorized -= transaction.amount;
		else if (readyToAssignIds.has(transaction.categoryId)) amount -= transaction.amount;
	}
	amount += uncategorized;
	for (const row of input.assignments) amount -= row.amount;
	return { amount, uncategorized, uncategorizedCount };
}

function byDueDate(a: { dueDate: string }, b: { dueDate: string }) {
	if (a.dueDate === b.dueDate) return 0;
	return a.dueDate < b.dueDate ? -1 : 1;
}
