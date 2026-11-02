import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
	env: {
		BUDGE_OWNER_SUBJECT: v.string(),

		CLERK_JWT_ISSUER_DOMAIN: v.string(),

		BUDGE_PRODUCTION: v.optional(v.string()),

		PLAID_CLIENT_ID: v.optional(v.string()),
		PLAID_SECRET: v.optional(v.string()),

		BUDGE_TOKEN_KEY: v.optional(v.string())
	}
});

export default app;
