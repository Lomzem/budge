import { v, type Infer } from 'convex/values';
import { Effect, Layer } from 'effect';

import { isSyncOverdue, renewalDue } from '../src/lib/domain/freshness';
import type { PublicError } from '../src/lib/domain/publicError';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
	action,
	env,
	internalAction,
	internalMutation,
	internalQuery,
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
	reconnectLinkToken,
	RETRY_DELAYS_MS,
	saveArgs,
	setupConnection,
	SyncStore,
	syncConnection,
	type SyncError
} from './lib/sync';
import { failureOf, failureOfPlaidCode } from './lib/syncFailure';
import { TokenCipher } from './lib/tokenCipher';

// A single owner has a handful of Bank Connections at most.
const MAX_CONNECTIONS = 20;

/**
 * Each Bank Connection's name and sync health as of `now`: `overdue` once 48 hours pass without a
 * successful sync, and `consentEndsAt` from 14 days before the bank's consent ends. Never returns
 * `provider`, which holds the sealed token and Plaid's IDs.
 */
export const list = query({
	args: { now: v.number() },
	returns: v.array(
		v.object({
			_id: v.id('bankConnections'),
			name: v.string(),
			status: v.union(v.literal('ok'), v.literal('needsAttention')),
			lastSyncedAt: v.union(v.number(), v.null()),
			overdue: v.boolean(),
			consentEndsAt: v.union(v.number(), v.null()),
			lastError: v.union(v.object({ at: v.number(), message: v.string() }), v.null())
		})
	),
	handler: async (ctx, { now }) => {
		await requireOwner(ctx);
		const connections = await ctx.db.query('bankConnections').take(MAX_CONNECTIONS);
		return connections.map((connection) => ({
			_id: connection._id,
			name: connection.name,
			status: connection.status,
			lastSyncedAt: connection.lastSyncedAt ?? null,
			overdue: isSyncOverdue(connection.lastSyncedAt ?? null, now),
			consentEndsAt: renewalDue(connection.consentExpiresAt ?? null, now),
			lastError: connection.lastError ?? null
		}));
	}
});

const ownerSyncResult = v.union(
	v.object({ kind: v.literal('synced'), added: v.number(), matched: v.number() }),
	v.object({ kind: v.literal('busy') }),
	v.object({ kind: v.literal('noToken') })
);

/**
 * Sync now: syncs one Bank Connection, then asks Plaid to check the bank for anything newer. A sync
 * already running makes this a no-op, as does a connection with no bank login. It runs even while
 * the connection needs the owner, since the owner asked.
 */
export const syncNow = action({
	args: { connectionId: v.id('bankConnections') },
	returns: ownerSyncResult,
	handler: async (ctx, { connectionId }) => {
		await requireOwner(ctx);
		return await ownerSync(ctx, connectionId, { refresh: true });
	}
});

/**
 * Reconnect, first step: a Plaid Link token in update mode for the Bank Connection's existing
 * Item. It never creates or deletes a Plaid Item.
 */
export const reconnect = action({
	args: { connectionId: v.id('bankConnections') },
	returns: v.object({ linkToken: v.string() }),
	handler: async (ctx, { connectionId }) => {
		await requireOwner(ctx);
		const result = await runEffect(
			reconnectLinkToken(connectionId).pipe(Effect.provide(liveLayer(ctx))),
			toPublicError
		);
		if (result.kind === 'missing') throw publicError('NOT_FOUND');
		if (result.kind === 'noToken') {
			throw publicError('INVALID_INPUT', 'This Bank Connection has no bank login to reconnect.');
		}
		return { linkToken: result.linkToken };
	}
});

/** Reconnect, last step: once Plaid Link succeeds, syncs at once; success clears the notice. */
export const syncAfterReconnect = action({
	args: { connectionId: v.id('bankConnections') },
	returns: ownerSyncResult,
	handler: async (ctx, { connectionId }) => {
		await requireOwner(ctx);
		return await ownerSync(ctx, connectionId, { refresh: false });
	}
});

/** A sync the owner started, so it runs even while the Bank Connection needs them. */
async function ownerSync(
	ctx: ActionCtx,
	connectionId: Id<'bankConnections'>,
	{ refresh }: { refresh: boolean }
): Promise<Infer<typeof ownerSyncResult>> {
	const outcome = await runEffect(
		syncConnection(connectionId, { refresh, resume: true }).pipe(Effect.provide(liveLayer(ctx))),
		toPublicError
	);
	if (outcome.kind === 'missing') throw publicError('NOT_FOUND');
	// `resume` means it is never paused.
	if (outcome.kind === 'paused') throw new Error('An owner sync was paused');
	if (outcome.kind !== 'synced') return outcome;
	return { kind: 'synced', added: outcome.added, matched: outcome.matched };
}

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

/**
 * A retry after a short-lived failure. Its own failure is already recorded or retried again; only
 * a defect surfaces.
 */
