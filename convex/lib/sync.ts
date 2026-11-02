// Bank sync: the workflow that takes a Bank Connection's lease, pulls Plaid's new Transactions a
// bounded batch at a time, and hands each batch to one mutation that applies it with the cursor.

import type { GenericActionCtx } from 'convex/server';
import { v, type Infer } from 'convex/values';
import { Cause, Context, Effect, Layer, Option, Result } from 'effect';

import { syncRowsOf, type SyncRow } from '../../src/lib/domain/plaid';
import { internal } from '../_generated/api';
import type { DataModel, Id } from '../_generated/dataModel';
import { PlaidClient, type PlaidError } from './plaidClient';
import { failureOf, type SyncFailure } from './syncFailure';
import { TokenCipher, TokenCipherError } from './tokenCipher';

/** How long a sync holds its Bank Connection; each applied batch, and each restart, extends it. */
export const LEASE_MS = 2 * 60_000;

// One batch is at most three pages of a hundred rows, and one mutation applies it. Each row costs
// about six index reads (its import ID, rename and Payee memory, the monthly total, and the
// Transactions near it), so 300 rows stay well inside Convex's 4,096 reads per mutation. Three
// pages at Plaid's 35-second limit each also fit inside one lease.
export const PAGE_SIZE = 100;
export const PAGES_PER_BATCH = 3;
export const MAX_SYNC_ROWS = PAGE_SIZE * PAGES_PER_BATCH;
// A sync applies at most this many batches, then stops at a committed cursor and leaves the rest
// to the next sync, so one action stays inside Convex's time limit.
export const MAX_BATCHES = 4;
// After a short-lived failure, sync retries through the Convex scheduler after each of these delays
// in turn, then records the failure for the owner.
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 25 * 60_000] as const;
// Plaid's answer when the bank changed while sync paged. The whole update, not just the batch,
// starts over from the cursor before its first page; batches applied since then are applied again,
// which adds nothing twice.
const MUTATION_DURING_PAGINATION = 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION';
const PAGINATION_RESTARTS = 2;

export const syncRow = v.object({
	externalAccountId: v.string(),
	sourceId: v.string(),
	date: v.string(),
	amount: v.number(),
	bankText: v.string(),
	merchantName: v.optional(v.string())
});

export const leaseResult = v.union(
	v.object({ kind: v.literal('missing') }),
	v.object({ kind: v.literal('busy') }),
	v.object({ kind: v.literal('noToken') }),
	/** The Bank Connection needs the owner, so only a sync they start runs. */
	v.object({ kind: v.literal('paused') }),
	v.object({
		kind: v.literal('taken'),
		lease: v.number(),
		itemId: v.string(),
		encryptedToken: v.string(),
		cursor: v.union(v.string(), v.null()),
		/** Where the update being paged began; the committed cursor between updates. */
		updateStart: v.union(v.string(), v.null()),
		cutoverDate: v.string()
	})
);
export type LeaseResult = Infer<typeof leaseResult>;

export const applyArgs = {
	connectionId: v.id('bankConnections'),
	lease: v.number(),
	/** The cursor the batch was fetched from; it must still be the committed one. */
	fromCursor: v.union(v.string(), v.null()),
	nextCursor: v.string(),
	/** Plaid has more pages of this update past `nextCursor`. */
	hasMore: v.boolean(),
	rows: v.array(syncRow),
	/** The sync's last batch: records it as synced and releases the lease. */
	release: v.boolean()
};

export const applyResult = v.union(
	v.object({ kind: v.literal('stale') }),
	v.object({
		kind: v.literal('applied'),
		lease: v.union(v.number(), v.null()),
		added: v.number(),
		matched: v.number(),
		held: v.number()
	})
);
export type ApplyResult = Infer<typeof applyResult>;

export const failArgs = {
	connectionId: v.id('bankConnections'),
	lease: v.number(),
	/** How many retries came before the failed sync. */
	attempt: v.number(),
	message: v.string(),
	status: v.union(v.literal('needsAttention'), v.literal('shortLived'), v.literal('failed'))
};

export const saveArgs = {
	name: v.string(),
	itemId: v.string(),
	encryptedToken: v.string(),
	accounts: v.array(v.object({ externalId: v.string(), accountId: v.id('accounts') }))
};

