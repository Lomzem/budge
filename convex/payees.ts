import { v } from 'convex/values';

import { query } from './_generated/server';
import { findPayeeNamed, lastCategoryOf } from './lib/payees';
import { requireOwner } from './lib/owner';

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
