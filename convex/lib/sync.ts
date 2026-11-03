import type { GenericActionCtx } from 'convex/server';
import { v, type Infer } from 'convex/values';
import { Cause, Context, Effect, Layer, Option, Result } from 'effect';

import {
	syncRowsOf,
	type BankAccount,
	type SyncPage,
	type SyncRemoval,
	type SyncRow
} from '../../src/lib/domain/plaid';
import { internal } from '../_generated/api';
import type { DataModel, Id } from '../_generated/dataModel';
import { PlaidClient, type PlaidError } from './plaidClient';
import { failureOf, type SyncFailure } from './syncFailure';
import { TokenCipher, TokenCipherError } from './tokenCipher';

export const LEASE_MS = 2 * 60_000;

export const PAGE_SIZE = 100;
export const PAGES_PER_BATCH = 3;
export const MAX_SYNC_ROWS = PAGE_SIZE * PAGES_PER_BATCH;

export const MAX_BATCHES = 4;
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 25 * 60_000] as const;
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

export const syncRemoval = v.object({ externalAccountId: v.string(), sourceId: v.string() });

export const leaseResult = v.union(
	v.object({ kind: v.literal('missing') }),
	v.object({ kind: v.literal('busy') }),
	v.object({ kind: v.literal('noToken') }),
	v.object({ kind: v.literal('paused') }),
	v.object({
		kind: v.literal('taken'),
		lease: v.number(),
		itemId: v.string(),
		encryptedToken: v.string(),
		cursor: v.union(v.string(), v.null()),

		updateStart: v.union(v.string(), v.null()),
		cutoverDate: v.string(),
		attentionNotices: v.number(),
		accountsCheckRequestedAt: v.union(v.number(), v.null())
	})
);
export type LeaseResult = Infer<typeof leaseResult>;

export const applyArgs = {
	connectionId: v.id('bankConnections'),
	lease: v.number(),

	fromCursor: v.union(v.string(), v.null()),
	nextCursor: v.string(),

	hasMore: v.boolean(),
	rows: v.array(syncRow),
	modified: v.array(syncRow),
	removed: v.array(syncRemoval),
	release: v.boolean(),
	attentionNotices: v.number()
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
	attempt: v.number(),
	resumeFrom: v.optional(v.number()),
	message: v.string(),
	status: v.union(v.literal('needsAttention'), v.literal('shortLived'), v.literal('failed'))
};

export const recordAccountsArgs = {
	connectionId: v.id('bankConnections'),
	answersRequestAt: v.optional(v.union(v.number(), v.null())),
	accounts: v.array(
		v.object({ externalId: v.string(), name: v.string(), mask: v.optional(v.string()) })
	)
};

export const startingBalanceBasis = v.union(
	v.object({ kind: v.literal('notSynced') }),
	v.object({ kind: v.literal('importing') }),
	v.object({
		kind: v.literal('synced'),
		itemId: v.string(),
		encryptedToken: v.string(),
		externalId: v.string(),
		imported: v.number()
	})
);
export type StartingBalanceBasis = Infer<typeof startingBalanceBasis>;

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
		resumeFrom?: number;
		discover: boolean;
	}) => Effect.Effect<LeaseResult>;
	readonly apply: (args: {
		connectionId: Id<'bankConnections'>;
		lease: number;
		fromCursor: string | null;
		nextCursor: string;
		hasMore: boolean;
		rows: SyncRow[];
		modified: SyncRow[];
		removed: SyncRemoval[];
		release: boolean;
		attentionNotices: number;
	}) => Effect.Effect<ApplyResult>;

	readonly renewLease: (args: {
		connectionId: Id<'bankConnections'>;
		lease: number;
	}) => Effect.Effect<number | null>;
	readonly fail: (
		args: {
			connectionId: Id<'bankConnections'>;
			lease: number;
			attempt: number;
			resumeFrom?: number;
		} & SyncFailure
	) => Effect.Effect<void>;
	readonly credentials: (
		connectionId: Id<'bankConnections'>
	) => Effect.Effect<{ itemId: string; encryptedToken: string } | 'missing' | 'noToken'>;
	readonly recordConsent: (args: {
		connectionId: Id<'bankConnections'>;
		consentExpiresAt: number | null;
		checkedByLease: number;
	}) => Effect.Effect<void>;
	readonly save: (args: {
		name: string;
		itemId: string;
		encryptedToken: string;
		accounts: { externalId: string; accountId: Id<'accounts'> }[];
	}) => Effect.Effect<Id<'bankConnections'>>;
	readonly recordAccounts: (args: {
		connectionId: Id<'bankConnections'>;
		answersRequestAt: number | null;
		accounts: { externalId: string; name: string; mask?: string }[];
	}) => Effect.Effect<void>;
	readonly startingBalanceBasis: (accountId: Id<'accounts'>) => Effect.Effect<StartingBalanceBasis>;
}

export type MutationRunner = Pick<GenericActionCtx<DataModel>, 'runMutation' | 'runQuery'>;

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
			save: (args) => Effect.promise(() => runMutation(internal.bankConnections.save, args)),
			recordAccounts: (args) =>
				Effect.promise(() => runMutation(internal.heldAccounts.recordAccounts, args)),
			startingBalanceBasis: (accountId) =>
				Effect.promise(() => runQuery(internal.heldAccounts.startingBalanceBasis, { accountId }))
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

