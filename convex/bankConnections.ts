import { v } from 'convex/values';
import { Effect, Layer } from 'effect';

import type { PublicError } from '../src/lib/domain/publicError';
import type { Id } from './_generated/dataModel';
import {
	action,
	env,
	internalAction,
	internalMutation,
	query,
	type ActionCtx,
	type MutationCtx
} from './_generated/server';
import { applyBankRows, planBankRows, requireBankRow, type IncomingRow } from './lib/imports';
import { requireOwner } from './lib/owner';
import { ImportedPayees } from './lib/payees';
import { PlaidClient } from './lib/plaidClient';
import { publicError } from './lib/publicError';
import { runEffect } from './lib/runEffect';
import { requireCutoverDate } from './lib/settings';
import {
	applyArgs,
	applyResult,
	failArgs,
	leaseResult,
	LEASE_MS,
	MAX_SYNC_ROWS,
	saveArgs,
	setupConnection,
	SyncStore,
	syncConnection,
	type SyncError
} from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';

// A single owner has a handful of Bank Connections at most.
const MAX_CONNECTIONS = 20;

/**
 * Each Bank Connection's name and sync health, newest sync first. Never returns `provider`, which
 * holds the sealed token and Plaid's IDs.
 */
export const list = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id('bankConnections'),
			name: v.string(),
			status: v.union(v.literal('ok'), v.literal('needsAttention')),
			lastSyncedAt: v.union(v.number(), v.null()),
			lastError: v.union(v.object({ at: v.number(), message: v.string() }), v.null())
		})
	),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const connections = await ctx.db.query('bankConnections').take(MAX_CONNECTIONS);
		return connections.map((connection) => ({
			_id: connection._id,
			name: connection.name,
			status: connection.status,
			lastSyncedAt: connection.lastSyncedAt ?? null,
			lastError: connection.lastError ?? null
		}));
	}
});

/**
 * Sync now: syncs one Bank Connection, then asks Plaid to check the bank for anything newer. A sync
 * already running makes this a no-op, as does a connection with no bank login.
 */
export const syncNow = action({
	args: { connectionId: v.id('bankConnections') },
	returns: v.union(
		v.object({ kind: v.literal('synced'), added: v.number(), matched: v.number() }),
		v.object({ kind: v.literal('busy') }),
		v.object({ kind: v.literal('noToken') })
	),
	handler: async (ctx, { connectionId }) => {
		await requireOwner(ctx);
		const outcome = await runEffect(
			syncConnection(connectionId, { refresh: true }).pipe(Effect.provide(liveLayer(ctx))),
			toPublicError
		);
		if (outcome.kind === 'missing') throw publicError('NOT_FOUND');
		if (outcome.kind !== 'synced') return outcome;
		return { kind: 'synced' as const, added: outcome.added, matched: outcome.matched };
	}
});

/**
 * Connects Budge to an existing Plaid Item, run by the owner from the Convex dashboard or CLI. It
 * seals the access token, maps the bank's Accounts to Budge Accounts, and points the Item's webhook
 * at this deployment. It never creates or deletes a Plaid Item.
 */
export const setup = internalAction({
	args: {
		name: v.string(),
		itemId: v.string(),
		accessToken: v.string(),
		accounts: v.array(v.object({ externalId: v.string(), accountId: v.id('accounts') }))
	},
	returns: v.id('bankConnections'),
	handler: async (ctx, { accessToken, ...input }) =>
		await runEffect(
			setupConnection({
				...input,
				accessToken,
				webhook: `${env.CONVEX_SITE_URL}/plaid/webhook`
			}).pipe(Effect.provide(liveLayer(ctx))),
			toPublicError
		)
});

function liveLayer(ctx: ActionCtx) {
	return Layer.mergeAll(
		PlaidClient.layerLive({
			clientId: env.PLAID_CLIENT_ID,
			secret: env.PLAID_SECRET,
			environment: env.BUDGE_PRODUCTION === undefined ? 'sandbox' : 'production'
		}),
		TokenCipher.layer(env.BUDGE_TOKEN_KEY),
		SyncStore.layer(ctx)
	);
}

function toPublicError(error: SyncError): PublicError {
	if (error._tag === 'PlaidApi' && error.error_code === 'ITEM_LOGIN_REQUIRED') {
		return { code: 'BANK_CONNECTION_NEEDS_LOGIN', message: 'The bank needs you to sign in again.' };
	}
	return { code: 'BANK_UNAVAILABLE', message: "Couldn't sync with the bank; try again later." };
}

// The mutations sync runs (lib/sync.ts). Each checks the lease it was given is still the one held.

/** Takes the sync lease for about two minutes, unless another sync holds it. */
export const takeLease = internalMutation({
	args: { connectionId: v.id('bankConnections') },
	returns: leaseResult,
	handler: async (ctx, { connectionId }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection === null) return { kind: 'missing' as const };
		const now = Date.now();
		if ((connection.syncLeaseUntil ?? 0) > now) return { kind: 'busy' as const };
		const { provider } = connection;
		if (provider.kind !== 'plaid') return { kind: 'noToken' as const };
		const cutoverDate = await requireCutoverDate(ctx);
		const lease = now + LEASE_MS;
		await ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: lease });
		return {
			kind: 'taken' as const,
			lease,
			itemId: provider.itemId,
			encryptedToken: provider.encryptedToken,
			cursor: provider.cursor ?? null,
			cutoverDate
		};
	}
});

