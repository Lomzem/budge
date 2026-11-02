import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import { rebuildMonthlyTotals } from './lib/monthlyTotals';

export const rebuild = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		await rebuildMonthlyTotals(ctx);
		return null;
	}
});