export const syncConnection = Effect.fnUntraced(function* (
	connectionId: Id<'bankConnections'>,
	{
		refresh,
		resume = false,
		resumeFrom,
		attempt = 0,
		discover = false
	}: {
		refresh: boolean;
		resume?: boolean;
		resumeFrom?: number | undefined;
		attempt?: number;
		discover?: boolean;
	}
): Effect.fn.Return<SyncOutcome, SyncError, PlaidClient | TokenCipher | SyncStore> {
	const store = yield* SyncStore;
	const plaid = yield* PlaidClient;
	const cipher = yield* TokenCipher;
	const taken = yield* store.takeLease({
		connectionId,
		resume,
		discover,
		...(resumeFrom === undefined ? {} : { resumeFrom })
	});
	if (taken.kind !== 'taken') return taken;
	const authorized = resume || resumeFrom !== undefined;

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
				const renewedBeforePagingAgain = yield* store.renewLease({ connectionId, lease });
				if (renewedBeforePagingAgain === null) return { kind: 'busy' } as const;
				lease = renewedBeforePagingAgain;
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
				modified: fetched.modified,
				removed: fetched.removed,
				release,
				attentionNotices: taken.attentionNotices
			});
			if (applied.kind === 'stale') return { kind: 'busy' } as const;
			totals.added += applied.added;
			totals.matched += applied.matched;
			totals.held += applied.held;
			committed = fetched.nextCursor;
			if (applied.lease === null) break;
			lease = applied.lease;
		}
		const item = yield* Effect.option(plaid.itemGet(accessToken));
		if (Option.isSome(item)) {
			yield* store.recordConsent({
				connectionId,
				consentExpiresAt: item.value.consentExpiresAt,
				checkedByLease: taken.lease
			});
		}
		if (taken.accountsCheckRequestedAt !== null || totals.held > 0) {
			yield* Effect.ignore(
				plaid.accountsGet(accessToken).pipe(
					Effect.flatMap((accounts) =>
						store.recordAccounts({
							connectionId,
							answersRequestAt: taken.accountsCheckRequestedAt,
							accounts: accounts.map(namesOf)
						})
					)
				)
			);
		}
		if (refresh) yield* Effect.ignore(plaid.transactionsRefresh(accessToken));
		return { kind: 'synced', ...totals } as const;
	});
	return yield* run.pipe(
		Effect.tapCause((cause) => {
			const failure = describeFailure(cause);
			return store.fail({
				connectionId,
				lease,
				attempt,
				...(authorized ? { resumeFrom: taken.attentionNotices } : {}),
				...failure
			});
		})
	);
});

function namesOf({ externalId, name, mask }: BankAccount) {
	return { externalId, name, ...(mask === undefined ? {} : { mask }) };
}

export type StartingBalanceSuggestion =
	| { kind: 'suggested'; startingBalance: number }
	| { kind: 'notSynced' }
	| { kind: 'importing' }
	| { kind: 'noBalance' };

export const suggestStartingBalance = Effect.fnUntraced(function* (
	accountId: Id<'accounts'>
): Effect.fn.Return<StartingBalanceSuggestion, SyncError, PlaidClient | TokenCipher | SyncStore> {
	const store = yield* SyncStore;
	const plaid = yield* PlaidClient;
	const cipher = yield* TokenCipher;
	const basis = yield* store.startingBalanceBasis(accountId);
	if (basis.kind !== 'synced') return basis;
	const accessToken = yield* cipher.decrypt(basis.encryptedToken, basis.itemId);
	const [account] = yield* plaid.accountsGet(accessToken, [basis.externalId]);
	if (account === undefined || account.balance === null) return { kind: 'noBalance' } as const;
	return { kind: 'suggested', startingBalance: account.balance - basis.imported } as const;
});

interface Batch {
	rows: SyncRow[];
	modified: SyncRow[];
	removed: SyncRemoval[];
	nextCursor: string;
	hasMore: boolean;
}

function fetchBatch(
	plaid: PlaidClient['Service'],
	accessToken: string,
	cursor: string | null,
	cutoverDate: string
): Effect.Effect<Batch, PlaidError> {
	return Effect.gen(function* () {
		const rows: SyncRow[] = [];
		const modified: SyncRow[] = [];
		const removed: SyncRemoval[] = [];
		const collect = (page: SyncPage) => {
			const changes = syncRowsOf(page, cutoverDate);
			rows.push(...changes.added);
			modified.push(...changes.modified);
			removed.push(...changes.removed);
		};
		let page = yield* plaid.transactionsSync({ accessToken, cursor, count: PAGE_SIZE });
		collect(page);
		for (let pages = 1; pages < PAGES_PER_BATCH && page.hasMore; pages++) {
			page = yield* plaid.transactionsSync({
				accessToken,
				cursor: page.nextCursor,
				count: PAGE_SIZE
			});
			collect(page);
		}
		return { rows, modified, removed, nextCursor: page.nextCursor, hasMore: page.hasMore };
	});
}

function describeFailure(cause: Cause.Cause<SyncError>): SyncFailure {
	const error = Cause.findErrorOption(cause);
	if (Option.isNone(error)) return { status: 'failed', message: 'The sync stopped unexpectedly.' };
	return failureOf(error.value);
}

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
