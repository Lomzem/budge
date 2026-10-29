import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { readPublicError } from '../src/lib/publicError';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const ownerSubject = 'user_owner';
const clerkIssuer = 'https://budge-dev.clerk.accounts.dev';

// Valid arguments for every public function, so the guard (not argument validation) is what
// rejects a caller. A new public function fails the sweep below until it is listed here.
function sampleArgs(ids: {
	accountId: Id<'accounts'>;
	transactionId: Id<'transactions'>;
	groupId: Id<'categoryGroups'>;
	categoryId: Id<'categories'>;
}) {
	const { accountId, transactionId, groupId, categoryId } = ids;
	const entry = { accountId, date: '2026-08-14', amount: -500, payee: 'Corner Grocer', memo: '' };
	const args: Record<string, Record<string, unknown>> = {
		'owner:whoami': {},
		'settings:get': {},
		'settings:setCutoverDate': { cutoverDate: '2026-08-01' },
		'accounts:list': {},
		'accounts:create': { name: 'Wallet', kind: 'cash', startingBalance: 0 },
		'accounts:rename': { accountId, name: 'Wallet' },
		'accounts:reorder': { accountIds: [accountId] },
		'transactions:list': { paginationOpts: { numItems: 10, cursor: null } },
		'transactions:create': entry,
		'transactions:update': { transactionId, ...entry },
		'transactions:remove': { transactionId },
		'transactions:setCleared': { transactionId, cleared: true },
		'categories:list': {},
		'categories:createGroup': { name: 'Bills' },
		'categories:create': { groupId, name: 'Rent' },
		'categories:rename': { categoryId, name: 'Rent' },
		'categories:renameGroup': { groupId, name: 'Bills' },
		'categories:move': { categoryId, groupId, index: 0 },
		'categories:moveGroup': { groupId, index: 0 },
		'categories:setHidden': { categoryId, hidden: true },
		'categories:setGroupHidden': { groupId, hidden: true },
		'categories:remove': { categoryId, destinationId: categoryId },
		'categories:removeGroup': { groupId },
		'categories:setTarget': { categoryId, target: null },
		'budget:month': { month: '2026-08', today: '2026-08-14' },
		'budget:setAssigned': { month: '2026-08', categoryId, amount: 500 },
		'budget:moveMoney': {
			month: '2026-08',
			fromCategoryId: categoryId,
			toCategoryId: categoryId,
			amount: 500
		},
		'budget:cover': { month: '2026-08', categoryId },
		'budget:assignTarget': { month: '2026-08', categoryId }
	};
	return args;
}

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
		const t = convexTest(schema, modules);
		const owner = t.withIdentity({ subject: ownerSubject, issuer: clerkIssuer });

		expect(await owner.query(api.owner.whoami, {})).toEqual({ subject: ownerSubject });
	});

	test('lets nobody in when the owner is not configured', async () => {
		vi.stubEnv('BUDGE_OWNER_SUBJECT', '');
		const t = convexTest(schema, modules);
		const owner = t.withIdentity({ subject: ownerSubject, issuer: clerkIssuer });

		expect(await publicErrorCode(owner.query(api.owner.whoami, {}))).toBe('FORBIDDEN');
	});

	test('every public function rejects anyone but the owner', async () => {
		const t = convexTest(schema, modules);
		const ids = await t.run(async (ctx) => {
			const accountId = await ctx.db.insert('accounts', {
				name: 'Checking',
				kind: 'cash',
				position: 0
			});
			const transactionId = await ctx.db.insert('transactions', {
				accountId,
				date: '2026-08-01',
				amount: 0,
				cleared: 'uncleared'
			});
			const groupId = await ctx.db.insert('categoryGroups', {
				name: 'Bills',
				position: 0,
				kind: 'normal'
			});
			const categoryId = await ctx.db.insert('categories', {
				groupId,
				name: 'Rent',
				position: 0,
				kind: 'normal'
			});
			return { accountId, transactionId, groupId, categoryId };
		});
		const sample = sampleArgs(ids);
		const callers = {
			anonymous: t,
			'another Clerk user': t.withIdentity({ subject: 'user_stranger', issuer: clerkIssuer }),
			"the owner's subject from another issuer": t.withIdentity({
				subject: ownerSubject,
				issuer: 'https://elsewhere.example'
			})
		};
		const functions = await publicFunctions();

		expect(functions.map((fn) => fn.name).sort()).toEqual(Object.keys(sample).sort());
		for (const { name, kind } of functions) {
			const args = sample[name] ?? {};
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
