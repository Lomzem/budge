import { convexTest } from 'convex-test';
import { afterEach, assert, beforeEach, vi } from 'vitest';

import { readPublicError } from '../src/lib/publicError';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
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

export async function publicErrorCode(call: Promise<unknown>) {
	const error: unknown = await call.then(
		() => undefined,
		(thrown: unknown) => thrown
	);
	return readPublicError(error)?.code;
}

export async function publicErrorMessage(call: Promise<unknown>) {
	const error: unknown = await call.then(
		() => undefined,
		(thrown: unknown) => thrown
	);
	return readPublicError(error)?.message;
}

type Backend = ReturnType<typeof newBackend>['t'];

export async function makeLegacyStartingBalance(
	t: Backend,
	accountId: Id<'accounts'>,
	splits: readonly { categoryId: Id<'categories'>; amount: number }[] = []
) {
	await t.run(async (ctx) => {
		const startingBalance = await ctx.db
			.query('transactions')
			.withIndex('by_accountId_and_kind', (q) =>
				q.eq('accountId', accountId).eq('kind', 'startingBalance')
			)
			.unique();
		assert(startingBalance !== null, 'expected a starting balance to make legacy');
		const payeeId =
			(
				await ctx.db
					.query('payees')
					.withIndex('by_name', (q) => q.eq('name', 'Starting Balance'))
					.unique()
			)?._id ?? (await ctx.db.insert('payees', { name: 'Starting Balance' }));
		await ctx.db.patch('transactions', startingBalance._id, {
			kind: undefined,
			payeeId,
			...(splits.length === 0 ? {} : { split: true, categoryId: undefined })
		});
		for (const line of splits) {
			await ctx.db.insert('transactionSplits', {
				...line,
				transactionId: startingBalance._id,
				date: startingBalance.date
			});
		}
	});
	await t.mutation(internal.monthlyTotals.rebuild, {});
}
