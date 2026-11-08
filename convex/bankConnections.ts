import { v, type Infer } from 'convex/values';
import { Effect, Layer, Option } from 'effect';

import { isSyncOverdue, renewalDue } from '../src/lib/domain/freshness';
import type { PublicError } from '../src/lib/domain/publicError';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
	action,
	env,
	httpAction,
	internalAction,
	internalMutation,
	internalQuery,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx
} from './_generated/server';
import { applyBankChange, applyBankRemoval, syncedBankRow } from './lib/bankChanges';
import { applyBankRows, planBankRows, requireBankRow, type IncomingRow } from './lib/imports';
import { holdBankRow, updateBankRow } from './lib/transactions';
import { requireOwner } from './lib/owner';
import { ImportedPayees } from './lib/payees';
import { PlaidClient, type WebhookKey } from './lib/plaidClient';
import {
	KEY_LOOKUP_INTERVAL_MS,
	KeyLookupDeferred,
	lookUpKey,
	KEY_TTL_MS,
	readWebhook,
	verifyWebhook,
	webhookKeyValidator,
	WebhookKeys,
	type Webhook
} from './lib/plaidWebhook';
import { publicError } from './lib/publicError';
import { runEffect } from './lib/runEffect';
import { requireCutoverDate } from './lib/settings';
import {
	applyArgs,
	applyResult,
	connectItem,
	failArgs,
	leaseResult,
	LEASE_MS,
	MAX_SYNC_ROWS,
	OWNER_CLIENT_USER_ID,
	reconnectLinkToken,
	RETRY_DELAYS_MS,
	saveArgs,
	setupConnection,
	SyncStore,
	syncConnection,
	type syncRemoval,
	type syncRow,
	type SyncError
} from './lib/sync';
import { failureOf, failureOfPlaidCode } from './lib/syncFailure';
import { TokenCipher } from './lib/tokenCipher';

export const MAX_BANK_CONNECTIONS = 20;
const MAX_FED_ACCOUNTS = 50;

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
			lastError: v.union(v.object({ at: v.number(), message: v.string() }), v.null()),
			feeds: v.array(v.object({ accountId: v.id('accounts'), name: v.string() }))
		})
	),
	handler: async (ctx, { now }) => {
		await requireOwner(ctx);
		const connections = await ctx.db.query('bankConnections').take(MAX_BANK_CONNECTIONS);
		return await Promise.all(
			connections.map(async (connection) => ({
				_id: connection._id,
				name: connection.name,
				status: connection.status,
				lastSyncedAt: connection.lastSyncedAt ?? null,
				overdue: isSyncOverdue(connection.lastSyncedAt ?? null, now),
				consentEndsAt: renewalDue(connection.consentExpiresAt ?? null, now),
				lastError: connection.lastError ?? null,
				feeds: await feedsOf(ctx, connection._id)
			}))
		);
	}
});

async function feedsOf(ctx: QueryCtx, connectionId: Id<'bankConnections'>) {
	const linked = await ctx.db
		.query('connectionAccounts')
		.withIndex('by_connection_externalId', (q) => q.eq('connectionId', connectionId))
		.take(MAX_FED_ACCOUNTS);
	const feeds: { accountId: Id<'accounts'>; name: string }[] = [];
	for (const row of linked) {
		if (row.state !== 'mapped') continue;
		const account = await ctx.db.get('accounts', row.accountId);
		if (account !== null) feeds.push({ accountId: account._id, name: account.name });
	}
	return feeds;
}

const ownerSyncResult = v.union(
	v.object({ kind: v.literal('synced'), added: v.number(), matched: v.number() }),
	v.object({ kind: v.literal('busy') }),
	v.object({ kind: v.literal('noToken') })
);

