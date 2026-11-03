import { convexTest } from 'convex-test';
import { afterEach, beforeEach, vi } from 'vitest';

import { readPublicError } from '../src/lib/publicError';
import schema from './schema';

export const modules = import.meta.glob('./**/*.ts');

export const ownerSubject = 'user_owner';
export const clerkIssuer = 'https://budge-dev.clerk.accounts.dev';

export function useOwnerEnv() {
	beforeEach(() => {
		vi.stubEnv('BUDGE_OWNER_SUBJECT', ownerSubject);
		vi.stubEnv('CLERK_JWT_ISSUER_DOMAIN', clerkIssuer);
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});
}

export function newBackend() {
	const t = convexTest(schema, modules);
	return { t, owner: t.withIdentity({ subject: ownerSubject, issuer: clerkIssuer }) };
}

export async function publicErrorOf(call: Promise<unknown>) {
	const error: unknown = await call.then(
		() => undefined,
		(thrown: unknown) => thrown
	);
	return readPublicError(error);
}

export async function publicErrorCode(call: Promise<unknown>) {
	return (await publicErrorOf(call))?.code;
}

export async function publicErrorMessage(call: Promise<unknown>) {
	return (await publicErrorOf(call))?.message;
}
