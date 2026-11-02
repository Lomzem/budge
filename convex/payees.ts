import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { findPayeeNamed, lastCategoryOf } from './lib/payees';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { refreshPayeeSearchText } from './lib/search';

/** More Payees than the filter's picker shows. */
const PAYEE_LIST_LIMIT = 1_000;

/** The Payees by name, for the Payee filter. */
export const list = query({
	args: {},
	returns: v.array(v.object({ _id: v.id('payees'), name: v.string() })),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const payees = await ctx.db.query('payees').withIndex('by_name').take(PAYEE_LIST_LIMIT);
		return payees.map(({ _id, name }) => ({ _id, name }));
	}
});

/**
 * Payee memory: the Category the Payee with this name was last given, so hand entry can pre-fill
 * it. `null` for a new Payee or one never categorized.
 */
export const lastCategory = query({
	args: { name: v.string() },
	returns: v.union(v.id('categories'), v.null()),
	handler: async (ctx, { name }) => {
		await requireOwner(ctx);
		const payee = await findPayeeNamed(ctx, name);
		return (payee === null ? undefined : await lastCategoryOf(ctx, payee)) ?? null;
	}
});

/**
 * Renames a Payee everywhere it appears. Its Transactions' `searchText` follows in batches: the
 * first in this mutation, the rest scheduled at once after it. Another Payee's name is refused, as
 * merging Payees isn't supported.
 */
export const rename = mutation({
	args: { payeeId: v.id('payees'), name: v.string() },
	returns: v.null(),
	handler: async (ctx, { payeeId, name }) => {
		await requireOwner(ctx);
		const payee = await ctx.db.get('payees', payeeId);
		if (payee === null) throw publicError('NOT_FOUND');
		const trimmed = name.trim();
		if (trimmed === '') throw publicError('INVALID_INPUT', 'A Payee needs a name.');
		if (trimmed === payee.name) return null;
		if ((await findPayeeNamed(ctx, trimmed)) !== null) {
			throw publicError('INVALID_INPUT', 'Another Payee already has this name.');
		}
		await ctx.db.patch('payees', payeeId, { name: trimmed });
		await refreshPayeeSearchText(ctx, payeeId, null);
		return null;
	}
});

/** The next batch of a Payee rename's `searchText` rewrite. */
export const refreshSearchText = internalMutation({
	args: { payeeId: v.id('payees'), cursor: v.string() },
	returns: v.null(),
	handler: async (ctx, { payeeId, cursor }) => {
		await refreshPayeeSearchText(ctx, payeeId, cursor);
		return null;
	}
});
