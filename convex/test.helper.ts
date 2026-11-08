import { convexTest } from 'convex-test';
import { afterEach, assert, beforeEach, vi } from 'vitest';

import { readPublicError } from '../src/lib/publicError';
import { api, internal } from './_generated/api';
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

type Backend = ReturnType<typeof newBackend>['t'];

type AccountKind = 'cash' | 'creditCard';

export async function startBudget<
	const Accounts extends Record<string, readonly [AccountKind, number]>,
	const Groups extends Record<string, readonly string[]>
>({
	cutoverDate = '2026-08-01',
	accounts,
	groups
}: { cutoverDate?: string; accounts?: Accounts; groups?: Groups } = {}) {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate });
	const accountIds: Record<string, Id<'accounts'>> = {};
	for (const [name, [kind, startingBalance]] of Object.entries(accounts ?? {})) {
		accountIds[name] = await owner.mutation(api.accounts.create, { name, kind, startingBalance });
	}
	const groupIds: Record<string, Id<'categoryGroups'>> = {};
	const categoryIds: Record<string, Id<'categories'>> = {};
	for (const [groupName, categoryNames] of Object.entries(groups ?? {})) {
		const groupId = await owner.mutation(api.categories.createGroup, { name: groupName });
		groupIds[groupName] = groupId;
		for (const name of categoryNames) {
			categoryIds[name] = await owner.mutation(api.categories.create, { groupId, name });
		}
	}
	const { readyToAssignId } = await owner.query(api.categories.list, {});
	assert(readyToAssignId !== null, 'setting the cutover date creates Ready to Assign');
	return {
		...backend,
		accounts: accountIds as Readonly<Record<keyof Accounts, Id<'accounts'>>>,
		groups: groupIds as Readonly<Record<keyof Groups, Id<'categoryGroups'>>>,
		categories: categoryIds as Readonly<Record<Groups[keyof Groups][number], Id<'categories'>>>,
		readyToAssignId
	};
}

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
