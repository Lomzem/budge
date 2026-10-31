import { v } from 'convex/values';

import { monthOf } from '../src/lib/domain/dates';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import {
	ensureReadyToAssign,
	readReadyToAssign,
	requireOwnCategory,
	requireOwnGroup
} from './lib/categories';
import { requireName } from './lib/input';
import { rebuildTotals } from './lib/monthlyTotals';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { requireTarget, targetValidator } from './lib/targets';

/**
 * Every Category a Transaction can take, hidden ones included: Ready to Assign, then the groups
 * in table order.
 */
export const list = query({
	args: {},
	returns: v.object({
		readyToAssignId: v.union(v.id('categories'), v.null()),
		groups: v.array(
			v.object({
				_id: v.id('categoryGroups'),
				name: v.string(),
				hidden: v.boolean(),
				categories: v.array(
					v.object({ _id: v.id('categories'), name: v.string(), hidden: v.boolean() })
				)
			})
		)
	}),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const groups = [];
		for await (const group of ctx.db.query('categoryGroups')) {
			if (group.kind === 'normal') groups.push(group);
		}
		groups.sort((a, b) => a.position - b.position);
		return {
			readyToAssignId: (await readReadyToAssign(ctx))?._id ?? null,
			groups: await Promise.all(
				groups.map(async (group) => ({
					_id: group._id,
					name: group.name,
					hidden: group.hidden === true,
					categories: (
						await ctx.db
							.query('categories')
							.withIndex('by_group_position', (q) => q.eq('groupId', group._id))
							.collect()
					).map(({ _id, name, hidden }) => ({ _id, name, hidden: hidden === true }))
				}))
			)
		};
	}
});

/** Adds a Category Group at the bottom of the budget table. */
export const createGroup = mutation({
	args: { name: v.string() },
	returns: v.id('categoryGroups'),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const name = requireName(args.name);
		await ensureReadyToAssign(ctx);
		let position = 0;
		for await (const group of ctx.db.query('categoryGroups')) {
			position = Math.max(position, group.position + 1);
		}
		return await ctx.db.insert('categoryGroups', { name, position, kind: 'normal' });
	}
});

/** Adds a Category at the bottom of its group. */
export const create = mutation({
	args: { groupId: v.id('categoryGroups'), name: v.string() },
	returns: v.id('categories'),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const name = requireName(args.name);
		const group = await ctx.db.get('categoryGroups', args.groupId);
		if (group === null) throw publicError('NOT_FOUND');
		if (group.kind !== 'normal') {
			throw publicError('INVALID_INPUT', 'Budge manages that group.');
		}
		const last = await ctx.db
			.query('categories')
			.withIndex('by_group_position', (q) => q.eq('groupId', group._id))
			.order('desc')
			.first();
		return await ctx.db.insert('categories', {
			groupId: group._id,
			name,
			position: last === null ? 0 : last.position + 1,
			kind: 'normal'
		});
	}
});

/** Renames a Category. */
export const rename = mutation({
	args: { categoryId: v.id('categories'), name: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const name = requireName(args.name);
		const category = await requireOwnCategory(ctx, args.categoryId);
		await ctx.db.patch('categories', category._id, { name });
		return null;
	}
});

