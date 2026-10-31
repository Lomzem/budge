import { Effect, Exit, Layer } from 'effect';
import { describe, expect, test } from 'vitest';

import { decodeSyncPage, type SyncPage } from '../src/lib/domain/plaid';
import syncPage from '../src/lib/domain/fixtures/synthetic/plaid-sync-page.json';
import { api, internal } from './_generated/api';
import { PlaidApi, PlaidClient, type SyncRequest } from './lib/plaidClient';
import {
	MAX_BATCHES,
	PAGES_PER_BATCH,
	setupConnection,
	SyncStore,
	syncConnection
} from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

const cutoverDate = '2026-08-01';
// Invented credentials and IDs; nothing here is a real token or Plaid ID.
const accessToken = 'access-token-synthetic-not-real';
const itemId = 'item-synthetic-1';
const externalId = 'account-synthetic-checking';
const tokenKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

const page = Effect.runSync(decodeSyncPage(syncPage));

type Backend = ReturnType<typeof newBackend>;

type FakePlaid = Parameters<typeof PlaidClient.layerTest>[0];

/**
 * Runs a sync program inside an action on the test backend, as the live actions do, but with
 * Plaid faked and a test key.
 */
function runInAction<A, E>(
	{ t }: Backend,
	plaid: FakePlaid,
	program: Effect.Effect<A, E, PlaidClient | TokenCipher | SyncStore>
) {
	// An action's result crosses Convex's serialization, so the Exit becomes a plain object.
	return t.action(async (ctx) => {
		const exit = await Effect.runPromiseExit(
			program.pipe(
				Effect.provide(
					Layer.mergeAll(
						PlaidClient.layerTest(plaid),
						TokenCipher.layer(tokenKey),
						SyncStore.layer(ctx)
					)
				)
			)
		);
		return Exit.isSuccess(exit) ? { ok: true as const, value: exit.value } : { ok: false as const };
	});
}

/** A fake `/transactions/sync` that records each request and answers from `pages` in turn. */
function plaidPages(...pages: SyncPage[]) {
	const requests: SyncRequest[] = [];
	const transactionsSync = (request: SyncRequest) => {
		requests.push(request);
		const next = pages[Math.min(requests.length, pages.length) - 1] ?? page;
		return Effect.succeed(next);
	};
	return { requests, transactionsSync };
}

