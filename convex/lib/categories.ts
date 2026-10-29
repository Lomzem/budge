import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { publicError } from './publicError';

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

/** A Category the owner may change: not one Budge manages. */
export async function requireOwnCategory(
	ctx: QueryCtx,
	categoryId: Id<'categories'>
): Promise<Doc<'categories'>> {
	const category = await ctx.db.get('categories', categoryId);
	if (category === null) throw publicError('NOT_FOUND');
	if (category.kind !== 'normal')
		throw publicError('INVALID_INPUT', 'Budge manages that Category.');
	return category;
}

/** A Category Group the owner may change: not one Budge manages. */
export async function requireOwnGroup(
	ctx: QueryCtx,
	groupId: Id<'categoryGroups'>
): Promise<Doc<'categoryGroups'>> {
	const group = await ctx.db.get('categoryGroups', groupId);
	if (group === null) throw publicError('NOT_FOUND');
	if (group.kind !== 'normal') throw publicError('INVALID_INPUT', 'Budge manages that group.');
	return group;
}
