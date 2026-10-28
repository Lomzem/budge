import { defineApp } from 'convex/server';
import { v } from 'convex/values';

// Typed environment variables, read through `env` from `_generated/server`.
const app = defineApp({
	env: {
		// Clerk user ID of the only person allowed in
		BUDGE_OWNER_SUBJECT: v.string(),
		// Issuer of the Clerk instance paired with this deployment
		CLERK_JWT_ISSUER_DOMAIN: v.string(),
		// Set to any value on production only; the synthetic seed refuses to run there
		BUDGE_PRODUCTION: v.optional(v.string())
	}
});

export default app;
