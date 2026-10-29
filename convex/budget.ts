import { v } from 'convex/values';

import { isIsoDate, isIsoMonth, monthOf } from '../src/lib/domain/dates';
import { computeBudget } from '../src/lib/domain/budget';
import type { Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireCents } from './lib/input';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { readCutoverDate, requireCutoverDate } from './lib/settings';

const totals = { assigned: v.number(), activity: v.number(), available: v.number() };

const status = v.union(
	v.literal('funded'),
	v.literal('underfunded'),
	v.literal('overspent'),
	v.literal('empty')
);

const categoryBudget = v.object({
	id: v.id('categories'),
	name: v.string(),
	priorAvailable: v.number(),
	...totals,
	status
});

/**
 * Everything the budget screen shows for `month`. `today` comes from the browser, as reading the
 * clock here would defeat query caching. Reads only Categories, groups, Assigned rows, the
 * monthly totals, and settings, plus the Ready to Assign and Uncategorized Transactions dated
 * after `today`.
 */
export const month = query({
	args: { month: v.string(), today: v.string() },
	returns: v.object({
		month: v.string(),
		firstMonth: v.union(v.string(), v.null()),
		readyToAssign: v.object({ amount: v.number(), uncategorized: v.number() }),
		uncategorizedCount: v.number(),
		groups: v.array(
			v.object({
				id: v.id('categoryGroups'),
				name: v.string(),
				...totals,
				categories: v.array(categoryBudget)
			})
		),
		hidden: v.array(categoryBudget),
		overspent: v.array(
			v.object({ id: v.id('categories'), name: v.string(), available: v.number() })
		)
	}),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		if (!isIsoMonth(args.month) || !isIsoDate(args.today)) throw publicError('INVALID_INPUT');
		return await readBudget(ctx, args.month, args.today);
	}
});

/** The budget for `month` through the single budget entry point, with `today` as the owner's date. */
async function readBudget(ctx: QueryCtx, month: string, today: string) {
	const groups = [];
	for await (const group of ctx.db.query('categoryGroups')) groups.push(group);
	const categories = [];
	for await (const category of ctx.db.query('categories')) categories.push(category);
	const assignments = [];
	for await (const row of ctx.db.query('assignments')) assignments.push(row);
	const monthlyTotals = [];
	for await (const row of ctx.db.query('monthlyTotals')) monthlyTotals.push(row);

	// Only inflows dated after today change the numbers, and the Category-by-date index finds
	// them without reading older history.
	const transactionsAfterToday = [];
	const readyToAssign = categories.filter((c) => c.kind === 'readyToAssign').map((c) => c._id);
	for (const categoryId of [undefined, ...readyToAssign]) {
		const later = ctx.db
			.query('transactions')
			.withIndex('by_category_date', (q) => q.eq('categoryId', categoryId).gt('date', today));
		for await (const transaction of later) {
			transactionsAfterToday.push({
				date: transaction.date,
				amount: transaction.amount,
				categoryId: transaction.categoryId ?? null
			});
		}
	}

	return computeBudget<Id<'categories'>, Id<'categoryGroups'>>({
		month,
		today,
		cutoverDate: await readCutoverDate(ctx),
		groups: groups.map((g) => ({
			id: g._id,
			name: g.name,
			position: g.position,
			kind: g.kind,
			hidden: g.hidden
		})),
		categories: categories.map((c) => ({
			id: c._id,
			groupId: c.groupId,
			name: c.name,
			position: c.position,
			kind: c.kind,
			hidden: c.hidden
		})),
		assignments,
		monthlyTotals,
		transactionsAfterToday
	});
}

/** A month the owner can assign in: `YYYY-MM`, from the cutover month on. */
async function requireBudgetMonth(ctx: QueryCtx, month: string) {
	if (!isIsoMonth(month)) throw publicError('INVALID_INPUT', 'Pick a month.');
	if (month < monthOf(await requireCutoverDate(ctx))) {
		throw publicError('INVALID_INPUT', 'Budge starts in the cutover month.');
	}
}

/** A Category the owner can assign to, which excludes Ready to Assign. */
async function requireAssignable(ctx: QueryCtx, categoryId: Id<'categories'>) {
	const category = await ctx.db.get('categories', categoryId);
	if (category === null) throw publicError('NOT_FOUND');
	if (category.kind !== 'normal') {
		throw publicError('INVALID_INPUT', 'Ready to Assign takes no Assigned amount.');
	}
}

/** Changes a Category's Assigned in `month` with `change`, from what it is now. */
async function updateAssigned(
	ctx: MutationCtx,
	month: string,
	categoryId: Id<'categories'>,
	change: (amount: number) => number
) {
	const row = await ctx.db
		.query('assignments')
		.withIndex('by_month_category', (q) => q.eq('month', month).eq('categoryId', categoryId))
		.unique();
	const amount = requireCents(change(row?.amount ?? 0));
	if (row === null) {
		if (amount !== 0) await ctx.db.insert('assignments', { month, categoryId, amount });
	} else if (amount === 0) {
		await ctx.db.delete('assignments', row._id);
	} else {
		await ctx.db.patch('assignments', row._id, { amount });
	}
}

/** Sets what a Category is Assigned in a month, past or future. Zero removes the row. */
export const setAssigned = mutation({
	args: { month: v.string(), categoryId: v.id('categories'), amount: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const amount = requireCents(args.amount);
		await requireBudgetMonth(ctx, args.month);
		await requireAssignable(ctx, args.categoryId);
		await updateAssigned(ctx, args.month, args.categoryId, () => amount);
		return null;
	}
});

/**
 * Moves `amount` from one Category to another in `month`: two Assigned edits in one mutation, so
 * Ready to Assign never changes. Nothing records the move itself.
 */
export const moveMoney = mutation({
	args: {
		month: v.string(),
		fromCategoryId: v.id('categories'),
		toCategoryId: v.id('categories'),
		amount: v.number()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const amount = requireCents(args.amount);
		if (amount <= 0) throw publicError('INVALID_INPUT', 'Enter an amount above zero.');
		if (args.fromCategoryId === args.toCategoryId) {
			throw publicError('INVALID_INPUT', 'Pick another Category.');
		}
		await requireBudgetMonth(ctx, args.month);
		await requireAssignable(ctx, args.fromCategoryId);
		await requireAssignable(ctx, args.toCategoryId);
		await updateAssigned(ctx, args.month, args.fromCategoryId, (assigned) => assigned - amount);
		await updateAssigned(ctx, args.month, args.toCategoryId, (assigned) => assigned + amount);
		return null;
	}
});

/**
 * Covers an overspent Category in `month`: assigns exactly enough to bring its Available back to
 * zero, which lowers Ready to Assign by the same amount. Returns the amount assigned, which is zero
 * when the Category is no longer overspent.
 */
export const cover = mutation({
	args: { month: v.string(), categoryId: v.id('categories') },
	returns: v.number(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		await requireBudgetMonth(ctx, args.month);
		await requireAssignable(ctx, args.categoryId);
		// Available doesn't depend on today; only Ready to Assign does, and Cover doesn't read it.
		const today = new Date().toISOString().slice(0, 10);
		const budget = await readBudget(ctx, args.month, today);
		const category = [...budget.groups.flatMap((g) => g.categories), ...budget.hidden].find(
			(c) => c.id === args.categoryId
		);
		const shortfall = Math.max(0, -(category?.available ?? 0));
		if (shortfall > 0) {
			await updateAssigned(ctx, args.month, args.categoryId, (assigned) => assigned + shortfall);
		}
		return shortfall;
	}
});
