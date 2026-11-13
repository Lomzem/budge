import { v } from 'convex/values';
import { Effect } from 'effect';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from './_generated/server';
import { findConnectionAccount, liveLayer, toPublicError } from './bankConnections';
import { accountKind } from './lib/accountKind';
import { bankImports, bankImportsSince, insertAccount } from './lib/accounts';
import { applyBankRows, planBankRows, type IncomingRow } from './lib/imports';
import { requireOwner } from './lib/owner';
import { ImportedPayees } from './lib/payees';
import { publicError } from './lib/publicError';
import { runEffect } from './lib/runEffect';
import { requireCutoverDate } from './lib/settings';
import {
	recordAccountsArgs,
	startingBalanceBasis as basis,
	suggestStartingBalance as suggest,
	syncConnection
} from './lib/sync';
import { dropHeldBankRow } from './lib/transactions';

export const HELD_BATCH = 200;
const MAX_COUNTED = 1_000;
const MAX_HELD_LISTED = 50;
const MAX_CONNECTION_ACCOUNTS = 50;

export const list = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id('connectionAccounts'),
			connectionId: v.id('bankConnections'),
			connectionName: v.string(),
			name: v.union(v.string(), v.null()),
			mask: v.union(v.string(), v.null()),
			kind: v.union(accountKind, v.null()),
			rows: v.number(),
			moreRows: v.boolean()
		})
	),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const held = [];
		const accounts = await ctx.db
			.query('connectionAccounts')
			.withIndex('by_state', (q) => q.eq('state', 'held'))
			.take(MAX_HELD_LISTED);
		for (const account of accounts) {
			const connection = await ctx.db.get('bankConnections', account.connectionId);
			if (connection === null) continue;
			const rows = await heldRows(ctx, account._id, MAX_COUNTED + 1);
			held.push({
				_id: account._id,
				connectionId: connection._id,
				connectionName: connection.name,
				name: account.name ?? null,
				mask: account.mask ?? null,
				kind: account.state === 'mapped' ? null : (account.kind ?? null),
				rows: Math.min(rows.length, MAX_COUNTED),
				moreRows: rows.length > MAX_COUNTED
			});
		}
		return held;
	}
});

export const map = mutation({
	args: { connectionAccountId: v.id('connectionAccounts'), accountId: v.id('accounts') },
	returns: v.null(),
	handler: async (ctx, { connectionAccountId, accountId }) => {
		await requireOwner(ctx);
		const held = await requireHeld(ctx, connectionAccountId);
		if ((await ctx.db.get('accounts', accountId)) === null) throw publicError('NOT_FOUND');
		await mapTo(ctx, held, accountId);
		return null;
	}
});

export const createAccount = mutation({
	args: {
		connectionAccountId: v.id('connectionAccounts'),
		name: v.string(),
		kind: accountKind
	},
	returns: v.id('accounts'),
	handler: async (ctx, { connectionAccountId, name, kind }) => {
		await requireOwner(ctx);
		const held = await requireHeld(ctx, connectionAccountId);
		const accountId = await insertAccount(ctx, { name, kind, startingBalance: 0 });
		await mapTo(ctx, held, accountId);
		return accountId;
	}
});

export const ignore = mutation({
	args: { connectionAccountId: v.id('connectionAccounts') },
	returns: v.null(),
	handler: async (ctx, { connectionAccountId }) => {
		await requireOwner(ctx);
		const held = await requireHeld(ctx, connectionAccountId);
		await setAside(ctx, held, 'ignored');
		await settleHeld(ctx, held._id);
		return null;
	}
});

export const stopSyncing = mutation({
	args: { connectionAccountId: v.id('connectionAccounts') },
	returns: v.null(),
	handler: async (ctx, { connectionAccountId }) => {
		await requireOwner(ctx);
		const mapped = await ctx.db.get('connectionAccounts', connectionAccountId);
		if (mapped === null) throw publicError('NOT_FOUND');
		if (mapped.state !== 'mapped') {
			throw publicError('INVALID_INPUT', "This bank Account doesn't feed a Budge Account.");
		}
		await setAside(ctx, mapped, 'ignored');
		return null;
	}
});

export const restore = mutation({
	args: { connectionAccountId: v.id('connectionAccounts') },
	returns: v.null(),
	handler: async (ctx, { connectionAccountId }) => {
		await requireOwner(ctx);
		const ignored = await ctx.db.get('connectionAccounts', connectionAccountId);
		if (ignored === null) throw publicError('NOT_FOUND');
		if (ignored.state !== 'ignored') {
			throw publicError('INVALID_INPUT', "This bank Account isn't ignored.");
		}
		await setAside(ctx, ignored, 'held');
		return null;
	}
});

