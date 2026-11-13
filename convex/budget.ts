import { v } from 'convex/values';

import { isIsoDate, isIsoMonth, monthOf } from '../src/lib/domain/dates';
import { computeBudget } from '../src/lib/domain/budget';
import type { Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { readBudgetInput } from './lib/budget';
import { requireCents } from './lib/input';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { requireCutoverDate } from './lib/settings';
import { targetValidator } from './lib/targets';

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
	status,
	target: v.union(
		v.object({
			definition: targetValidator,
			needed: v.number(),
			progress: v.number(),
			dueDate: v.union(v.string(), v.null())
		}),
		v.null()
	),
	payment: v.union(
		v.object({
			waitingOn: v.array(
				v.object({ id: v.id('categories'), name: v.string(), amount: v.number() })
			),
			uncovered: v.number()
		}),
		v.null()
	)
});

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
				kind: v.union(v.literal('normal'), v.literal('creditCardPayments')),
				...totals,
				categories: v.array(categoryBudget)
			})
		),
		hidden: v.array(categoryBudget),
		overspent: v.array(
			v.object({ id: v.id('categories'), name: v.string(), available: v.number() })
		),
		upcoming: v.array(
			v.object({
				id: v.id('categories'),
				name: v.string(),
				dueDate: v.string(),
				amount: v.number(),
				funded: v.boolean()
			})
		)
	}),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		if (!isIsoMonth(args.month) || !isIsoDate(args.today)) throw publicError('INVALID_INPUT');
		return await readBudget(ctx, args.month, args.today);
	}
});

async function readBudget(ctx: QueryCtx, month: string, today: string) {
	return computeBudget(await readBudgetInput(ctx, month, today));
}

async function readCategoryBudget(ctx: QueryCtx, month: string, categoryId: Id<'categories'>) {
	const today = new Date().toISOString().slice(0, 10);
	const budget = await readBudget(ctx, month, today);
	return [...budget.groups.flatMap((g) => g.categories), ...budget.hidden].find(
		(c) => c.id === categoryId
	);
}

async function requireBudgetMonth(ctx: QueryCtx, month: string) {
	if (!isIsoMonth(month)) throw publicError('INVALID_INPUT', 'Pick a month.');
	if (month < monthOf(await requireCutoverDate(ctx))) {
		throw publicError('INVALID_INPUT', 'Budge starts in the cutover month.');
	}
}

async function requireAssignable(ctx: QueryCtx, categoryId: Id<'categories'>) {
	const category = await ctx.db.get('categories', categoryId);
	if (category === null) throw publicError('NOT_FOUND');
	if (category.kind === 'readyToAssign') {
		throw publicError('INVALID_INPUT', 'Ready to Assign takes no Assigned amount.');
	}
}

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

export const cover = mutation({
	args: { month: v.string(), categoryId: v.id('categories') },
	returns: v.number(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		await requireBudgetMonth(ctx, args.month);
		await requireAssignable(ctx, args.categoryId);
		const category = await readCategoryBudget(ctx, args.month, args.categoryId);
		const shortfall = Math.max(0, -(category?.available ?? 0));
		if (shortfall > 0) {
			await updateAssigned(ctx, args.month, args.categoryId, (assigned) => assigned + shortfall);
		}
		return shortfall;
	}
});

export const assignTarget = mutation({
	args: { month: v.string(), categoryId: v.id('categories') },
	returns: v.number(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		await requireBudgetMonth(ctx, args.month);
		await requireAssignable(ctx, args.categoryId);
		const needed =
			(await readCategoryBudget(ctx, args.month, args.categoryId))?.target?.needed ?? 0;
		if (needed > 0) {
			await updateAssigned(ctx, args.month, args.categoryId, (assigned) => assigned + needed);
		}
		return needed;
	}
});