interface SyncStoreShape {
	readonly takeLease: (args: {
		connectionId: Id<'bankConnections'>;
		resume: boolean;
	}) => Effect.Effect<LeaseResult>;
	readonly apply: (args: {
		connectionId: Id<'bankConnections'>;
		lease: number;
		fromCursor: string | null;
		nextCursor: string;
		hasMore: boolean;
		rows: SyncRow[];
		release: boolean;
	}) => Effect.Effect<ApplyResult>;
	/** Extends a held lease; `null` once another sync has taken over. */
	readonly renewLease: (args: {
		connectionId: Id<'bankConnections'>;
		lease: number;
	}) => Effect.Effect<number | null>;
	readonly fail: (
		args: {
			connectionId: Id<'bankConnections'>;
			lease: number;
			attempt: number;
		} & SyncFailure
	) => Effect.Effect<void>;
	/** The Bank Connection's Plaid Item and sealed token, if it exists and has one. */
	readonly credentials: (
		connectionId: Id<'bankConnections'>
	) => Effect.Effect<{ itemId: string; encryptedToken: string } | 'missing' | 'noToken'>;
	/** Records when the bank's consent ends, as Plaid last reported it. */
	readonly recordConsent: (args: {
		connectionId: Id<'bankConnections'>;
		consentExpiresAt: number | null;
	}) => Effect.Effect<void>;
	readonly save: (args: {
		name: string;
		itemId: string;
		encryptedToken: string;
		accounts: { externalId: string; accountId: Id<'accounts'> }[];
	}) => Effect.Effect<Id<'bankConnections'>>;
}

/** What sync needs of an action's context. */
export type MutationRunner = Pick<GenericActionCtx<DataModel>, 'runMutation' | 'runQuery'>;

/** The functions sync runs, each its own transaction. A failed one is a defect. */
export class SyncStore extends Context.Service<SyncStore, SyncStoreShape>()('budge/SyncStore') {
	static layer({ runMutation, runQuery }: MutationRunner): Layer.Layer<SyncStore> {
		return Layer.succeed(SyncStore, {
			takeLease: (args) =>
				Effect.promise(() => runMutation(internal.bankConnections.takeLease, args)),
			apply: (args) => Effect.promise(() => runMutation(internal.bankConnections.apply, args)),
			renewLease: (args) =>
				Effect.promise(() => runMutation(internal.bankConnections.renewLease, args)),
			fail: (args) => Effect.promise(() => runMutation(internal.bankConnections.fail, args)),
			credentials: (connectionId) =>
				Effect.promise(() => runQuery(internal.bankConnections.credentials, { connectionId })),
			recordConsent: (args) =>
				Effect.promise(() => runMutation(internal.bankConnections.recordConsent, args)),
			save: (args) => Effect.promise(() => runMutation(internal.bankConnections.save, args))
		});
	}
}

export type SyncOutcome =
	| { kind: 'synced'; added: number; matched: number; held: number }
	| { kind: 'busy' }
	| { kind: 'noToken' }
	| { kind: 'paused' }
	| { kind: 'missing' };

export type SyncError = PlaidError | TokenCipherError;

/**
 * Syncs one Bank Connection. Another sync holding the lease makes this a no-op, as does a
 * connection with no token. Each batch is applied, with its cursor, by one mutation that first
 * checks the lease and cursor are still this sync's; if not, a newer sync took over and this one
 * stops without writing. A failure records a message for the owner and releases the lease.
 * After a sync, it records when the bank's consent ends. `refresh` then asks Plaid to check the bank for newer Transactions, ignoring any failure.
 * A Bank Connection that needs the owner is paused: only a sync with `resume`, one the owner
 * started, runs on it. A short-lived failure schedules a retry; `attempt` counts the retries so
 * far.
 */
export const syncConnection = Effect.fnUntraced(function* (
	connectionId: Id<'bankConnections'>,
	{ refresh, resume = false, attempt = 0 }: { refresh: boolean; resume?: boolean; attempt?: number }
): Effect.fn.Return<SyncOutcome, SyncError, PlaidClient | TokenCipher | SyncStore> {
	const store = yield* SyncStore;
	const plaid = yield* PlaidClient;
	const cipher = yield* TokenCipher;
	const taken = yield* store.takeLease({ connectionId, resume });
	if (taken.kind !== 'taken') return taken;

	let lease = taken.lease;
	const run = Effect.gen(function* () {
		const accessToken = yield* cipher.decrypt(taken.encryptedToken, taken.itemId);
		let committed = taken.cursor;
		const totals = { added: 0, matched: 0, held: 0 };
		for (let batch = 1; ; batch++) {
			let from = committed;
			let fetched: Batch;
			for (let restarts = 0; ; restarts++) {
				const result = yield* Effect.result(
					fetchBatch(plaid, accessToken, from, taken.cutoverDate)
				);
				if (Result.isSuccess(result)) {
					fetched = result.success;
					break;
				}
				const error = result.failure;
				const bankChanged =
					error._tag === 'PlaidApi' && error.error_code === MUTATION_DURING_PAGINATION;
				if (!bankChanged || restarts === PAGINATION_RESTARTS) return yield* error;
				// Paging again can outlast the lease, so it is renewed first.
				const renewed = yield* store.renewLease({ connectionId, lease });
				if (renewed === null) return { kind: 'busy' } as const;
				lease = renewed;
				from = taken.updateStart;
			}
			const release = !fetched.hasMore || batch === MAX_BATCHES;
			const applied = yield* store.apply({
				connectionId,
				lease,
				fromCursor: committed,
				nextCursor: fetched.nextCursor,
				hasMore: fetched.hasMore,
				rows: fetched.rows,
				release
			});
			if (applied.kind === 'stale') return { kind: 'busy' } as const;
			totals.added += applied.added;
			totals.matched += applied.matched;
			totals.held += applied.held;
			committed = fetched.nextCursor;
			if (applied.lease === null) break;
			lease = applied.lease;
		}
		// Consent is a nicety on top of a sync that worked, so a failure to read it is ignored.
		const item = yield* Effect.option(plaid.itemGet(accessToken));
		if (Option.isSome(item)) {
			yield* store.recordConsent({ connectionId, consentExpiresAt: item.value.consentExpiresAt });
		}
		if (refresh) yield* Effect.ignore(plaid.transactionsRefresh(accessToken));
		return { kind: 'synced', ...totals } as const;
	});
	return yield* run.pipe(
		Effect.tapCause((cause) => {
			const failure = describeFailure(cause);
			return store.fail({ connectionId, lease, attempt, ...failure });
		})
	);
});

