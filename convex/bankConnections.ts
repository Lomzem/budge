import { v, type Infer } from 'convex/values';
import { Effect, Layer, Option } from 'effect';

import type { PublicError } from '../src/lib/domain/publicError';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
	action,
	env,
	httpAction,
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
import { PlaidClient, type WebhookKey } from './lib/plaidClient';
import {
	KEY_LOOKUP_INTERVAL_MS,
	KeyLookupLimited,
	KEY_TTL_MS,
	readWebhook,
	verifyWebhook,
	webhookKeyValidator,
	WebhookKeys
} from './lib/plaidWebhook';
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
	type syncRow,
	type SyncError
} from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';

const MAX_CONNECTIONS = 20;

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

export const sync = internalAction({
	args: { connectionId: v.id('bankConnections') },
	returns: v.null(),
	handler: async (ctx, { connectionId }) => {
		await Effect.runPromise(
			syncConnection(connectionId, { refresh: false }).pipe(
				Effect.ignore,
				Effect.provide(liveLayer(ctx))
			)
		);
		return null;
	}
});

export const syncAll = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const connections = await ctx.db.query('bankConnections').take(MAX_CONNECTIONS);
		for (const connection of connections) {
			if (connection.provider.kind !== 'plaid') continue;
			await ctx.scheduler.runAfter(0, internal.bankConnections.sync, {
				connectionId: connection._id
			});
		}
		return null;
	}
});

export const webhookTarget = internalQuery({
	args: { itemId: v.string() },
	returns: v.union(v.id('bankConnections'), v.null()),
	handler: async (ctx, { itemId }) => {
		const connection = await ctx.db
			.query('bankConnections')
			.withIndex('by_itemId', (q) => q.eq('provider.itemId', itemId))
			.first();
		return connection?.provider.kind === 'plaid' ? connection._id : null;
	}
});

export const webhook = httpAction(async (ctx, request) => {
	const body = new Uint8Array(await request.arrayBuffer());
	const webhook = readWebhook(body);
	if (webhook === null) return new Response(null, { status: 400 });
	const connectionId: Id<'bankConnections'> | null = await ctx.runQuery(
		internal.bankConnections.webhookTarget,
		{ itemId: webhook.itemId }
	);
	if (connectionId === null) return new Response(null, { status: 200 });
	const verified = await Effect.runPromise(
		verifyWebhook({
			body,
			token: request.headers.get('plaid-verification'),
			now: Date.now()
		}).pipe(
			Effect.catchTag('KeyLookupLimited', () => Effect.succeed('limited' as const)),
			Effect.provide(keptWebhookKeys(ctx))
		)
	);
	if (verified === 'limited') {
		const retryAfter = String(KEY_LOOKUP_INTERVAL_MS / 1000);
		return new Response(null, { status: 429, headers: { 'retry-after': retryAfter } });
	}
	if (!verified) return new Response(null, { status: 401 });
	if (webhook.type === 'TRANSACTIONS' && webhook.code === 'SYNC_UPDATES_AVAILABLE') {
		await ctx.scheduler.runAfter(0, internal.bankConnections.sync, { connectionId });
	}
	return new Response(null, { status: 200 });
});

function keptWebhookKeys(ctx: Pick<ActionCtx, 'runMutation'>): Layer.Layer<WebhookKeys> {
	return Layer.effect(
		WebhookKeys,
		Effect.map(PlaidClient, (plaid) => ({
			find: (kid: string) =>
				Effect.gen(function* () {
					const claim: WebhookKeyClaim = yield* Effect.promise(() =>
						ctx.runMutation(internal.bankConnections.claimWebhookKey, { kid })
					);
					if (claim.kind === 'kept') return Option.some(claim.key);
					if (claim.kind === 'limited') return yield* new KeyLookupLimited();
					const key = yield* Effect.option(plaid.webhookVerificationKey(kid));
					if (Option.isSome(key)) {
						yield* Effect.promise(() =>
							ctx.runMutation(internal.bankConnections.saveWebhookKey, { kid, key: key.value })
						);
					}
					return key;
				})
		}))
	).pipe(Layer.provide(livePlaid()));
}

type WebhookKeyClaim = { kind: 'kept'; key: WebhookKey } | { kind: 'lookup' | 'limited' };

const EXPIRED_KEYS_CLEARED_PER_LOOKUP = 10;

