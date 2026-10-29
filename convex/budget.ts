import { v } from 'convex/values';

import { isIsoDate, isIsoMonth, monthOf } from '../src/lib/domain/dates';
import { computeBudget } from '../src/lib/domain/budget';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
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
				.withIndex('by_category_date', (q) =>
					q.eq('categoryId', categoryId).gt('date', args.today)
				);
			for await (const transaction of later) {
				transactionsAfterToday.push({
					date: transaction.date,
					amount: transaction.amount,
					categoryId: transaction.categoryId ?? null
				});
			}
		}

		return computeBudget<Id<'categories'>, Id<'categoryGroups'>>({
			month: args.month,
			today: args.today,
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
});

/** Sets what a Category is Assigned in a month, past or future. Zero removes the row. */
export const setAssigned = mutation({
	args: { month: v.string(), categoryId: v.id('categories'), amount: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const amount = requireCents(args.amount);
		if (!isIsoMonth(args.month)) throw publicError('INVALID_INPUT', 'Pick a month.');
		if (args.month < monthOf(await requireCutoverDate(ctx))) {
			throw publicError('INVALID_INPUT', 'Budge starts in the cutover month.');
		}
		const category = await ctx.db.get('categories', args.categoryId);
		if (category === null) throw publicError('NOT_FOUND');
		if (category.kind !== 'normal') {
			throw publicError('INVALID_INPUT', 'Ready to Assign takes no Assigned amount.');
		}
		const row = await ctx.db
			.query('assignments')
			.withIndex('by_month_category', (q) =>
				q.eq('month', args.month).eq('categoryId', args.categoryId)
			)
			.unique();
		if (row === null) {
			if (amount !== 0) {
				await ctx.db.insert('assignments', {
					month: args.month,
					categoryId: args.categoryId,
					amount
				});
			}
		} else if (amount === 0) {
			await ctx.db.delete('assignments', row._id);
		} else {
			await ctx.db.patch('assignments', row._id, { amount });
		}
		return null;
	}
});