export const syncNow = action({
	args: { connectionId: v.id('bankConnections') },
	returns: ownerSyncResult,
	handler: async (ctx, { connectionId }) => {
		await requireOwner(ctx);
		return await ownerSync(ctx, connectionId, { refresh: true });
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

const CONNECTIONS_SCHEDULED_PER_MUTATION = 20;

export const syncAll = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.null(),
	handler: async (ctx, { cursor }) => {
		const { page, isDone, continueCursor } = await ctx.db
			.query('bankConnections')
			.paginate({ numItems: CONNECTIONS_SCHEDULED_PER_MUTATION, cursor: cursor ?? null });
		for (const connection of page) {
			if (connection.provider.kind !== 'plaid') continue;
			await ctx.scheduler.runAfter(0, internal.bankConnections.sync, {
				connectionId: connection._id
			});
		}
		if (!isDone) {
			await ctx.scheduler.runAfter(0, internal.bankConnections.syncAll, {
				cursor: continueCursor
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
			Effect.catchTag('KeyLookupDeferred', () => Effect.succeed('deferred' as const)),
			Effect.provide(keptWebhookKeys(ctx, webhook.itemId))
		)
	);
	if (verified === 'deferred') {
		const retryAfter = String(KEY_LOOKUP_INTERVAL_MS / 1000);
		return new Response(null, { status: 429, headers: { 'retry-after': retryAfter } });
	}
	if (!verified) return new Response(null, { status: 401 });
	if (webhook.type === 'TRANSACTIONS' && webhook.code === 'SYNC_UPDATES_AVAILABLE') {
		await ctx.scheduler.runAfter(0, internal.bankConnections.sync, { connectionId });
	}
	if (webhook.type === 'ITEM') await actOnItemWebhook(ctx, connectionId, webhook);
	return new Response(null, { status: 200 });
});

async function actOnItemWebhook(
	ctx: Pick<ActionCtx, 'runMutation' | 'scheduler'>,
	connectionId: Id<'bankConnections'>,
	webhook: Webhook
) {
	if (webhook.code === 'NEW_ACCOUNTS_AVAILABLE') {
		await ctx.scheduler.runAfter(0, internal.heldAccounts.discover, { connectionId });
		return;
	}
	await ctx.runMutation(internal.bankConnections.flagItem, {
		itemId: webhook.itemId,
		code: webhook.errorCode ?? webhook.code
	});
}

function keptWebhookKeys(
	ctx: Pick<ActionCtx, 'runMutation'>,
	itemId: string
): Layer.Layer<WebhookKeys> {
	return Layer.effect(
		WebhookKeys,
		Effect.map(PlaidClient, (plaid) => ({
			find: (kid: string) =>
				Effect.gen(function* () {
					const claim: WebhookKeyClaim = yield* Effect.promise(() =>
						ctx.runMutation(internal.bankConnections.claimWebhookKey, { kid, itemId })
					);
					if (claim.kind === 'kept') return Option.some(claim.key);
					if (claim.kind === 'limited') return yield* new KeyLookupDeferred();
					const key = yield* lookUpKey(plaid, kid);
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

const EXPIRED_ROWS_CLEARED_PER_LOOKUP = 10;

export const claimWebhookKey = internalMutation({
	args: { kid: v.string(), itemId: v.string() },
	returns: v.union(
		v.object({ kind: v.literal('kept'), key: webhookKeyValidator }),
		v.object({ kind: v.union(v.literal('lookup'), v.literal('limited')) })
	),
	handler: async (ctx, { kid, itemId }): Promise<WebhookKeyClaim> => {
		const now = Date.now();
		const kept = await ctx.db
			.query('webhookKeys')
			.withIndex('by_kid', (q) => q.eq('kid', kid))
			.unique();
		if (kept?.key && kept.checkedAt > now - KEY_TTL_MS)
			return { kind: 'kept' as const, key: kept.key };
		const lastLookup = await ctx.db
			.query('webhookKeyLookups')
			.withIndex('by_itemId', (q) => q.eq('itemId', itemId))
			.unique();
		if (lastLookup !== null && lastLookup.lookedUpAt > now - KEY_LOOKUP_INTERVAL_MS)
			return { kind: 'limited' as const };
		if (lastLookup === null) await ctx.db.insert('webhookKeyLookups', { itemId, lookedUpAt: now });
		else await ctx.db.patch('webhookKeyLookups', lastLookup._id, { lookedUpAt: now });
		if (kept === null) await ctx.db.insert('webhookKeys', { kid, key: null, checkedAt: now });
		else await ctx.db.patch('webhookKeys', kept._id, { key: null, checkedAt: now });
		await clearExpiredWebhookKeyRows(ctx, now);
		return { kind: 'lookup' as const };
	}
});

async function clearExpiredWebhookKeyRows(ctx: MutationCtx, now: number) {
	const expiredKeys = await ctx.db
		.query('webhookKeys')
		.withIndex('by_checkedAt', (q) => q.lt('checkedAt', now - KEY_TTL_MS))
		.take(EXPIRED_ROWS_CLEARED_PER_LOOKUP);
	for (const row of expiredKeys) await ctx.db.delete('webhookKeys', row._id);
	const expiredLookups = await ctx.db
		.query('webhookKeyLookups')
		.withIndex('by_lookedUpAt', (q) => q.lt('lookedUpAt', now - KEY_LOOKUP_INTERVAL_MS))
		.take(EXPIRED_ROWS_CLEARED_PER_LOOKUP);
	for (const row of expiredLookups) await ctx.db.delete('webhookKeyLookups', row._id);
}

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

export const syncAfterReconnect = action({
	args: { connectionId: v.id('bankConnections') },
	returns: ownerSyncResult,
	handler: async (ctx, { connectionId }) => {
		await requireOwner(ctx);
		return await ownerSync(ctx, connectionId, { refresh: false, resume: true, discover: true });
	}
});

async function ownerSync(
	ctx: ActionCtx,
	connectionId: Id<'bankConnections'>,
	{
		refresh,
		resume = false,
		discover = false
	}: { refresh: boolean; resume?: boolean; discover?: boolean }
): Promise<Infer<typeof ownerSyncResult>> {
	const outcome = await runEffect(
		syncConnection(connectionId, { refresh, resume, discover }).pipe(
			Effect.provide(liveLayer(ctx))
		),
		toPublicError
	);
	if (outcome.kind === 'missing') throw publicError('NOT_FOUND');
	if (outcome.kind === 'paused') throw publicError(needsLogin.code, needsLogin.message);
	if (outcome.kind !== 'synced') return outcome;
	return { kind: 'synced', added: outcome.added, matched: outcome.matched };
}

export const service = query({
	args: {},
	returns: v.object({
		available: v.boolean(),
		environment: v.union(v.literal('sandbox'), v.literal('production'))
	}),
	handler: async (ctx) => {
		await requireOwner(ctx);
		return bankSyncService();
	}
});

export const connect = action({
	args: {},
	returns: v.object({ linkToken: v.string() }),
	handler: async (ctx) => {
		await requireOwner(ctx);
		requireBankSync();
		const { cutoverDate } = await ctx.runQuery(api.settings.get, {});
		if (cutoverDate === null) throw publicError('INVALID_INPUT', 'Set the cutover date first.');
		const linkToken = await runEffect(
			PlaidClient.use((plaid) =>
				plaid.linkTokenCreate({
					mode: 'create',
					webhook: plaidWebhookUrl(),
					clientUserId: OWNER_CLIENT_USER_ID
				})
			).pipe(Effect.provide(livePlaid())),
			toPublicError
		);
		return { linkToken };
	}
});

function institutionNameOrBank(institutionName: string | undefined) {
	const name = institutionName?.trim() ?? '';
	return name === '' ? 'Bank' : name;
}

export const finishConnect = action({
	args: { publicToken: v.string(), institutionName: v.optional(v.string()) },
	returns: v.id('bankConnections'),
	handler: async (ctx, { publicToken, institutionName }) => {
		await requireOwner(ctx);
		requireBankSync();
		const connectionId = await runEffect(
			connectItem({
				name: institutionNameOrBank(institutionName),
				publicToken,
				webhook: plaidWebhookUrl()
			}).pipe(Effect.provide(liveLayer(ctx))),
			toPublicError
		);
		await ctx.scheduler.runAfter(0, internal.bankConnections.sync, { connectionId });
		return connectionId;
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
	handler: async (ctx, { accessToken, ...input }) => {
		const connectionId = await runEffect(
			setupConnection({
				...input,
				accessToken,
				webhook: plaidWebhookUrl()
			}).pipe(Effect.provide(liveLayer(ctx))),
			toPublicError
		);
		await ctx.scheduler.runAfter(0, internal.bankConnections.sync, { connectionId });
		return connectionId;
	}
});

function plaidWebhookUrl() {
	return `${env.CONVEX_SITE_URL}/plaid/webhook`;
}

function bankSyncService() {
	return {
		available:
			env.PLAID_CLIENT_ID !== undefined &&
			env.PLAID_SECRET !== undefined &&
			env.BUDGE_TOKEN_KEY !== undefined,
		environment: plaidEnvironment()
	};
}

function plaidEnvironment() {
	return env.BUDGE_PRODUCTION === undefined ? ('sandbox' as const) : ('production' as const);
}

const syncUnavailable = {
	code: 'BANK_SYNC_UNAVAILABLE',
	message: "Bank sync isn't set up on this server."
} as const satisfies PublicError;

function requireBankSync() {
	if (!bankSyncService().available)
		throw publicError(syncUnavailable.code, syncUnavailable.message);
}

function livePlaid() {
	return PlaidClient.layerLive({
		clientId: env.PLAID_CLIENT_ID,
		secret: env.PLAID_SECRET,
		environment: plaidEnvironment()
	});
}

export const retrySync = internalAction({
	args: {
		connectionId: v.id('bankConnections'),
		attempt: v.number(),
		resumeFrom: v.optional(v.number())
	},
	returns: v.null(),
	handler: async (ctx, { connectionId, attempt, resumeFrom }) => {
		await Effect.runPromise(
			syncConnection(connectionId, { refresh: false, attempt, resumeFrom }).pipe(
				Effect.ignore,
				Effect.provide(liveLayer(ctx))
			)
		);
		return null;
	}
});

export function liveLayer(ctx: ActionCtx) {
	return Layer.mergeAll(livePlaid(), TokenCipher.layer(env.BUDGE_TOKEN_KEY), SyncStore.layer(ctx));
}

const needsLogin = {
	code: 'BANK_CONNECTION_NEEDS_LOGIN',
	message: 'The bank needs you to reconnect.'
} as const satisfies PublicError;

export function toPublicError(error: SyncError): PublicError {
	if (failureOf(error).status === 'needsAttention') return needsLogin;
	if (!bankSyncService().available) return syncUnavailable;
	return { code: 'BANK_UNAVAILABLE', message: "Couldn't reach the bank; try again later." };
}

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
			attentionNotices: (connection.attentionNotices ?? 0) + 1,
			lastError: { at: Date.now(), message: failure.message }
		});
		return null;
	}
});

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

export const recordConsent = internalMutation({
	args: {
		connectionId: v.id('bankConnections'),
		consentExpiresAt: v.union(v.number(), v.null()),
		checkedByLease: v.number()
	},
	returns: v.null(),
	handler: async (ctx, { connectionId, consentExpiresAt, checkedByLease }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection === null) return null;
		if (checkedByLease <= (connection.consentCheckedByLease ?? -Infinity)) return null;
		await ctx.db.patch('bankConnections', connectionId, {
			consentExpiresAt: consentExpiresAt ?? undefined,
			consentCheckedByLease: checkedByLease
		});
		return null;
	}
});

export const takeLease = internalMutation({
	args: {
		connectionId: v.id('bankConnections'),
		resume: v.boolean(),
		resumeFrom: v.optional(v.number()),
		discover: v.boolean()
	},
	returns: leaseResult,
	handler: async (ctx, { connectionId, resume, resumeFrom, discover }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection === null) return { kind: 'missing' as const };
		const now = Date.now();
		const accountsCheckRequestedAt = discover
			? await requestAccountsCheck(ctx, connection)
			: (connection.accountsCheckRequestedAt ?? null);
		if ((connection.syncLeaseUntil ?? 0) > now) {
			await ctx.db.patch('bankConnections', connectionId, { syncRequestedDuringLease: true });
			return { kind: 'busy' as const };
		}
		const { provider } = connection;
		if (provider.kind !== 'plaid') return { kind: 'noToken' as const };
		const attentionNotices = connection.attentionNotices ?? 0;
		const authorized = resume || resumeFrom === attentionNotices;
		if (connection.status === 'needsAttention' && !authorized) return { kind: 'paused' as const };
		const cutoverDate = await requireCutoverDate(ctx);
		const lease = now + LEASE_MS;
		await ctx.db.patch('bankConnections', connectionId, {
			syncLeaseUntil: lease,
			syncRequestedDuringLease: undefined
		});
		return {
			kind: 'taken' as const,
			lease,
			itemId: provider.itemId,
			encryptedToken: provider.encryptedToken,
			cursor: provider.cursor ?? null,
			updateStart:
				provider.updateStart === undefined ? (provider.cursor ?? null) : provider.updateStart,
			cutoverDate,
			attentionNotices,
			accountsCheckRequestedAt
		};
	}
});

export const apply = internalMutation({
	args: applyArgs,
	returns: applyResult,
	handler: async (
		ctx,
		{
			connectionId,
			lease,
			fromCursor,
			nextCursor,
			hasMore,
			rows,
			modified,
			removed,
			release,
			attentionNotices
		}
	) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (
			connection?.provider.kind !== 'plaid' ||
			connection.syncLeaseUntil !== lease ||
			(connection.provider.cursor ?? null) !== fromCursor
		) {
			return { kind: 'stale' as const };
		}
		if (rows.length + modified.length + removed.length > MAX_SYNC_ROWS) {
			throw publicError(
				'INVALID_INPUT',
				`A sync batch holds at most ${String(MAX_SYNC_ROWS)} rows.`
			);
		}
		const cutoverDate = await requireCutoverDate(ctx);
		const payees = new ImportedPayees();
		const totals = await applyByBankAccount(
			ctx,
			connectionId,
			rowsByBankAccount(rows, cutoverDate),
			payees
		);
		const changes = await applyBankChanges(ctx, connectionId, modified, cutoverDate, payees);
		totals.added += changes.added;
		totals.matched += changes.matched;
		totals.held += changes.held;
		await applyBankRemovals(ctx, connectionId, removed);

		const now = Date.now();
		const nextLease = release ? undefined : now + LEASE_MS;
		const { updateStart, ...provider } = connection.provider;
		const updateStartUntilItsLastPage = hasMore
			? { updateStart: updateStart === undefined ? fromCursor : updateStart }
			: {};
		await ctx.db.patch('bankConnections', connectionId, {
			provider: { ...provider, cursor: nextCursor, ...updateStartUntilItsLastPage },
			syncLeaseUntil: nextLease,
			...(release ? finishedSync(connection, now, attentionNotices) : {})
		});
		if (release) await syncAgainIfRequested(ctx, connection);
		const accountsCheckRequestedAt =
			(await ctx.db.get('bankConnections', connectionId))?.accountsCheckRequestedAt ?? null;
		return {
			kind: 'applied' as const,
			lease: nextLease ?? null,
			...totals,
			accountsCheckRequestedAt
		};
	}
});

function finishedSync(
	connection: Doc<'bankConnections'>,
	now: number,
	attentionNoticesAtLease: number
) {
	const noNewNotice = (connection.attentionNotices ?? 0) === attentionNoticesAtLease;
	return {
		lastSyncedAt: now,
		...(noNewNotice ? { lastError: undefined, status: 'ok' as const } : {})
	};
}

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
	byExternalId: Map<string, IncomingRow[]>,
	payees: ImportedPayees
) {
	const totals = { added: 0, matched: 0, held: 0 };
	for (const [externalId, accountRows] of byExternalId) {
		const target = await connectionAccountOf(ctx, connectionId, externalId);
		if (target.state !== 'mapped') {
			if (target.state === 'held') totals.held += await holdRows(ctx, target._id, accountRows);
			continue;
		}
		const plan = await planBankRows(ctx, target.accountId, 'plaid', accountRows);
		const counts = await applyBankRows(ctx, target.accountId, 'plaid', plan, payees, target._id);
		totals.added += counts.added;
		totals.matched += counts.matched;
	}
	return totals;
}

async function applyBankChanges(
	ctx: MutationCtx,
	connectionId: Id<'bankConnections'>,
	modified: Infer<typeof syncRow>[],
	cutoverDate: string,
	payees: ImportedPayees
) {
	const totals = { added: 0, matched: 0, held: 0 };
	for (const { externalAccountId, ...row } of modified) {
		const checked = requireBankRow(row, cutoverDate);
		const target = await connectionAccountOf(ctx, connectionId, externalAccountId);
		if (await changeHeldRow(ctx, target._id, checked)) continue;
		if (target.state !== 'mapped') {
			if (target.state === 'held') totals.held += await holdRows(ctx, target._id, [checked]);
			continue;
		}
		const bankRow = await syncedBankRow(ctx, target.accountId, checked.sourceId);
		if (bankRow !== null) {
			await applyBankChange(ctx, bankRow, checked, payees);
			continue;
		}
		const plan = await planBankRows(ctx, target.accountId, 'plaid', [checked]);
		const counts = await applyBankRows(ctx, target.accountId, 'plaid', plan, payees, target._id);
		totals.added += counts.added;
		totals.matched += counts.matched;
	}
	return totals;
}

async function applyBankRemovals(
	ctx: MutationCtx,
	connectionId: Id<'bankConnections'>,
	removed: Infer<typeof syncRemoval>[]
) {
	for (const { externalAccountId, sourceId } of removed) {
		const target = await findConnectionAccount(ctx, connectionId, externalAccountId);
		if (target === null) continue;
		const held = await importOf(ctx, target._id, sourceId);
		if (held?.state === 'held') {
			await updateBankRow(ctx, held, { state: 'removed' });
			continue;
		}
		if (target.state !== 'mapped') continue;
		const bankRow = await syncedBankRow(ctx, target.accountId, sourceId);
		if (bankRow !== null) await applyBankRemoval(ctx, bankRow);
	}
}

async function changeHeldRow(
	ctx: MutationCtx,
	connectionAccountId: Id<'connectionAccounts'>,
	row: IncomingRow
) {
	const held = await importOf(ctx, connectionAccountId, row.sourceId);
	if (held === null || held.transactionId !== undefined) return false;
	if (held.state !== 'held') return true;
	await updateBankRow(ctx, held, {
		date: row.date,
		amount: row.amount,
		bankText: row.bankText,
		merchantName: row.merchantName
	});
	return true;
}

async function importOf(
	ctx: MutationCtx,
	connectionAccountId: Id<'connectionAccounts'>,
	sourceId: string | undefined
) {
	return await ctx.db
		.query('imports')
		.withIndex('by_connectionAccountId_sourceId', (q) =>
			q.eq('connectionAccountId', connectionAccountId).eq('sourceId', sourceId)
		)
		.first();
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
	handler: async (ctx, { connectionId, lease, attempt, resumeFrom, message, status }) => {
		const connection = await ctx.db.get('bankConnections', connectionId);
		if (connection?.syncLeaseUntil !== lease) return null;
		const delay = status === 'shortLived' ? RETRY_DELAYS_MS[attempt] : undefined;
		if (delay !== undefined) {
			await ctx.scheduler.runAfter(delay, internal.bankConnections.retrySync, {
				connectionId,
				attempt: attempt + 1,
				...(resumeFrom === undefined ? {} : { resumeFrom })
			});
			await ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: undefined });
			return null;
		}
		await ctx.db.patch('bankConnections', connectionId, {
			syncLeaseUntil: undefined,
			lastError: { at: Date.now(), message },
			...(status === 'needsAttention'
				? { status, attentionNotices: (connection.attentionNotices ?? 0) + 1 }
				: {})
		});
		await syncAgainIfRequested(ctx, connection);
		return null;
	}
});

