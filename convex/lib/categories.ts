import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** The Ready to Assign system Category, or `null` before Budge has created it. */
export async function readReadyToAssign(ctx: QueryCtx): Promise<Doc<'categories'> | null> {
	for await (const group of ctx.db.query('categoryGroups')) {
		if (group.kind !== 'readyToAssign') continue;
		return await ctx.db
			.query('categories')
			.withIndex('by_group_position', (q) => q.eq('groupId', group._id))
			.first();
	}
	return null;
}

/** The Ready to Assign system Category, created with its hidden system group on first use. */
export async function ensureReadyToAssign(ctx: MutationCtx): Promise<Id<'categories'>> {
	const existing = await readReadyToAssign(ctx);
	if (existing !== null) return existing._id;
	const groupId = await ctx.db.insert('categoryGroups', {
		name: 'Ready to Assign',
		position: -1,
		kind: 'readyToAssign'
	});
	return await ctx.db.insert('categories', {
		groupId,
		name: 'Ready to Assign',
		position: 0,
		kind: 'readyToAssign'
	});
}