async function connectedBudget() {
	const backend = newBackend();
	const { owner, t } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 100_000
	});
	const webhooks: string[] = [];
	const setup = await runInAction(
		backend,
		{
			setWebhook: (token, webhook) => {
				expect(token).toBe(accessToken);
				webhooks.push(webhook);
				return Effect.void;
			}
		},
		setupConnection({
			name: 'Sample Bank',
			itemId,
			accessToken,
			webhook: 'https://budge.example.test/plaid/webhook',
			accounts: [{ externalId, accountId: checking }]
		})
	);
	if (!setup.ok) throw new Error('setup failed');
	const connectionId = setup.value;
	const sync = (plaid: FakePlaid, refresh = false) =>
		runInAction(backend, plaid, syncConnection(connectionId, { refresh }));
	const connection = () => t.run((ctx) => ctx.db.get('bankConnections', connectionId));
	const rows = async () =>
		(
			await owner.query(api.transactions.list, {
				accountId: checking,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	return { ...backend, checking, connectionId, webhooks, sync, connection, rows };
}

const synced = (result: { ok: true; value: unknown } | { ok: false }) =>
	result.ok ? result.value : result;

describe('setting up a Bank Connection', () => {
	test('seals the token, maps the Account, and points the webhook at Budge', async () => {
		const { t, webhooks, connection, connectionId, checking } = await connectedBudget();

		expect(webhooks).toEqual(['https://budge.example.test/plaid/webhook']);
		const saved = await connection();
		expect(saved).toMatchObject({
			name: 'Sample Bank',
			status: 'ok',
			provider: { kind: 'plaid', itemId }
		});
		expect(JSON.stringify(saved)).not.toContain(accessToken);
		expect(await t.run((ctx) => ctx.db.query('connectionAccounts').collect())).toMatchObject([
			{ connectionId, externalId, state: 'mapped', accountId: checking }
		]);
	});
});

describe('syncing a Bank Connection', () => {
	test('applies a batch: posted rows from the cutover date become Unapproved Transactions', async () => {
		const { sync, rows, connection } = await connectedBudget();
		const plaid = plaidPages(page);

		expect(synced(await sync(plaid))).toEqual({ kind: 'synced', added: 2, matched: 0, held: 0 });

		expect(plaid.requests).toEqual([{ accessToken, cursor: null, count: 100 }]);
		expect(await rows()).toMatchObject([
			{
				date: '2026-08-15',
				amount: 231_042,
				payeeName: 'SAMPLE PAYROLL',
				cleared: true,
				approved: false,
				bankRows: [{ bankText: 'SAMPLE PAYROLL', matched: false }]
			},
			{
				date: '2026-08-14',
				amount: -4_250,
				// The merchant name names the Payee; the Bank Text stays on the Bank Row.
				payeeName: 'Sample Grocer',
				cleared: true,
				approved: false,
				bankRows: [{ bankText: 'DEBIT CARD PURCHASE SAMPLE GROCER 0193' }]
			}
		]);
		const saved = await connection();
		expect(saved?.provider).toMatchObject({ cursor: 'cursor-synthetic-2' });
		expect(saved?.syncLeaseUntil).toBeUndefined();
		expect(saved?.lastSyncedAt).toBeTypeOf('number');
	});

	test('the same batch again adds nothing, and continues from the saved cursor', async () => {
		const { sync, rows } = await connectedBudget();
		await sync(plaidPages(page));
		const plaid = plaidPages(page);

		expect(synced(await sync(plaid))).toEqual({ kind: 'synced', added: 0, matched: 0, held: 0 });

		expect(plaid.requests).toMatchObject([{ cursor: 'cursor-synthetic-2' }]);
		expect(await rows()).toHaveLength(2);
	});

	test('rename memory comes before the merchant name', async () => {
		const { t, sync, rows } = await connectedBudget();
		await t.run(async (ctx) => {
			const payeeId = await ctx.db.insert('payees', { name: 'Corner Market' });
			await ctx.db.insert('payeeRenames', {
				bankText: 'DEBIT CARD PURCHASE SAMPLE GROCER 0193',
				payeeId
			});
		});

		await sync(plaidPages(page));

		expect((await rows()).map((row) => row.payeeName)).toEqual(['SAMPLE PAYROLL', 'Corner Market']);
	});

	test('Matches a Transaction the owner entered', async () => {
		const { owner, sync, rows, checking } = await connectedBudget();
		await owner.mutation(api.transactions.create, {
			accountId: checking,
			date: '2026-08-13',
			amount: -4_250,
			payee: 'Grocer',
			memo: 'weekly shop'
		});

		expect(synced(await sync(plaidPages(page)))).toMatchObject({ added: 1, matched: 1 });
		expect(await rows()).toMatchObject([
			{ amount: 231_042 },
			{ amount: -4_250, payeeName: 'Grocer', memo: 'weekly shop', cleared: true, approved: false }
		]);
	});

	test('a held lease makes the sync a no-op with no Plaid call', async () => {
		const { t, sync, connectionId, rows } = await connectedBudget();
		await t.run((ctx) =>
			ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: Date.now() + 60_000 })
		);

		// The test layer fails on any Plaid call it wasn't given.
		expect(synced(await sync({}))).toEqual({ kind: 'busy' });
		expect(await rows()).toEqual([]);
	});

	test('Sync now while a lease is held is a no-op', async () => {
		const { t, owner, connectionId } = await connectedBudget();
		await t.run((ctx) =>
			ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: Date.now() + 60_000 })
		);

		expect(await owner.action(api.bankConnections.syncNow, { connectionId })).toEqual({
			kind: 'busy'
		});
	});

	test('an expired lease is taken over', async () => {
		const { t, sync, connectionId } = await connectedBudget();
		await t.run((ctx) =>
			ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: Date.now() - 1 })
		);

		expect(synced(await sync(plaidPages(page)))).toMatchObject({ kind: 'synced', added: 2 });
	});

	test('a batch whose lease or cursor is no longer current writes nothing', async () => {
		const { t, connectionId, connection, rows } = await connectedBudget();
		const taken = await t.mutation(internal.bankConnections.takeLease, { connectionId });
		if (taken.kind !== 'taken') throw new Error('expected the lease');
		const batch = {
			connectionId,
			nextCursor: 'cursor-synthetic-2',
			rows: [
				{
					externalAccountId: externalId,
					sourceId: 'txn-synthetic-9',
					date: '2026-08-20',
					amount: -100,
					bankText: 'SAMPLE STALE'
				}
			],
			release: true
		};

		expect(
			await t.mutation(internal.bankConnections.apply, {
				...batch,
				lease: taken.lease - 1,
				fromCursor: null
			})
		).toEqual({ kind: 'stale' });
		expect(
			await t.mutation(internal.bankConnections.apply, {
				...batch,
				lease: taken.lease,
				fromCursor: 'cursor-synthetic-0'
			})
		).toEqual({ kind: 'stale' });
		expect(await rows()).toEqual([]);
		expect((await connection())?.provider).not.toHaveProperty('cursor');
	});

	test('holds rows from a bank Account not yet mapped', async () => {
		const { t, sync, rows, connectionId } = await connectedBudget();
		const otherAccount = {
			...page,
			added: page.added.map((row) => ({ ...row, account_id: 'account-synthetic-savings' }))
		};

		expect(synced(await sync(plaidPages(otherAccount)))).toEqual({
			kind: 'synced',
			added: 0,
			matched: 0,
			held: 2
		});
		expect(await rows()).toEqual([]);
		expect(
			await t.run((ctx) =>
				ctx.db
					.query('connectionAccounts')
					.withIndex('by_connection_externalId', (q) =>
						q.eq('connectionId', connectionId).eq('externalId', 'account-synthetic-savings')
					)
					.collect()
			)
		).toMatchObject([{ state: 'held' }]);
	});

	test('pages through a batch, applying at most a bounded number per sync', async () => {
		const { sync, connection } = await connectedBudget();
		const more = (n: number): SyncPage => ({
			added: [],
			nextCursor: `cursor-synthetic-page-${String(n)}`,
			hasMore: true
		});
		const pages = Array.from({ length: 20 }, (_, n) => more(n + 1));
		const plaid = plaidPages(...pages);

		expect(synced(await sync(plaid))).toMatchObject({ kind: 'synced' });

		expect(plaid.requests).toHaveLength(MAX_BATCHES * PAGES_PER_BATCH);
		const saved = await connection();
		expect(saved?.provider).toMatchObject({
			cursor: `cursor-synthetic-page-${String(MAX_BATCHES * PAGES_PER_BATCH)}`
		});
		expect(saved?.syncLeaseUntil).toBeUndefined();
	});

	test('starts a batch over when the bank changes mid-way', async () => {
		const { sync } = await connectedBudget();
		let calls = 0;
		const transactionsSync = (request: SyncRequest) => {
			calls++;
			if (calls === 1)
				return Effect.succeed({ ...page, nextCursor: 'cursor-synthetic-x', hasMore: true });
			if (calls === 2) {
				return Effect.fail(
					new PlaidApi({
						error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
						status: 400,
						request_id: 'request-synthetic-2'
					})
				);
			}
			expect(request.cursor).toBeNull();
			return Effect.succeed(page);
		};

		expect(synced(await sync({ transactionsSync }))).toMatchObject({ added: 2 });
		expect(calls).toBe(3);
	});

	test('a failure records a message for the owner and releases the lease', async () => {
		const { sync, connection } = await connectedBudget();

		const exit = await sync({
			transactionsSync: () =>
				Effect.fail(
					new PlaidApi({
						error_code: 'ITEM_LOGIN_REQUIRED',
						status: 400,
						request_id: 'request-synthetic-3'
					})
				)
		});

		expect(exit).toEqual({ ok: false });
		const saved = await connection();
		expect(saved).toMatchObject({
			status: 'needsAttention',
			lastError: { message: 'The bank needs you to sign in again.' }
		});
		expect(saved?.syncLeaseUntil).toBeUndefined();
	});

	test('Sync now asks Plaid to refresh after syncing', async () => {
		const { sync } = await connectedBudget();
		const refreshed: string[] = [];

		await sync(
			{
				...plaidPages(page),
				transactionsRefresh: (token) => {
					refreshed.push(token);
					return Effect.void;
				}
			},
			true
		);

		expect(refreshed).toEqual([accessToken]);
	});

	test('a connection with no token never syncs', async () => {
		const { t, owner } = newBackend();
		const connectionId = await t.run((ctx) =>
			ctx.db.insert('bankConnections', {
				name: 'Sample Bank (Sandbox)',
				status: 'ok',
				provider: { kind: 'sandbox' }
			})
		);

		expect(await owner.action(api.bankConnections.syncNow, { connectionId })).toEqual({
			kind: 'noToken'
		});
	});
});

describe('the Bank Connection status', () => {
	test('never returns the provider', async () => {
		const { owner, sync, connectionId } = await connectedBudget();
		await sync(plaidPages(page));

		const [status] = await owner.query(api.bankConnections.list, {});

		expect(Object.keys(status ?? {}).sort()).toEqual([
			'_id',
			'lastError',
			'lastSyncedAt',
			'name',
			'status'
		]);
		expect(status).toMatchObject({ _id: connectionId, name: 'Sample Bank', lastError: null });
		expect(JSON.stringify(status)).not.toMatch(/item-synthetic|cursor-synthetic|v1\./);
	});
});
