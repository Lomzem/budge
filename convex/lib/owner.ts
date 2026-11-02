import type { Auth, UserIdentity } from 'convex/server';

import { env } from '../_generated/server';
import { publicError } from './publicError';

export async function requireOwner(ctx: { auth: Auth }): Promise<UserIdentity> {
	const identity = await ctx.auth.getUserIdentity();
	const ownerSubject = env.BUDGE_OWNER_SUBJECT;
	const issuer = env.CLERK_JWT_ISSUER_DOMAIN;
	if (
		identity === null ||
		!ownerSubject ||
		!issuer ||
		identity.subject !== ownerSubject ||
		identity.issuer !== issuer
	) {
		throw publicError('FORBIDDEN');
	}
	return identity;
}
