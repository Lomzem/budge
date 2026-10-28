/// <reference types="vite/client" />
// Shared by the `convex-test` suites. The bundler skips files with more than one dot, so this
// never deploys.
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, vi } from 'vitest';

import { readPublicError } from '../src/lib/publicError';
import schema from './schema';

export const modules = import.meta.glob('./**/*.ts');

export const ownerSubject = 'user_owner';
export const clerkIssuer = 'https://budge-dev.clerk.accounts.dev';

/** Makes `ownerSubject` the owner of every backend the suite creates. */
export function useOwnerEnv() {
	beforeEach(() => {
		vi.stubEnv('BUDGE_OWNER_SUBJECT', ownerSubject);
		vi.stubEnv('CLERK_JWT_ISSUER_DOMAIN', clerkIssuer);
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});
}

/** A fresh in-memory backend, and a client signed in as its owner. */
export function newBackend() {
	const t = convexTest(schema, modules);
	return { t, owner: t.withIdentity({ subject: ownerSubject, issuer: clerkIssuer }) };
}

/** The public error code a call failed with, or `undefined` if it succeeded or hit a defect. */
export async function publicErrorCode(call: Promise<unknown>) {
	const error: unknown = await call.then(
		() => undefined,
		(thrown: unknown) => thrown
	);
	return readPublicError(error)?.code;
}
