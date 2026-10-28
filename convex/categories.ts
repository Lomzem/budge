import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureReadyToAssign, readReadyToAssign } from './lib/categories';
import { requireName } from './lib/input';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';

/** Every Category a Transaction can take: Ready to Assign, then the groups in table order. */
export const list = query({
	args: {},
	returns: v.object({
		readyToAssignId: v.union(v.id('categories'), v.null()),
		groups: v.array(
			v.object({
				_id: v.id('categoryGroups'),
				name: v.string(),
				categories: v.array(v.object({ _id: v.id('categories'), name: v.string() }))
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
					categories: (
						await ctx.db
							.query('categories')
							.withIndex('by_group_position', (q) => q.eq('groupId', group._id))
							.collect()
					).map(({ _id, name }) => ({ _id, name }))
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
