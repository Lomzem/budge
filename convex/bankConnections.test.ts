import { Effect, Exit, Layer } from 'effect';
import { assert, describe, expect, test } from 'vitest';

import { decodeSyncPage, type SyncPage } from '../src/lib/domain/plaid';
import syncPage from '../src/lib/domain/fixtures/synthetic/plaid-sync-page.json';
import { api, internal } from './_generated/api';
import {
	PLAID_MIN_SYNC_COUNT,
	PLAID_MAX_SYNC_COUNT,
	PlaidApi,
	PlaidClient,
	type SyncRequest
} from './lib/plaidClient';
import {
	PAGE_SIZE,
	MAX_BATCHES,
	PAGES_PER_BATCH,
	reconnectLinkToken,
	RETRY_DELAYS_MS,
	setupConnection,
	SyncStore,
	syncConnection
} from './lib/sync';
import { TokenCipher } from './lib/tokenCipher';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

const cutoverDate = '2026-08-01';

const accessToken = 'access-token-synthetic-not-real';
const itemId = 'item-synthetic-1';
const externalId = 'account-synthetic-checking';
const tokenKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

const page = Effect.runSync(decodeSyncPage(syncPage));

type Backend = ReturnType<typeof newBackend>;

type FakePlaid = Parameters<typeof PlaidClient.layerTest>[0];

function runInAction<A, E>(
	{ t }: Pick<Backend, 't'>,
	plaid: FakePlaid,
	program: Effect.Effect<A, E, PlaidClient | TokenCipher | SyncStore>
) {
	return t.action(async (ctx) => {
		const exit = await Effect.runPromiseExit(
			program.pipe(
				Effect.provide(
					Layer.mergeAll(
						PlaidClient.layerTest({
							itemGet: () => Effect.succeed({ consentExpiresAt: null }),
							...plaid
						}),
						TokenCipher.layer(tokenKey),
						SyncStore.layer(ctx)
					)
				)
			)
		);
		return Exit.isSuccess(exit) ? { ok: true as const, value: exit.value } : { ok: false as const };
	});
}

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
	assert(setup.ok, 'setup failed');
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