/** Sets, replaces, or with `null` clears a Category's Target. */
export const setTarget = mutation({
	args: { categoryId: v.id('categories'), target: v.union(targetValidator, v.null()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const target = args.target === null ? undefined : requireTarget(args.target);
		const category = await requireOwnCategory(ctx, args.categoryId);
		await ctx.db.patch('categories', category._id, { target });
		return null;
	}
});

/** Renames a Category Group. */
export const renameGroup = mutation({
	args: { groupId: v.id('categoryGroups'), name: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const name = requireName(args.name);
		const group = await requireOwnGroup(ctx, args.groupId);
		await ctx.db.patch('categoryGroups', group._id, { name });
		return null;
	}
});

/**
 * Moves a Category to `index` among the Categories of `groupId`, its own group or another. An
 * index past the end puts it last.
 */
export const move = mutation({
	args: { categoryId: v.id('categories'), groupId: v.id('categoryGroups'), index: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const category = await requireOwnCategory(ctx, args.categoryId);
		const group = await requireOwnGroup(ctx, args.groupId);
		const index = requireIndex(args.index);
		if (category.groupId !== group._id) {
			// Close the gap it leaves behind.
			const left = await categoriesIn(ctx, category.groupId);
			await writePositions(
				ctx,
				category.groupId,
				left.filter((c) => c._id !== category._id)
			);
		}
		const siblings = (await categoriesIn(ctx, group._id)).filter((c) => c._id !== category._id);
		siblings.splice(index, 0, category);
		await writePositions(ctx, group._id, siblings);
		return null;
	}
});

/** Moves a Category Group to `index` in the budget table. An index past the end puts it last. */
export const moveGroup = mutation({
	args: { groupId: v.id('categoryGroups'), index: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const group = await requireOwnGroup(ctx, args.groupId);
		const index = requireIndex(args.index);
		const groups = (await normalGroups(ctx)).filter((g) => g._id !== group._id);
		groups.splice(index, 0, group);
		await writeGroupPositions(ctx, groups);
		return null;
	}
});

/** Hides a Category from the budget table, or shows it again. It still counts in every total. */
export const setHidden = mutation({
	args: { categoryId: v.id('categories'), hidden: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const category = await requireOwnCategory(ctx, args.categoryId);
		await ctx.db.patch('categories', category._id, { hidden: args.hidden });
		return null;
	}
});

/** Hides a Category Group, with all its Categories, from the budget table, or shows it again. */
export const setGroupHidden = mutation({
	args: { groupId: v.id('categoryGroups'), hidden: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const group = await requireOwnGroup(ctx, args.groupId);
		await ctx.db.patch('categoryGroups', group._id, { hidden: args.hidden });
		return null;
	}
});

/**
 * Deletes a Category after moving its Transactions, split lines, and Assigned amounts to `destinationId`, so
 * every month's Available and Ready to Assign come out as if they had been there all along.
 * Assigned sums into the destination's rows; a sum of zero removes the row.
 */
export const remove = mutation({
	args: { categoryId: v.id('categories'), destinationId: v.id('categories') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const category = await requireOwnCategory(ctx, args.categoryId);
		const destination = await requireOwnCategory(ctx, args.destinationId);
		if (destination._id === category._id) {
			throw publicError('INVALID_INPUT', 'Pick another Category to move its history to.');
		}

		// Each Transaction and split line moves under the same month and Account, so only both Categories' totals
		// for those keys change, and they are rebuilt from the Transactions.
		const keys = new Map<string, { month: string; accountId: Id<'accounts'> }>();
		const transactions = ctx.db
			.query('transactions')
			.withIndex('by_category_date', (q) => q.eq('categoryId', category._id));
		for await (const transaction of transactions) {
			const key = { month: monthOf(transaction.date), accountId: transaction.accountId };
			keys.set(`${key.month}|${key.accountId}`, key);
			await ctx.db.patch('transactions', transaction._id, { categoryId: destination._id });
		}
		const lines = ctx.db
			.query('transactionSplits')
			.withIndex('by_category_date', (q) => q.eq('categoryId', category._id));
		for await (const line of lines) {
			const parent = await ctx.db.get('transactions', line.transactionId);
			if (parent === null) continue;
			const key = { month: monthOf(line.date), accountId: parent.accountId };
			keys.set(`${key.month}|${key.accountId}`, key);
			await ctx.db.patch('transactionSplits', line._id, { categoryId: destination._id });
		}
		await rebuildTotals(ctx, [category._id, destination._id], keys.values());

		const assignments = ctx.db
			.query('assignments')
			.withIndex('by_category_month', (q) => q.eq('categoryId', category._id));
		for await (const row of assignments) {
			await ctx.db.delete('assignments', row._id);
			const existing = await ctx.db
				.query('assignments')
				.withIndex('by_month_category', (q) =>
					q.eq('month', row.month).eq('categoryId', destination._id)
				)
				.unique();
			const amount = (existing?.amount ?? 0) + row.amount;
			if (existing === null) {
				await ctx.db.insert('assignments', {
					month: row.month,
					categoryId: destination._id,
					amount: row.amount
				});
			} else if (amount === 0) {
				await ctx.db.delete('assignments', existing._id);
			} else {
				await ctx.db.patch('assignments', existing._id, { amount });
			}
		}

		await ctx.db.delete('categories', category._id);
		return null;
	}
});

/**
 * Deletes a Category Group. Its Categories, and their history, first move to the end of
 * `destinationGroupId`, which a group with Categories requires.
 */
export const removeGroup = mutation({
	args: {
		groupId: v.id('categoryGroups'),
		destinationGroupId: v.optional(v.id('categoryGroups'))
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const group = await requireOwnGroup(ctx, args.groupId);
		const categories = await ctx.db
			.query('categories')
			.withIndex('by_group_position', (q) => q.eq('groupId', group._id))
			.collect();
		if (categories.length > 0) {
			if (args.destinationGroupId === undefined) {
				throw publicError('INVALID_INPUT', 'Pick a group to move its Categories to.');
			}
			const destination = await requireOwnGroup(ctx, args.destinationGroupId);
			if (destination._id === group._id) {
				throw publicError('INVALID_INPUT', 'Pick another group to move its Categories to.');
			}
			const siblings = await categoriesIn(ctx, destination._id);
			await writePositions(ctx, destination._id, [...siblings, ...categories]);
		}
		await ctx.db.delete('categoryGroups', group._id);
		await writeGroupPositions(ctx, await normalGroups(ctx));
		return null;
	}
});

async function normalGroups(ctx: QueryCtx): Promise<Doc<'categoryGroups'>[]> {
	const groups = [];
	for await (const group of ctx.db.query('categoryGroups')) {
		if (group.kind === 'normal') groups.push(group);
	}
	return groups.sort((a, b) => a.position - b.position);
}

async function categoriesIn(
	ctx: QueryCtx,
	groupId: Id<'categoryGroups'>
): Promise<Doc<'categories'>[]> {
	return await ctx.db
		.query('categories')
		.withIndex('by_group_position', (q) => q.eq('groupId', groupId))
		.collect();
}

/** Makes `categories` the group's sibling list, in order, positioned 0, 1, 2, … */
async function writePositions(
	ctx: MutationCtx,
	groupId: Id<'categoryGroups'>,
	categories: readonly Doc<'categories'>[]
) {
	for (const [position, category] of categories.entries()) {
		if (category.groupId !== groupId || category.position !== position) {
			await ctx.db.patch('categories', category._id, { groupId, position });
		}
	}
}

/** Positions the normal groups 0, 1, 2, … in the order given. */
async function writeGroupPositions(ctx: MutationCtx, groups: readonly Doc<'categoryGroups'>[]) {
	for (const [position, group] of groups.entries()) {
		if (group.position !== position) {
			await ctx.db.patch('categoryGroups', group._id, { position });
		}
	}
}

function requireIndex(index: number): number {
	if (!Number.isSafeInteger(index) || index < 0) throw publicError('INVALID_INPUT');
	return index;
}
