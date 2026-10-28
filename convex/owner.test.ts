import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { readPublicError } from '../src/lib/publicError';
import { api } from './_generated/api';

const modules = import.meta.glob('./**/*.ts');

const ownerSubject = 'user_owner';
const clerkIssuer = 'https://budge-dev.clerk.accounts.dev';

// Valid arguments for every public function, so the guard (not argument validation) is what
// rejects a caller. A new public function fails the sweep below until it is listed here.
const sampleArgs: Record<string, Record<string, unknown>> = {
	'owner:whoami': {}
};

type Kind = 'query' | 'mutation' | 'action';

async function publicFunctions() {
	const found: { name: string; kind: Kind }[] = [];
	for (const [path, load] of Object.entries(modules)) {
		if (path.startsWith('./_generated/') || path.endsWith('.test.ts')) continue;
		const exports = (await load()) as Record<string, unknown>;
		for (const [exportName, fn] of Object.entries(exports)) {
			if (typeof fn !== 'function' || !('isPublic' in fn)) continue;
			const kind: Kind = 'isQuery' in fn ? 'query' : 'isMutation' in fn ? 'mutation' : 'action';
			found.push({ name: `${path.slice(2, -3)}:${exportName}`, kind });
		}
	}
	return found;
}

beforeEach(() => {
	vi.stubEnv('BUDGE_OWNER_SUBJECT', ownerSubject);
	vi.stubEnv('CLERK_JWT_ISSUER_DOMAIN', clerkIssuer);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function publicErrorCode(call: Promise<unknown>) {
	const error: unknown = await call.then(
		() => undefined,
		(thrown: unknown) => thrown
	);
	return readPublicError(error)?.code;
}

describe('the owner guard', () => {
	test('lets the owner in', async () => {
		const t = convexTest(undefined, modules);
		const owner = t.withIdentity({ subject: ownerSubject, issuer: clerkIssuer });

		expect(await owner.query(api.owner.whoami, {})).toEqual({ subject: ownerSubject });
	});

	test('lets nobody in when the owner is not configured', async () => {
		vi.stubEnv('BUDGE_OWNER_SUBJECT', '');
		const t = convexTest(undefined, modules);
		const owner = t.withIdentity({ subject: ownerSubject, issuer: clerkIssuer });

		expect(await publicErrorCode(owner.query(api.owner.whoami, {}))).toBe('FORBIDDEN');
	});

	test('every public function rejects anyone but the owner', async () => {
		const t = convexTest(undefined, modules);
		const callers = {
			anonymous: t,
			'another Clerk user': t.withIdentity({ subject: 'user_stranger', issuer: clerkIssuer }),
			"the owner's subject from another issuer": t.withIdentity({
				subject: ownerSubject,
				issuer: 'https://elsewhere.example'
			})
		};
		const functions = await publicFunctions();

		expect(functions.map((fn) => fn.name).sort()).toEqual(Object.keys(sampleArgs).sort());
		for (const { name, kind } of functions) {
			const args = sampleArgs[name] ?? {};
			for (const [caller, client] of Object.entries(callers)) {
				const call =
					kind === 'query'
						? client.query(makeFunctionReference<'query'>(name), args)
						: kind === 'mutation'
							? client.mutation(makeFunctionReference<'mutation'>(name), args)
							: client.action(makeFunctionReference<'action'>(name), args);
				expect(await publicErrorCode(call), `${name} as ${caller}`).toBe('FORBIDDEN');
			}
		}
	});
});