export const forget = internalMutation({
	args: { connectionAccountId: v.id('connectionAccounts') },
	returns: v.null(),
	handler: async (ctx, { connectionAccountId }) => {
		const batch = await heldRows(ctx, connectionAccountId, HELD_BATCH);
		for (const row of batch) await dropHeldBankRow(ctx, row._id);
		if (batch.length === HELD_BATCH) {
			await ctx.scheduler.runAfter(0, internal.heldAccounts.forget, { connectionAccountId });
		} else if ((await ctx.db.get('connectionAccounts', connectionAccountId)) !== null) {
			await ctx.db.delete('connectionAccounts', connectionAccountId);
		}
		return null;
	}
});

export const suggestStartingBalance = action({
	args: { accountId: v.id('accounts') },
	returns: v.union(
		v.object({
			kind: v.literal('suggested'),
			startingBalance: v.number(),
			bankBalance: v.number(),
			imported: bankImports
		}),
		v.object({ kind: v.literal('notSynced') }),
		v.object({ kind: v.literal('importing') }),
		v.object({ kind: v.literal('noBalance') })
	),
	handler: async (ctx, { accountId }) => {
		await requireOwner(ctx);
		const unfinished: boolean = await ctx.runQuery(internal.heldAccounts.syncUnfinished, {
			accountId,
			now: Date.now()
		});
		if (unfinished) return { kind: 'importing' as const };
		return await runEffect(suggest(accountId).pipe(Effect.provide(liveLayer(ctx))), toPublicError);
	}
});

export const startingBalanceEvidence = query({
	args: { accountId: v.id('accounts') },
	returns: v.object({ since: v.string(), imported: bankImports }),
	handler: async (ctx, { accountId }) => {
		await requireOwner(ctx);
		if ((await ctx.db.get('accounts', accountId)) === null) throw publicError('NOT_FOUND');
		const since = await requireCutoverDate(ctx);
		return { since, imported: await bankImportsSince(ctx, accountId, since) };
	}
});

export const syncUnfinished = internalQuery({
	args: { accountId: v.id('accounts'), now: v.number() },
	returns: v.boolean(),
	handler: async (ctx, { accountId, now }) => {
		for await (const mapped of bankAccountsOf(ctx, accountId)) {
			const connection = await ctx.db.get('bankConnections', mapped.connectionId);
			if (connection?.provider.kind !== 'plaid') continue;
			const leased = (connection.syncLeaseUntil ?? 0) > now;
			if (leased || connection.provider.updateStart !== undefined) return true;
		}
		return false;
	}
});

export const discover = internalAction({
	args: { connectionId: v.id('bankConnections') },
	returns: v.null(),
	handler: async (ctx, { connectionId }) => {
		await runEffect(
			syncConnection(connectionId, { refresh: false, discover: true }).pipe(
				Effect.provide(liveLayer(ctx))
			),
			toPublicError
		);
		return null;
	}
});

export const settle = internalMutation({
	args: { connectionAccountId: v.id('connectionAccounts') },
	returns: v.null(),
	handler: async (ctx, { connectionAccountId }) => {
		await settleHeld(ctx, connectionAccountId);
		return null;
	}
});

export const recordAccounts = internalMutation({
	args: recordAccountsArgs,
	returns: v.null(),
	handler: async (ctx, { connectionId, answersRequestAt, accounts }) => {
		if (accounts.length > MAX_CONNECTION_ACCOUNTS) {
			throw publicError(
				'INVALID_INPUT',
				`A Bank Connection has at most ${String(MAX_CONNECTION_ACCOUNTS)} Accounts.`
			);
		}
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection === null) return null;
		for (const { externalId, name, mask, kind } of accounts) {
			const known = await findConnectionAccount(ctx, connectionId, externalId);
			if (known === null) {
				await ctx.db.insert('connectionAccounts', {
					connectionId,
					externalId,
					name,
					...(mask === undefined ? {} : { mask }),
					...(kind === undefined ? {} : { kind }),
					state: 'held'
				});
			} else if (known.state === 'mapped') {
				await ctx.db.patch('connectionAccounts', known._id, { name, mask });
			} else {
				await ctx.db.patch('connectionAccounts', known._id, { name, mask, kind });
			}
		}
		if (answersRequestAt != null && connection.accountsCheckRequestedAt === answersRequestAt) {
			await ctx.db.patch('bankConnections', connectionId, { accountsCheckRequestedAt: undefined });
		}
		return null;
	}
});

