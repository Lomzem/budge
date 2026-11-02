import { v } from 'convex/values';

import { query } from './_generated/server';
import { requireOwner } from './lib/owner';

export const whoami = query({
	args: {},
	returns: v.object({ subject: v.string() }),
	handler: async (ctx) => {
		const owner = await requireOwner(ctx);
		return { subject: owner.subject };
	}
});