const needsLogin = new PlaidApi({
	error_code: 'ITEM_LOGIN_REQUIRED',
	status: 400,
	request_id: 'request-synthetic-3'
});

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

	test('setting up an Item again replaces its token, however many connections there are', async () => {
		const { owner, t } = newBackend();
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate });
		const checking = await owner.mutation(api.accounts.create, {
			name: 'Checking',
			kind: 'cash',
			startingBalance: 0
		});
		await t.run(async (ctx) => {
			for (let i = 0; i < 25; i++) {
				await ctx.db.insert('bankConnections', {
					name: `Other Bank ${String(i)}`,
					status: 'ok',
					provider: {
						kind: 'plaid',
						itemId: `item-synthetic-other-${String(i)}`,
						encryptedToken: 'x'
					}
				});
			}
		});
		const save = (encryptedToken: string) =>
			t.mutation(internal.bankConnections.save, {
				name: 'Sample Bank',
				itemId,
				encryptedToken,
				accounts: [{ externalId, accountId: checking }]
			});

		const first = await save('sealed-token-synthetic-1');
		expect(await save('sealed-token-synthetic-2')).toBe(first);
		const items = await t.run(async (ctx) =>
			(await ctx.db.query('bankConnections').collect()).filter(
				(c) => c.provider.kind === 'plaid' && c.provider.itemId === itemId
			)
		);
		expect(items).toMatchObject([{ provider: { encryptedToken: 'sealed-token-synthetic-2' } }]);
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

	test('a synced Transaction can be found by its Bank Text', async () => {
		const { sync, owner, checking } = await connectedBudget();
		await sync(plaidPages(page));

		const found = await owner.query(api.transactions.list, {
			accountId: checking,
			search: 'debit card purchase',
			paginationOpts: { numItems: 50, cursor: null }
		});
		expect(found.page).toMatchObject([{ payeeName: 'Sample Grocer' }]);
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

		const plaidFailingEveryCall = {};
		expect(synced(await sync(plaidFailingEveryCall))).toEqual({ kind: 'busy' });
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
		const taken = await t.mutation(internal.bankConnections.takeLease, {
			connectionId,
			resume: false,
			discover: false
		});
		assert(taken.kind === 'taken', 'expected the lease');

		const batch = {
			connectionId,
			nextCursor: 'cursor-synthetic-2',
			hasMore: false,
			rows: [
				{
					externalAccountId: externalId,
					sourceId: 'txn-synthetic-9',
					date: '2026-08-20',
					amount: -100,
					bankText: 'SAMPLE STALE'
				}
			],
			modified: [],
			removed: [],
			release: true,
			attentionNotices: 0
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

	test('pages through a batch, applying at most a bounded number per sync', async () => {
		const { sync, connection } = await connectedBudget();
		const more = (n: number): SyncPage => ({
			added: [],
			modified: [],
			removed: [],
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

	const bankChanged = () =>
		Effect.fail(
			new PlaidApi({
				error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
				status: 400,
				request_id: 'request-synthetic-2'
			})
		);
	const morePage = (n: number): SyncPage => ({
		added: [],
		modified: [],
		removed: [],
		nextCursor: `cursor-synthetic-page-${String(n)}`,
		hasMore: true
	});

	test('a bank change in a later batch restarts the whole update from its first cursor', async () => {
		const { sync, connection } = await connectedBudget();
		const cursors: (string | null)[] = [];
		const transactionsSync = (request: SyncRequest) => {
			cursors.push(request.cursor);
			const call = cursors.length;
			if (call <= PAGES_PER_BATCH) return Effect.succeed(morePage(call));
			if (call === PAGES_PER_BATCH + 1) return bankChanged();
			return Effect.succeed(page);
		};

		expect(synced(await sync({ transactionsSync }))).toMatchObject({ added: 2 });
		const whereTheFirstBatchStopped = `cursor-synthetic-page-${String(PAGES_PER_BATCH)}`;
		const cursorBeforeTheUpdatesFirstPage = null;
		expect(cursors.slice(PAGES_PER_BATCH)).toEqual([
			whereTheFirstBatchStopped,
			cursorBeforeTheUpdatesFirstPage
		]);
		const saved = await connection();
		expect(saved?.provider).toMatchObject({ cursor: page.nextCursor });
		expect(saved?.provider).not.toHaveProperty('updateStart');
	});

	test('an update left unfinished by one sync restarts from its first cursor in the next', async () => {
		const { sync, connection } = await connectedBudget();
		const pages = Array.from({ length: MAX_BATCHES * PAGES_PER_BATCH }, (_, n) => morePage(n + 1));
		await sync(plaidPages(...pages));
		expect((await connection())?.provider).toMatchObject({ updateStart: null });

		const cursors: (string | null)[] = [];
		const transactionsSync = (request: SyncRequest) => {
			cursors.push(request.cursor);
			return cursors.length === 1 ? bankChanged() : Effect.succeed(page);
		};

		expect(synced(await sync({ transactionsSync }))).toMatchObject({ added: 2 });
		expect(cursors).toEqual([
			`cursor-synthetic-page-${String(MAX_BATCHES * PAGES_PER_BATCH)}`,
			null
		]);
		expect((await connection())?.provider).not.toHaveProperty('updateStart');
	});

	test('renews the lease before starting an update over, and stops if it was lost', async () => {
		const { t, sync, connectionId } = await connectedBudget();
		let calls = 0;
		const anotherSyncTakesOverTheLease = () =>
			Effect.promise(() =>
				t.run((ctx) =>
					ctx.db.patch('bankConnections', connectionId, { syncLeaseUntil: Date.now() + 60_000 })
				)
			);
		const transactionsSync = () => {
			calls++;
			if (calls === 1) return Effect.succeed(morePage(1));
			return anotherSyncTakesOverTheLease().pipe(Effect.andThen(bankChanged));
		};

		expect(synced(await sync({ transactionsSync }))).toEqual({ kind: 'busy' });
		expect(calls).toBe(2);
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
			lastError: { message: 'The bank needs you to reconnect (ITEM_LOGIN_REQUIRED).' }
		});
		expect(saved?.syncLeaseUntil).toBeUndefined();
	});

	test('a needed login pauses sync until the owner reconnects, and the status says so', async () => {
		const { owner, sync, connectionId } = await connectedBudget();
		await sync({ transactionsSync: () => Effect.fail(needsLogin) });

		expect(synced(await sync({}))).toEqual({ kind: 'paused' });
		expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toMatchObject([
			{
				_id: connectionId,
				status: 'needsAttention',
				lastError: { message: 'The bank needs you to reconnect (ITEM_LOGIN_REQUIRED).' }
			}
		]);
	});

	const bankDown = new PlaidApi({
		error_code: 'INSTITUTION_NOT_RESPONDING',
		status: 400,
		request_id: 'request-synthetic-4'
	});
	const retries = (t: Backend['t']) =>
		t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());

	test('a short-lived error retries quietly with backoff, leaving the status OK', async () => {
		const { t, sync, connection, connectionId } = await connectedBudget();
		const before = Date.now();

		await sync({ transactionsSync: () => Effect.fail(bankDown) });

		const saved = await connection();
		expect(saved).toMatchObject({ status: 'ok' });
		expect(saved?.lastError).toBeUndefined();
		expect(saved?.syncLeaseUntil).toBeUndefined();
		const [retry, ...others] = await retries(t);
		expect(others).toEqual([]);
		expect(retry).toMatchObject({
			name: 'bankConnections:retrySync',
			args: [{ connectionId, attempt: 1 }]
		});
		expect(retry?.scheduledTime).toBeGreaterThanOrEqual(before + 60_000);
	});

	test('each retry waits longer than the one before', async () => {
		const { t, connectionId } = await connectedBudget();
		const before = Date.now();

		await runInAction(
			{ t },
			{ transactionsSync: () => Effect.fail(bankDown) },
			syncConnection(connectionId, { refresh: false, attempt: 1 })
		);

		const [retry] = await retries(t);
		expect(retry).toMatchObject({ args: [{ connectionId, attempt: 2 }] });
		expect(retry?.scheduledTime).toBeGreaterThanOrEqual(before + 5 * 60_000);
	});

	test('once its retries run out, a short-lived error is recorded for the owner', async () => {
		const { t, connection, connectionId } = await connectedBudget();

		await runInAction(
			{ t },
			{ transactionsSync: () => Effect.fail(bankDown) },
			syncConnection(connectionId, { refresh: false, attempt: RETRY_DELAYS_MS.length })
		);

		expect(await connection()).toMatchObject({
			status: 'ok',
			lastError: { message: 'The bank is unavailable for now (INSTITUTION_NOT_RESPONDING).' }
		});
		expect(await retries(t)).toEqual([]);
	});

	test('a needed login is not retried', async () => {
		const { t, sync } = await connectedBudget();

		await sync({ transactionsSync: () => Effect.fail(needsLogin) });

		expect(await retries(t)).toEqual([]);
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

describe("Plaid's notice that a Bank Connection needs the owner", () => {
	test('an announced disconnect pauses sync and shows as needing attention', async () => {
		const { t, owner, sync } = await connectedBudget();

		await t.mutation(internal.bankConnections.flagItem, { itemId, code: 'PENDING_DISCONNECT' });

		expect(synced(await sync({}))).toEqual({ kind: 'paused' });
		expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toMatchObject([
			{
				status: 'needsAttention',
				lastError: { message: 'The bank needs you to reconnect (PENDING_DISCONNECT).' }
			}
		]);
	});

	test('a code that needs no owner, or an unknown Item, changes nothing', async () => {
		const { t, connection } = await connectedBudget();
		const before = await connection();

		await t.mutation(internal.bankConnections.flagItem, { itemId, code: 'INSTITUTION_DOWN' });
		await t.mutation(internal.bankConnections.flagItem, {
			itemId: 'item-synthetic-unknown',
			code: 'ITEM_LOGIN_REQUIRED'
		});

		expect(await connection()).toEqual(before);
	});
});

describe('reconnecting a Bank Connection', () => {
	test('gets an update-mode link token for the existing Item, never a new Item', async () => {
		const { sync, connectionId, t } = await connectedBudget();
		await sync({ transactionsSync: () => Effect.fail(needsLogin) });
		const requests: unknown[] = [];

		const result = await runInAction(
			{ t },
			{
				linkTokenCreate: (request) => {
					requests.push(request);
					return Effect.succeed('link-token-synthetic-1');
				}
			},
			reconnectLinkToken(connectionId)
		);

		expect(synced(result)).toEqual({ kind: 'linkToken', linkToken: 'link-token-synthetic-1' });
		expect(requests).toEqual([{ accessToken, clientUserId: connectionId }]);
	});

	test('a successful sync after Reconnect clears the needed login', async () => {
		const { t, owner, sync, connectionId } = await connectedBudget();
		await sync({ transactionsSync: () => Effect.fail(needsLogin) });

		await runInAction(
			{ t },
			plaidPages(page),
			syncConnection(connectionId, { refresh: false, resume: true })
		);

		expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toMatchObject([
			{ status: 'ok', lastError: null }
		]);
		expect(synced(await sync(plaidPages(page)))).toMatchObject({ kind: 'synced' });
	});
});

describe('a needed login while syncing', () => {
	const bankDown = new PlaidApi({
		error_code: 'INSTITUTION_NOT_RESPONDING',
		status: 400,
		request_id: 'request-synthetic-6'
	});
	const scheduledRetry = async (t: Backend['t']) => {
		const jobs = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
		const retry = jobs.find((job) => job.name === 'bankConnections:retrySync');
		assert(retry !== undefined, 'expected a scheduled retry');
		const [{ attempt, resumeFrom }] = retry.args as [{ attempt: number; resumeFrom?: number }];
		return { attempt, resumeFrom };
	};
	const statusOf = async (owner: Backend['owner']) =>
		(await owner.query(api.bankConnections.list, { now: Date.now() }))[0]?.status;

	test('a short-lived failure in the sync after Reconnect still retries and recovers', async () => {
		const { t, owner, sync, connectionId } = await connectedBudget();
		await sync({ transactionsSync: () => Effect.fail(needsLogin) });
		await runInAction(
			{ t },
			{ transactionsSync: () => Effect.fail(bankDown) },
			syncConnection(connectionId, { refresh: false, resume: true })
		);

		const retried = await runInAction(
			{ t },
			plaidPages(page),
			syncConnection(connectionId, { refresh: false, ...(await scheduledRetry(t)) })
		);

		expect(synced(retried)).toMatchObject({ kind: 'synced' });
		expect(await statusOf(owner)).toBe('ok');
	});

	test('a new notice that the bank needs the owner stops that retry', async () => {
		const { t, sync, connectionId } = await connectedBudget();
		await sync({ transactionsSync: () => Effect.fail(needsLogin) });
		await runInAction(
			{ t },
			{ transactionsSync: () => Effect.fail(bankDown) },
			syncConnection(connectionId, { refresh: false, resume: true })
		);
		await t.mutation(internal.bankConnections.flagItem, { itemId, code: 'PENDING_DISCONNECT' });

		const retried = await runInAction(
			{ t },
			plaidPages(page),
			syncConnection(connectionId, { refresh: false, ...(await scheduledRetry(t)) })
		);

		expect(synced(retried)).toEqual({ kind: 'paused' });
	});

	test.each([
		['an ordinary sync', false],
		['the sync after Reconnect', true]
	])('a notice that arrives during %s still shows once it finishes', async (_name, resume) => {
		const { t, owner, sync, connectionId } = await connectedBudget();
		if (resume) await sync({ transactionsSync: () => Effect.fail(needsLogin) });
		const noticeMidSync = () =>
			Effect.promise(() =>
				t.mutation(internal.bankConnections.flagItem, { itemId, code: 'PENDING_EXPIRATION' })
			).pipe(Effect.as(page));

		await runInAction(
			{ t },
			{ transactionsSync: noticeMidSync },
			syncConnection(connectionId, { refresh: false, resume })
		);

		expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toMatchObject([
			{
				status: 'needsAttention',
				lastError: { message: 'The bank needs you to reconnect (PENDING_EXPIRATION).' }
			}
		]);
	});
});

describe('the Bank Connection status', () => {
	test('never returns the provider', async () => {
		const { owner, sync, connectionId } = await connectedBudget();
		await sync(plaidPages(page));

		const [status] = await owner.query(api.bankConnections.list, { now: Date.now() });

		expect(Object.keys(status ?? {}).sort()).toEqual([
			'_id',
			'consentEndsAt',
			'lastError',
			'lastSyncedAt',
			'name',
			'overdue',
			'status'
		]);
		expect(status).toMatchObject({ _id: connectionId, name: 'Sample Bank', lastError: null });
		expect(JSON.stringify(status)).not.toMatch(/item-synthetic|cursor-synthetic|v1\./);
	});

	const day = 24 * 60 * 60_000;

	test('the renewal line shows from 14 days before consent ends', async () => {
		const { owner, sync } = await connectedBudget();
		const consentExpiresAt = Date.parse('2026-11-20T15:00:00Z');
		await sync({
			...plaidPages(page),
			itemGet: (token) => {
				expect(token).toBe(accessToken);
				return Effect.succeed({ consentExpiresAt });
			}
		});
		const statusAt = async (now: number) =>
			(await owner.query(api.bankConnections.list, { now }))[0]?.consentEndsAt;

		expect(await statusAt(consentExpiresAt - 14 * day - 1)).toBeNull();
		expect(await statusAt(consentExpiresAt - 14 * day)).toBe(consentExpiresAt);
		expect(await statusAt(consentExpiresAt + day)).toBe(consentExpiresAt);
	});

	test("a slower sync's older consent answer doesn't replace a newer one", async () => {
		const { owner, sync } = await connectedBudget();
		const renewedUntil = Date.parse('2027-05-01T15:00:00Z');
		const endingSoon = Date.parse('2026-11-20T15:00:00Z');
		await sync({
			...plaidPages(page),
			itemGet: () =>
				Effect.promise(async () => {
					await sync({
						...plaidPages(page),
						itemGet: () => Effect.succeed({ consentExpiresAt: renewedUntil })
					});
					return { consentExpiresAt: endingSoon };
				})
		});

		const now = renewedUntil - day;
		expect((await owner.query(api.bankConnections.list, { now }))[0]?.consentEndsAt).toBe(
			renewedUntil
		);
	});

	test('warns after 48 hours without a successful sync', async () => {
		const { owner, sync, connection } = await connectedBudget();
		await sync(plaidPages(page));
		const lastSyncedAt = (await connection())?.lastSyncedAt ?? 0;
		const overdueAt = async (now: number) =>
			(await owner.query(api.bankConnections.list, { now }))[0]?.overdue;

		expect(await overdueAt(lastSyncedAt + 48 * 60 * 60_000)).toBe(false);
		expect(await overdueAt(lastSyncedAt + 48 * 60 * 60_000 + 1)).toBe(true);
	});
});

test('sync page size stays within Plaid’s 1–500 transaction contract', () => {
	expect(PAGE_SIZE).toBeGreaterThanOrEqual(PLAID_MIN_SYNC_COUNT);
	expect(PAGE_SIZE).toBeLessThanOrEqual(PLAID_MAX_SYNC_COUNT);
});
