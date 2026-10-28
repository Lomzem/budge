import type { AuthConfig } from 'convex/server';

import { env } from './_generated/server';

// Clerk's Convex integration puts `aud: "convex"` on the session token.
export default {
	providers: [{ domain: env.CLERK_JWT_ISSUER_DOMAIN, applicationID: 'convex' }]
} satisfies AuthConfig;
