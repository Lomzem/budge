import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureReadyToAssign } from './lib/categories';
import {
	applyLaterCutover as apply,
	lastCutoverMove,
	laterCutoverPreview,
	previewLaterCutover as preview,
	undoLaterCutover as undo
} from './lib/laterCutover';
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

export const applyLaterCutover = mutation({
	args: {
		cutoverDate: v.string(),
		today: v.string(),
		fingerprint: v.string(),
		unlockReconciled: v.boolean()
	},
	returns: v.id('cutoverMoves'),
	handler: async (ctx, { cutoverDate, today, fingerprint, unlockReconciled }) => {
		await requireOwner(ctx);
		requireIsoDate(cutoverDate);
		requireIsoDate(today);
		return await apply(ctx, { to: cutoverDate, today, fingerprint, unlockReconciled });
	}
});

export const lastMove = query({
	args: {},
	returns: v.union(
		v.object({
			moveId: v.id('cutoverMoves'),
			from: v.string(),
			to: v.string(),
			movedAt: v.number()
		}),
		v.null()
	),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const move = await lastCutoverMove(ctx);
		if (move === null) return null;
		return { moveId: move._id, from: move.from, to: move.to, movedAt: move._creationTime };
	}
});

export const undoLaterCutover = mutation({
	args: { moveId: v.id('cutoverMoves') },
	returns: v.null(),
	handler: async (ctx, { moveId }) => {
		await requireOwner(ctx);
		await undo(ctx, moveId);
		return null;
	}
});
