import { v } from 'convex/values';

import { query } from './_generated/server';
import { requireOwner } from './lib/owner';

/** Proves the caller is the owner. The app shell asks this before showing anything. */
export const whoami = query({
	args: {},
	returns: v.object({ subject: v.string() }),
	handler: async (ctx) => {
		const owner = await requireOwner(ctx);
		return { subject: owner.subject };
	}
});