export const claimWebhookKey = internalMutation({
	args: { kid: v.string() },
	returns: v.union(
		v.object({ kind: v.literal('kept'), key: webhookKeyValidator }),
		v.object({ kind: v.union(v.literal('lookup'), v.literal('limited')) })
	),
	handler: async (ctx, { kid }): Promise<WebhookKeyClaim> => {
		const now = Date.now();
		const kept = await ctx.db
			.query('webhookKeys')
			.withIndex('by_kid', (q) => q.eq('kid', kid))
			.unique();
		if (kept?.key && kept.checkedAt > now - KEY_TTL_MS)
			return { kind: 'kept' as const, key: kept.key };
		const latest = await ctx.db
			.query('webhookKeys')
			.withIndex('by_checkedAt')
			.order('desc')
			.first();
		if (latest !== null && latest.checkedAt > now - KEY_LOOKUP_INTERVAL_MS) {
			return { kind: 'limited' as const };
		}
		if (kept === null) await ctx.db.insert('webhookKeys', { kid, key: null, checkedAt: now });
		else await ctx.db.patch('webhookKeys', kept._id, { key: null, checkedAt: now });
		const expired = await ctx.db
			.query('webhookKeys')
			.withIndex('by_checkedAt', (q) => q.lt('checkedAt', now - KEY_TTL_MS))
			.take(EXPIRED_KEYS_CLEARED_PER_LOOKUP);
		for (const row of expired) await ctx.db.delete('webhookKeys', row._id);
		return { kind: 'lookup' as const };
	}
});

export const saveWebhookKey = internalMutation({
	args: { kid: v.string(), key: webhookKeyValidator },
	returns: v.null(),
	handler: async (ctx, { kid, key }) => {
		const row = await ctx.db
			.query('webhookKeys')
			.withIndex('by_kid', (q) => q.eq('kid', kid))
			.unique();
		if (row !== null) await ctx.db.patch('webhookKeys', row._id, { key });
		return null;
	}
});

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

function livePlaid() {
	return PlaidClient.layerLive({
		clientId: env.PLAID_CLIENT_ID,
		secret: env.PLAID_SECRET,
		environment: env.BUDGE_PRODUCTION === undefined ? 'sandbox' : 'production'
	});
}

function liveLayer(ctx: ActionCtx) {
	return Layer.mergeAll(livePlaid(), TokenCipher.layer(env.BUDGE_TOKEN_KEY), SyncStore.layer(ctx));
}

function toPublicError(error: SyncError): PublicError {
	if (error._tag === 'PlaidApi' && error.error_code === 'ITEM_LOGIN_REQUIRED') {
		return { code: 'BANK_CONNECTION_NEEDS_LOGIN', message: 'The bank needs you to sign in again.' };
	}
	return { code: 'BANK_UNAVAILABLE', message: "Couldn't sync with the bank; try again later." };
}

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
			updateStart:
				provider.updateStart === undefined ? (provider.cursor ?? null) : provider.updateStart,
			cutoverDate
		};
	}
});

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
			throw publicError(
				'INVALID_INPUT',
				`A sync batch holds at most ${String(MAX_SYNC_ROWS)} rows.`
			);
		}
		const cutoverDate = await requireCutoverDate(ctx);
		const totals = await applyByBankAccount(
			ctx,
			connectionId,
			rowsByBankAccount(rows, cutoverDate)
		);

		const now = Date.now();
		const nextLease = release ? undefined : now + LEASE_MS;
		const { updateStart, ...provider } = connection.provider;
		const updateStartUntilItsLastPage = hasMore
			? { updateStart: updateStart === undefined ? fromCursor : updateStart }
			: {};
		await ctx.db.patch('bankConnections', connectionId, {
			provider: { ...provider, cursor: nextCursor, ...updateStartUntilItsLastPage },
			syncLeaseUntil: nextLease,
			...(release ? { lastSyncedAt: now, lastError: undefined, status: 'ok' as const } : {})
		});
		return { kind: 'applied' as const, lease: nextLease ?? null, ...totals };
	}
});

function rowsByBankAccount(
	rows: Infer<typeof syncRow>[],
	cutoverDate: string
): Map<string, IncomingRow[]> {
	const byExternalId = new Map<string, IncomingRow[]>();
	for (const { externalAccountId, ...row } of rows) {
		const checked = requireBankRow(row, cutoverDate);
		byExternalId.set(externalAccountId, [...(byExternalId.get(externalAccountId) ?? []), checked]);
	}
	return byExternalId;
}

async function applyByBankAccount(
	ctx: MutationCtx,
	connectionId: Id<'bankConnections'>,
	byExternalId: Map<string, IncomingRow[]>
) {
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
	return totals;
}

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