export const retrySync = internalAction({
	args: { connectionId: v.id('bankConnections'), attempt: v.number() },
	returns: v.null(),
	handler: async (ctx, { connectionId, attempt }) => {
		await Effect.runPromise(
			syncConnection(connectionId, { refresh: false, attempt }).pipe(
				Effect.ignore,
				Effect.provide(liveLayer(ctx))
			)
		);
		return null;
	}
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
	if (failureOf(error).status === 'needsAttention') {
		return { code: 'BANK_CONNECTION_NEEDS_LOGIN', message: 'The bank needs you to reconnect.' };
	}
	return { code: 'BANK_UNAVAILABLE', message: "Couldn't reach the bank; try again later." };
}

// The mutations sync runs (lib/sync.ts). Each checks the lease it was given is still the one held.

/**
 * Plaid's word, outside a sync, about an Item: a code such as `PENDING_DISCONNECT` or
 * `USER_PERMISSION_REVOKED` that needs the owner pauses its Bank Connection's sync until Reconnect.
 * Any other code, or an Item Budge doesn't know, changes nothing.
 */
export const flagItem = internalMutation({
	args: { itemId: v.string(), code: v.string() },
	returns: v.null(),
	handler: async (ctx, { itemId, code }) => {
		const failure = failureOfPlaidCode(code);
		if (failure.status !== 'needsAttention') return null;
		const connection = await ctx.db
			.query('bankConnections')
			.withIndex('by_itemId', (q) => q.eq('provider.itemId', itemId))
			.first();
		if (connection === null) return null;
		await ctx.db.patch('bankConnections', connection._id, {
			status: 'needsAttention',
			lastError: { at: Date.now(), message: failure.message }
		});
		return null;
	}
});

/** The Bank Connection's Plaid Item and sealed token, for Reconnect. */
export const credentials = internalQuery({
	args: { connectionId: v.id('bankConnections') },
	returns: v.union(
		v.literal('missing'),
		v.literal('noToken'),
		v.object({ itemId: v.string(), encryptedToken: v.string() })
	),
	handler: async (ctx, { connectionId }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection === null) return 'missing' as const;
		const { provider } = connection;
		if (provider.kind !== 'plaid') return 'noToken' as const;
		return { itemId: provider.itemId, encryptedToken: provider.encryptedToken };
	}
});

/** Records when the bank's consent ends, as Plaid last reported it. */
export const recordConsent = internalMutation({
	args: {
		connectionId: v.id('bankConnections'),
		consentExpiresAt: v.union(v.number(), v.null())
	},
	returns: v.null(),
	handler: async (ctx, { connectionId, consentExpiresAt }) => {
		await ctx.db.patch('bankConnections', connectionId, {
			consentExpiresAt: consentExpiresAt ?? undefined
		});
		return null;
	}
});

/** Takes the sync lease for about two minutes, unless another sync holds it. */
export const takeLease = internalMutation({
	args: { connectionId: v.id('bankConnections'), resume: v.boolean() },
	returns: leaseResult,
	handler: async (ctx, { connectionId, resume }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection === null) return { kind: 'missing' as const };
		const now = Date.now();
		if ((connection.syncLeaseUntil ?? 0) > now) return { kind: 'busy' as const };
		const { provider } = connection;
		if (provider.kind !== 'plaid') return { kind: 'noToken' as const };
		if (connection.status === 'needsAttention' && !resume) return { kind: 'paused' as const };
		const cutoverDate = await requireCutoverDate(ctx);
		const lease = now + LEASE_MS;
		await ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: lease });
		return {
			kind: 'taken' as const,
			lease,
			itemId: provider.itemId,
			encryptedToken: provider.encryptedToken,
			cursor: provider.cursor ?? null,
			updateStart:
				provider.updateStart === undefined ? (provider.cursor ?? null) : provider.updateStart,
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
	handler: async (ctx, { connectionId, lease, fromCursor, nextCursor, hasMore, rows, release }) => {
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
		// An update keeps its start until Plaid has no more pages of it.
		const { updateStart, ...provider } = connection.provider;
		await ctx.db.patch('bankConnections', connectionId, {
			provider: {
				...provider,
				cursor: nextCursor,
				...(hasMore ? { updateStart: updateStart === undefined ? fromCursor : updateStart } : {})
			},
			syncLeaseUntil: nextLease,
			...(release ? { lastSyncedAt: now, lastError: undefined, status: 'ok' as const } : {})
		});
		return { kind: 'applied' as const, lease: nextLease ?? null, ...totals };
	}
});

/** Extends the sync lease it was given, unless a newer sync has taken over. */
export const renewLease = internalMutation({
	args: { connectionId: v.id('bankConnections'), lease: v.number() },
	returns: v.union(v.number(), v.null()),
	handler: async (ctx, { connectionId, lease }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection?.syncLeaseUntil !== lease) return null;
		const renewed = Date.now() + LEASE_MS;
		await ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: renewed });
		return renewed;
	}
});

/**
 * Releases a failed sync's lease, unless a newer sync has taken over. A short-lived failure is
 * retried quietly, with a longer wait each time, until the retries run out; any other failure, or
 * the last retry's, is recorded for the owner. A failure only the owner can fix pauses sync.
 */
export const fail = internalMutation({
	args: failArgs,
	returns: v.null(),
	handler: async (ctx, { connectionId, lease, attempt, message, status }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection?.syncLeaseUntil !== lease) return null;
		const delay = status === 'shortLived' ? RETRY_DELAYS_MS[attempt] : undefined;
		if (delay !== undefined) {
			await ctx.scheduler.runAfter(delay, internal.bankConnections.retrySync, {
				connectionId,
				attempt: attempt + 1
			});
			await ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: undefined });
			return null;
		}
		await ctx.db.patch('bankConnections', connectionId, {
			syncLeaseUntil: undefined,
			lastError: { at: Date.now(), message },
			...(status === 'needsAttention' ? { status } : {})
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
		const existing = await ctx.db
			.query('bankConnections')
			.withIndex('by_itemId', (q) => q.eq('provider.itemId', itemId))
			.first();
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