/**
 * Applies one batch of synced rows and moves the cursor past it, in one transaction, so a batch is
 * applied once or not at all. Rows from a bank Account not yet mapped to a Budge Account are held:
 * the Account is recorded for the owner to map, and its rows come back when its cursor is reset.
 * Refuses, writing nothing, once the lease or cursor is no longer the sync's.
 */
export const apply = internalMutation({
	args: applyArgs,
	returns: applyResult,
	handler: async (ctx, { connectionId, lease, fromCursor, nextCursor, rows, release }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (
			connection?.provider.kind !== 'plaid' ||
			connection.syncLeaseUntil !== lease ||
			(connection.provider.cursor ?? null) !== fromCursor
		) {
			return { kind: 'stale' as const };
		}
		if (rows.length > MAX_SYNC_ROWS) {
			throw new Error(`A sync batch holds at most ${String(MAX_SYNC_ROWS)} rows.`);
		}
		const cutoverDate = await requireCutoverDate(ctx);

		const byExternalId = new Map<string, IncomingRow[]>();
		for (const { externalAccountId, ...row } of rows) {
			const checked = requireBankRow(row, cutoverDate);
			byExternalId.set(externalAccountId, [
				...(byExternalId.get(externalAccountId) ?? []),
				checked
			]);
		}
		const payees = new ImportedPayees();
		const totals = { added: 0, matched: 0, held: 0 };
		for (const [externalId, accountRows] of byExternalId) {
			const target = await connectionAccountOf(ctx, connectionId, externalId);
			if (target.state !== 'mapped') {
				if (target.state === 'held') totals.held += accountRows.length;
				continue;
			}
			const plan = await planBankRows(ctx, target.accountId, 'plaid', accountRows);
			const counts = await applyBankRows(ctx, target.accountId, 'plaid', plan, payees, target._id);
			totals.added += counts.added;
			totals.matched += counts.matched;
		}

		const now = Date.now();
		const nextLease = release ? undefined : now + LEASE_MS;
		await ctx.db.patch('bankConnections', connectionId, {
			provider: { ...connection.provider, cursor: nextCursor },
			syncLeaseUntil: nextLease,
			...(release ? { lastSyncedAt: now, lastError: undefined, status: 'ok' as const } : {})
		});
		return { kind: 'applied' as const, lease: nextLease ?? null, ...totals };
	}
});

/** Records why a sync failed and releases its lease, unless a newer sync has taken over. */
export const fail = internalMutation({
	args: failArgs,
	returns: v.null(),
	handler: async (ctx, { connectionId, lease, message, needsLogin }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection?.syncLeaseUntil !== lease) return null;
		await ctx.db.patch('bankConnections', connectionId, {
			syncLeaseUntil: undefined,
			lastError: { at: Date.now(), message },
			...(needsLogin ? { status: 'needsAttention' as const } : {})
		});
		return null;
	}
});

/**
 * Saves the Bank Connection for a Plaid Item, replacing the token of one already saved for it, and
 * maps the given bank Accounts.
 */
export const save = internalMutation({
	args: saveArgs,
	returns: v.id('bankConnections'),
	handler: async (ctx, { name, itemId, encryptedToken, accounts }) => {
		for (const { accountId } of accounts) {
			if ((await ctx.db.get('accounts', accountId)) === null) throw publicError('NOT_FOUND');
		}
		const existing = (await ctx.db.query('bankConnections').take(MAX_CONNECTIONS)).find(
			(connection) => connection.provider.kind === 'plaid' && connection.provider.itemId === itemId
		);
		let connectionId: Id<'bankConnections'>;
		if (existing?.provider.kind === 'plaid') {
			connectionId = existing._id;
			await ctx.db.patch('bankConnections', connectionId, {
				name,
				status: 'ok',
				provider: { ...existing.provider, encryptedToken }
			});
		} else {
			connectionId = await ctx.db.insert('bankConnections', {
				name,
				status: 'ok',
				provider: { kind: 'plaid', itemId, encryptedToken }
			});
		}
		for (const { externalId, accountId } of accounts) {
			const known = await findConnectionAccount(ctx, connectionId, externalId);
			const mapped = { connectionId, externalId, state: 'mapped' as const, accountId };
			if (known === null) await ctx.db.insert('connectionAccounts', mapped);
			else await ctx.db.replace('connectionAccounts', known._id, mapped);
		}
		return connectionId;
	}
});

async function findConnectionAccount(
	ctx: MutationCtx,
	connectionId: Id<'bankConnections'>,
	externalId: string
) {
	return await ctx.db
		.query('connectionAccounts')
		.withIndex('by_connection_externalId', (q) =>
			q.eq('connectionId', connectionId).eq('externalId', externalId)
		)
		.unique();
}

/** The bank Account's mapping, held for the owner to map when sync first sees it. */
async function connectionAccountOf(
	ctx: MutationCtx,
	connectionId: Id<'bankConnections'>,
	externalId: string
) {
	const known = await findConnectionAccount(ctx, connectionId, externalId);
	if (known !== null) return known;
	const held = { connectionId, externalId, state: 'held' as const };
	return { _id: await ctx.db.insert('connectionAccounts', held), ...held };
}