async function syncAgainIfRequested(ctx: MutationCtx, connection: Doc<'bankConnections'>) {
	if (connection.syncRequestedDuringLease !== true) return;
	await ctx.db.patch('bankConnections', connection._id, { syncRequestedDuringLease: undefined });
	await ctx.scheduler.runAfter(0, internal.bankConnections.sync, { connectionId: connection._id });
}

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
			const held = await ctx.db.query('bankConnections').take(MAX_BANK_CONNECTIONS);
			if (held.length >= MAX_BANK_CONNECTIONS) {
				throw publicError(
					'INVALID_INPUT',
					`Budge holds at most ${String(MAX_BANK_CONNECTIONS)} Bank Connections.`
				);
			}
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
			else {
				const { name, mask } = known;
				await ctx.db.replace('connectionAccounts', known._id, {
					...mapped,
					...(name === undefined ? {} : { name }),
					...(mask === undefined ? {} : { mask })
				});
			}
		}
		return connectionId;
	}
});

export async function findConnectionAccount(
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

async function holdRows(
	ctx: MutationCtx,
	connectionAccountId: Id<'connectionAccounts'>,
	rows: IncomingRow[]
) {
	let held = 0;
	for (const row of rows) {
		if ((await importOf(ctx, connectionAccountId, row.sourceId)) !== null) continue;
		await holdBankRow(ctx, {
			source: 'plaid',
			...(row.sourceId === undefined ? {} : { sourceId: row.sourceId }),
			connectionAccountId,
			date: row.date,
			amount: row.amount,
			bankText: row.bankText,
			...(row.merchantName === undefined ? {} : { merchantName: row.merchantName })
		});
		held++;
	}
	return held;
}

async function connectionAccountOf(
	ctx: MutationCtx,
	connectionId: Id<'bankConnections'>,
	externalId: string
) {
	const known = await findConnectionAccount(ctx, connectionId, externalId);
	if (known !== null) return known;
	const held = { connectionId, externalId, state: 'held' as const };
	const heldId = await ctx.db.insert('connectionAccounts', held);
	const connection = await ctx.db.get('bankConnections', connectionId);
	if (connection !== null) await requestAccountsCheck(ctx, connection);
	return { _id: heldId, ...held };
}

async function requestAccountsCheck(ctx: MutationCtx, connection: Doc<'bankConnections'>) {
	const pending = connection.accountsCheckRequestedAt;
	const newer = pending === undefined ? Date.now() : Math.max(Date.now(), pending + 1);
	await ctx.db.patch('bankConnections', connection._id, { accountsCheckRequestedAt: newer });
	return newer;
}