export const startingBalanceBasis = internalQuery({
	args: { accountId: v.id('accounts') },
	returns: basis,
	handler: async (ctx, { accountId }) => {
		const newest = await bankAccountsOf(ctx, accountId).order('desc').first();
		if (newest === null) return { kind: 'notSynced' as const };
		const connection = await ctx.db.get('bankConnections', newest.connectionId);
		if (connection?.provider.kind !== 'plaid') return { kind: 'notSynced' as const };
		for await (const mapped of bankAccountsOf(ctx, accountId)) {
			if ((await heldRows(ctx, mapped._id, 1)).length > 0) return { kind: 'importing' as const };
		}

		const imported = await bankImportsSince(ctx, accountId, await requireCutoverDate(ctx));
		return {
			kind: 'synced' as const,
			itemId: connection.provider.itemId,
			encryptedToken: connection.provider.encryptedToken,
			externalId: newest.externalId,
			imported
		};
	}
});

async function requireHeld(ctx: MutationCtx, connectionAccountId: Id<'connectionAccounts'>) {
	const held = await ctx.db.get('connectionAccounts', connectionAccountId);
	if (held === null) throw publicError('NOT_FOUND');
	if (held.state !== 'held') {
		throw publicError('INVALID_INPUT', 'This bank Account is already mapped or ignored.');
	}
	return held;
}

async function setAside(
	ctx: MutationCtx,
	bankAccount: Doc<'connectionAccounts'>,
	state: 'held' | 'ignored'
) {
	const { connectionId, externalId, name, mask } = bankAccount;
	const kind =
		bankAccount.state === 'mapped'
			? (await ctx.db.get('accounts', bankAccount.accountId))?.kind
			: bankAccount.kind;
	await ctx.db.replace('connectionAccounts', bankAccount._id, {
		connectionId,
		externalId,
		...(name === undefined ? {} : { name }),
		...(mask === undefined ? {} : { mask }),
		...(kind === undefined ? {} : { kind }),
		state
	});
}

async function mapTo(ctx: MutationCtx, held: Doc<'connectionAccounts'>, accountId: Id<'accounts'>) {
	const { connectionId, externalId, name, mask } = held;
	await ctx.db.replace('connectionAccounts', held._id, {
		connectionId,
		externalId,
		...(name === undefined ? {} : { name }),
		...(mask === undefined ? {} : { mask }),
		state: 'mapped',
		accountId
	});
	await settleHeld(ctx, held._id);
}

function bankAccountsOf(ctx: QueryCtx, accountId: Id<'accounts'>) {
	return ctx.db
		.query('connectionAccounts')
		.withIndex('by_accountId', (q) => q.eq('accountId', accountId));
}

async function heldRows(
	ctx: QueryCtx,
	connectionAccountId: Id<'connectionAccounts'>,
	limit: number
) {
	return await ctx.db
		.query('imports')
		.withIndex('by_connectionAccountId_state', (q) =>
			q.eq('connectionAccountId', connectionAccountId).eq('state', 'held')
		)
		.take(limit);
}

async function settleHeld(ctx: MutationCtx, connectionAccountId: Id<'connectionAccounts'>) {
	const owner = await ctx.db.get('connectionAccounts', connectionAccountId);
	if (owner === null || owner.state === 'held') return;
	const batch = await heldRows(ctx, connectionAccountId, HELD_BATCH);
	if (owner.state !== 'mapped') {
		for (const row of batch) await dropHeldBankRow(ctx, row._id);
	} else {
		const cutoverDate = await requireCutoverDate(ctx);
		const rows: IncomingRow[] = [];
		for (const row of batch) {
			if (row.date < cutoverDate) await dropHeldBankRow(ctx, row._id);
			else {
				rows.push({
					date: row.date,
					amount: row.amount,
					bankText: row.bankText,
					...(row.sourceId === undefined ? {} : { sourceId: row.sourceId }),
					...(row.merchantName === undefined ? {} : { merchantName: row.merchantName }),
					heldId: row._id
				});
			}
		}
		const plan = await planBankRows(ctx, owner.accountId, 'plaid', rows, connectionAccountId);
		await applyBankRows(
			ctx,
			owner.accountId,
			'plaid',
			plan,
			new ImportedPayees(),
			connectionAccountId
		);
	}
	if (batch.length === HELD_BATCH) {
		await ctx.scheduler.runAfter(0, internal.heldAccounts.settle, { connectionAccountId });
	}
}
