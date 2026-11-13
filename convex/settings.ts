import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureReadyToAssign } from './lib/categories';
import { laterCutoverPreview, previewLaterCutover as preview } from './lib/laterCutover';
import { readCutoverDate, requireIsoDate } from './lib/settings';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';

export const get = query({
	args: {},
	returns: v.object({ cutoverDate: v.union(v.string(), v.null()) }),
	handler: async (ctx) => {
		await requireOwner(ctx);
		return { cutoverDate: await readCutoverDate(ctx) };
	}
});

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

export const previewLaterCutover = query({
	args: { cutoverDate: v.string(), today: v.string() },
	returns: laterCutoverPreview,
	handler: async (ctx, { cutoverDate, today }) => {
		await requireOwner(ctx);
		requireIsoDate(cutoverDate);
		requireIsoDate(today);
		return await preview(ctx, cutoverDate, today);
	}
});
