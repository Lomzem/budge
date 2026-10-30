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

/**
 * Creates a Credit Card Account's Payment Category, named after the card, at the end of the
 * Credit Card Payments system group, which is created on first use.
 */
export async function createPaymentCategory(
	ctx: MutationCtx,
	account: Pick<Doc<'accounts'>, '_id' | 'name'>
): Promise<Id<'categories'>> {
	let groupId: Id<'categoryGroups'> | undefined;
	for await (const group of ctx.db.query('categoryGroups')) {
		if (group.kind === 'creditCardPayments') groupId = group._id;
	}
	groupId ??= await ctx.db.insert('categoryGroups', {
		name: 'Credit Card Payments',
		position: -1,
		kind: 'creditCardPayments'
	});
	const last = await ctx.db
		.query('categories')
		.withIndex('by_group_position', (q) => q.eq('groupId', groupId))
		.order('desc')
		.first();
	return await ctx.db.insert('categories', {
		groupId,
		name: account.name,
		position: (last?.position ?? -1) + 1,
		kind: 'creditCardPayment',
		accountId: account._id
	});
}

/** A Credit Card Account's Payment Category, or `null` for a Cash Account. */
export async function readPaymentCategory(
	ctx: QueryCtx,
	accountId: Id<'accounts'>
): Promise<Doc<'categories'> | null> {
	return await ctx.db
		.query('categories')
		.withIndex('by_account', (q) => q.eq('accountId', accountId))
		.unique();
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