interface Batch {
	rows: SyncRow[];
	nextCursor: string;
	hasMore: boolean;
}

/** Up to one batch of pages from `cursor`. */
function fetchBatch(
	plaid: PlaidClient['Service'],
	accessToken: string,
	cursor: string | null,
	cutoverDate: string
): Effect.Effect<Batch, PlaidError> {
	return Effect.gen(function* () {
		const rows: SyncRow[] = [];
		let page = yield* plaid.transactionsSync({ accessToken, cursor, count: PAGE_SIZE });
		rows.push(...syncRowsOf(page, cutoverDate));
		for (let pages = 1; pages < PAGES_PER_BATCH && page.hasMore; pages++) {
			page = yield* plaid.transactionsSync({
				accessToken,
				cursor: page.nextCursor,
				count: PAGE_SIZE
			});
			rows.push(...syncRowsOf(page, cutoverDate));
		}
		return { rows, nextCursor: page.nextCursor, hasMore: page.hasMore };
	});
}

/** What the owner sees about a failed sync, and what it means for the Bank Connection. */
function describeFailure(cause: Cause.Cause<SyncError>): SyncFailure {
	const error = Cause.findErrorOption(cause);
	if (Option.isNone(error)) return { status: 'failed', message: 'The sync stopped unexpectedly.' };
	return failureOf(error.value);
}

/**
 * Creates or updates the Bank Connection for an existing Plaid Item: seals its access token, maps
 * its Accounts, and points its webhook at Budge. It never creates or deletes a Plaid Item.
 */
export const setupConnection = Effect.fnUntraced(function* (input: {
	name: string;
	itemId: string;
	accessToken: string;
	webhook: string;
	accounts: { externalId: string; accountId: Id<'accounts'> }[];
}): Effect.fn.Return<Id<'bankConnections'>, SyncError, PlaidClient | TokenCipher | SyncStore> {
	const cipher = yield* TokenCipher;
	const plaid = yield* PlaidClient;
	const store = yield* SyncStore;
	const encryptedToken = yield* cipher.encrypt(input.accessToken, input.itemId);
	yield* plaid.setWebhook(input.accessToken, input.webhook);
	return yield* store.save({
		name: input.name,
		itemId: input.itemId,
		encryptedToken,
		accounts: input.accounts
	});
});

/**
 * Reconnect: a Plaid Link token in update mode for the Bank Connection's existing Item, so the
 * owner can sign in again or renew consent. It never creates or deletes a Plaid Item.
 */
export const reconnectLinkToken = Effect.fnUntraced(function* (
	connectionId: Id<'bankConnections'>
): Effect.fn.Return<
	{ kind: 'linkToken'; linkToken: string } | { kind: 'missing' } | { kind: 'noToken' },
	SyncError,
	PlaidClient | TokenCipher | SyncStore
> {
	const store = yield* SyncStore;
	const plaid = yield* PlaidClient;
	const cipher = yield* TokenCipher;
	const credentials = yield* store.credentials(connectionId);
	if (credentials === 'missing' || credentials === 'noToken') return { kind: credentials };
	const accessToken = yield* cipher.decrypt(credentials.encryptedToken, credentials.itemId);
	const linkToken = yield* plaid.linkTokenCreate({ accessToken, clientUserId: connectionId });
	return { kind: 'linkToken', linkToken };
});
