import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureReadyToAssign } from './lib/categories';
import { readCutoverDate, requireIsoDate } from './lib/settings';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';

/** Budge's settings. The cutover date is `null` until the owner sets it. */
export const get = query({
	args: {},
	returns: v.object({ cutoverDate: v.union(v.string(), v.null()) }),
	handler: async (ctx) => {
		await requireOwner(ctx);
		return { cutoverDate: await readCutoverDate(ctx) };
	}
});

/** Sets the date Budge starts from. No Transaction may be dated before it. */
export const setCutoverDate = mutation({
	args: { cutoverDate: v.string() },
	returns: v.null(),
	handler: async (ctx, { cutoverDate }) => {
		await requireOwner(ctx);
		requireIsoDate(cutoverDate);
		const earliest = await ctx.db.query('transactions').withIndex('by_date').first();
		if (earliest !== null && earliest.date < cutoverDate) {
			throw publicError('INVALID_INPUT', 'A Transaction is dated before that.');
		}
		const settings = await ctx.db.query('settings').first();
		await ensureReadyToAssign(ctx);
		if (settings === null) await ctx.db.insert('settings', { cutoverDate });
		else await ctx.db.patch('settings', settings._id, { cutoverDate });
		return null;
	}
});
