import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import { rebuildMonthlyTotals } from './lib/monthlyTotals';

/** Recreates the monthly totals cache from the Transactions (ADR 0002). */
export const rebuild = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		await rebuildMonthlyTotals(ctx);
		return null;
	}
});
