import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';

import syncPage from '../src/lib/domain/fixtures/synthetic/plaid-sync-page.json';
import { api, internal } from './_generated/api';
import { MAX_BANK_CONNECTIONS } from './bankConnections';
import { syncUpdatesBody, webhookSigner } from './lib/plaidWebhook.helper';
import { newBackend, publicErrorOf, startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

const accessToken = 'access-token-synthetic-not-real';
const itemId = 'item-synthetic-1';
const externalId = 'account-synthetic-checking';
const newExternalId = 'account-synthetic-new-savings';
const cardExternalId = 'account-synthetic-card';
const cutoverDate = '2026-08-01';

type Signer = Awaited<ReturnType<typeof webhookSigner>>;

function fakePlaid(signer: Signer) {
	const paths: string[] = [];
	const bodies: Record<string, unknown> = {};
	const state = {
		keyOutage: false,
		accountsOutage: false,
		institutionDown: false,
		quiet: false,
		onlyUnmapped: false,
		unmappedRows: 0,
		moreAccounts: 0,
		card: false,
		heldAnswer: null as { reached: () => void; release: Promise<void> } | null
	};
	const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input);
		assert(url.host === 'sandbox.plaid.com', `Unexpected request to ${url.host}`);
		paths.push(url.pathname);
		const answer = (body: unknown) =>
			Promise.resolve(
				new Response(JSON.stringify({ ...(body as object), request_id: 'request-synthetic' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			);
		switch (url.pathname) {
			case '/link/token/create':
				return requestBody(init).then((body) => {
					bodies[url.pathname] = body;
					return answer({ link_token: 'link-sandbox-synthetic' });
				});
			case '/item/public_token/exchange':
				return requestBody(init).then((body) => {
					bodies[url.pathname] = body;
					return answer({ access_token: accessToken, item_id: itemId });
				});
			case '/item/remove':
				return requestBody(init).then((body) => {
					bodies[url.pathname] = body;
					return answer({});
				});
			case '/item/webhook/update':
				return answer({ item: { item_id: itemId } });
			case '/webhook_verification_key/get':
				if (state.keyOutage) {
					return Promise.resolve(new Response('Service Unavailable', { status: 503 }));
				}
				return requestedKeyId(init).then((keyId) =>
					keyId === signer.wireKey.kid ? answer({ key: signer.wireKey }) : unknownKeyId()
				);
			case '/transactions/refresh':
				return answer({});
			case '/transactions/sync':
				return answer(syncAnswer(state));
			case '/accounts/get': {
				const refused = accountsRefusal(state);
				if (refused !== null) return Promise.resolve(refused);
				const accounts = answer({
					accounts: [
						{
							account_id: externalId,
							name: 'Sample Checking',
							mask: '0000',
							type: 'depository',
							balances: { current: 100 }
						},
						{
							account_id: newExternalId,
							name: 'Sample Savings',
							mask: '1111',
							type: 'depository',
							balances: { current: 250 }
						},
						...(state.card
							? [
									{
										account_id: cardExternalId,
										name: 'Sample Rewards Card',
										mask: '2222',
										type: 'credit',
										balances: { current: 42 }
									}
								]
							: []),
						...Array.from({ length: state.moreAccounts }, (_, n) => ({
							account_id: `account-synthetic-more-${String(n)}`,
							name: `Sample Savings ${String(n)}`,
							type: 'depository',
							balances: { current: 0 }
						}))
					]
				});
				const held = state.heldAnswer;
				if (held === null) return accounts;
				state.heldAnswer = null;
				held.reached();
				return held.release.then(() => accounts);
			}
			case '/item/get':
				return answer({
					item: { item_id: itemId, consent_expiration_time: null, error: null },
					status: null
				});
			default:
				return assert.fail(`Unexpected Plaid call ${url.pathname}`);
		}
	};
	return { paths, bodies, state, fetch };
}

function syncAnswer(state: { quiet: boolean; onlyUnmapped: boolean; unmappedRows: number }) {
	if (state.quiet) return { ...syncPage, added: [], modified: [], removed: [] };
	const mapped = state.onlyUnmapped ? [] : syncPage.added;
	return { ...syncPage, added: [...mapped, ...unmappedRows(state.unmappedRows)] };
}

function unmappedRows(count: number) {
	return Array.from({ length: count }, (_, n) => ({
		transaction_id: `txn-synthetic-new-savings-${String(n)}`,
		account_id: newExternalId,
		amount: 10 + n,
		iso_currency_code: 'USD',
		date: '2026-08-20',
		name: `SAMPLE TRANSFER ${String(n)}`,
		original_description: `SAMPLE TRANSFER ${String(n)}`,
		merchant_name: null,
		pending: false,
		pending_transaction_id: null,
		category: ['Transfer']
	}));
}

function accountsRefusal(state: { accountsOutage: boolean; institutionDown: boolean }) {
	if (state.accountsOutage) return new Response('Service Unavailable', { status: 503 });
	if (!state.institutionDown) return null;
	return Response.json(
		{
			error_type: 'INSTITUTION_ERROR',
			error_code: 'INSTITUTION_NOT_RESPONDING',
			error_message: 'this institution is not currently responding',
			request_id: 'request-synthetic'
		},
		{ status: 400 }
	);
}

async function requestBody(init: RequestInit | undefined): Promise<unknown> {
	return await new Response(init?.body).json();
}

async function requestedKeyId(init: RequestInit | undefined) {
	const body = (await requestBody(init)) as { key_id?: unknown };
	return body.key_id;
}

function unknownKeyId() {
	return new Response(
		JSON.stringify({
			error_type: 'INVALID_INPUT',
			error_code: 'INVALID_WEBHOOK_VERIFICATION_KEY_ID',
			error_message: 'invalid key_id provided',
			request_id: 'request-synthetic'
		}),
		{ status: 400, headers: { 'content-type': 'application/json' } }
	);
}

let signer: Signer;
let plaid: ReturnType<typeof fakePlaid>;

beforeEach(async () => {
	vi.stubEnv('PLAID_CLIENT_ID', 'client-id-synthetic');
	vi.stubEnv('PLAID_SECRET', 'secret-synthetic-not-real');
	vi.stubEnv(
		'BUDGE_TOKEN_KEY',
		btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
	);
	signer = await webhookSigner();
	plaid = fakePlaid(signer);
	vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
		plaid.fetch(input, init)
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function connectedBudget() {
	const backend = await startBudget({ cutoverDate, accounts: { Checking: ['cash', 0] } });
	const { owner, t } = backend;
	const { Checking: checking } = backend.accounts;
	const { connectionId } = await t.action(internal.bankConnections.setup, {
		name: 'Sample Bank',
		itemId,
		accessToken,
		accounts: [{ externalId, accountId: checking }]
	});
	await cancelScheduled(backend);
	plaid.paths.length = 0;
	const rows = async () =>
		(
			await owner.query(api.transactions.list, {
				accountId: checking,
				paginationOpts: { numItems: 50, cursor: null }
			})
		).page.filter((row) => row.payeeName !== 'Starting Balance');
	return { ...backend, connectionId, rows };
}

async function connectAnotherItem({ owner, t }: Backend, otherItemId: string) {
	const savings = await owner.mutation(api.accounts.create, {
		name: 'Savings',
		kind: 'cash',
		startingBalance: 0
	});
	await t.action(internal.bankConnections.setup, {
		name: 'Other Sample Bank',
		itemId: otherItemId,
		accessToken: 'access-token-synthetic-other',
		accounts: [{ externalId: 'account-synthetic-savings', accountId: savings }]
	});
}

async function cancelScheduled({ t }: Backend) {
	await t.run(async (ctx) => {
		const jobs = await ctx.db.system.query('_scheduled_functions').collect();
		for (const job of jobs) {
			if (job.state.kind === 'pending') await ctx.scheduler.cancel(job._id);
		}
	});
}

type Backend = ReturnType<typeof newBackend>;

function postWebhook({ t }: Backend, body: string, token: string | null) {
	return t.fetch('/plaid/webhook', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(token === null ? {} : { 'plaid-verification': token })
		},
		body
	});
}

async function runScheduled({ t }: Backend) {
	vi.useFakeTimers();
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
	vi.useRealTimers();
}

const keyLookups = () =>
	plaid.paths.filter((path) => path === '/webhook_verification_key/get').length;

const scheduled = ({ t }: Backend) =>
	t.run(async (ctx) =>
		(await ctx.db.system.query('_scheduled_functions').collect()).filter(
			(job) => job.state.kind !== 'canceled'
		)
	);

describe('the Plaid webhook', () => {
	test('SYNC_UPDATES_AVAILABLE runs the sync', async () => {
		const backend = await connectedBudget();
		const body = syncUpdatesBody(itemId);

		const response = await postWebhook(backend, body, await signer.sign(body));
		expect(response.status).toBe(200);
		await runScheduled(backend);

		expect(await backend.rows()).toHaveLength(2);
		expect(plaid.paths).toEqual([
			'/webhook_verification_key/get',
			'/transactions/sync',
			'/item/get'
		]);
	});

	const itemBody = (code: string, errorCode?: string) =>
		JSON.stringify({
			webhook_type: 'ITEM',
			webhook_code: code,
			item_id: itemId,
			error: errorCode === undefined ? null : { error_code: errorCode },
			environment: 'sandbox'
		});

	const statusAfter = async (body: string) => {
		const backend = await connectedBudget();
		const response = await postWebhook(backend, body, await signer.sign(body));
		expect(response.status).toBe(200);
		const connection = await backend.t.run((ctx) =>
			ctx.db.get('bankConnections', backend.connectionId)
		);
		return connection?.status;
	};

	test.each([
		['PENDING_DISCONNECT', undefined],
		['PENDING_EXPIRATION', undefined],
		['USER_PERMISSION_REVOKED', undefined],
		['ERROR', 'ITEM_LOGIN_REQUIRED']
	])('ITEM %s %s pauses the Bank Connection until Reconnect', async (code, errorCode) => {
		expect(await statusAfter(itemBody(code, errorCode))).toBe('needsAttention');
	});

	test('an ITEM webhook nothing needs the owner for leaves the Bank Connection as it was', async () => {
		expect(await statusAfter(itemBody('WEBHOOK_UPDATE_ACKNOWLEDGED'))).toBe('ok');
		expect(await statusAfter(itemBody('ERROR', 'INSTITUTION_DOWN'))).toBe('ok');
	});

	test('an unverified webhook changes nothing', async () => {
		const backend = await connectedBudget();
		const body = syncUpdatesBody(itemId);
		const impostor = await webhookSigner();

		for (const token of [null, await impostor.sign(body)]) {
			const response = await postWebhook(backend, body, token);
			expect(response.status).toBe(401);
		}
		await runScheduled(backend);

		expect(await scheduled(backend)).toEqual([]);
		expect(await backend.rows()).toEqual([]);
		expect(plaid.paths).not.toContain('/transactions/sync');
	});

	test('two identical webhooks apply the batch once', async () => {
		const backend = await connectedBudget();
		const body = syncUpdatesBody(itemId);
		const token = await signer.sign(body);

		for (let i = 0; i < 2; i++) {
			expect((await postWebhook(backend, body, token)).status).toBe(200);
		}
		await runScheduled(backend);

		expect(await backend.rows()).toHaveLength(2);
	});

	test('asks Plaid for a key once, however many webhooks it signs', async () => {
		const backend = await connectedBudget();
		const body = syncUpdatesBody(itemId);

		for (let i = 0; i < 3; i++) {
			expect((await postWebhook(backend, body, await signer.sign(body))).status).toBe(200);
		}

		expect(keyLookups()).toBe(1);
	});

	test('asks Plaid about keys it has not seen at most once a minute for each Item, answering 429 with Retry-After so Plaid retries', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const backend = await connectedBudget();
		const body = syncUpdatesBody(itemId);
		const impostor = await webhookSigner();

		const statuses: number[] = [];
		for (let i = 0; i < 5; i++) {
			const token = await impostor.sign(body, { kid: `key-forged-${String(i)}` });
			statuses.push((await postWebhook(backend, body, token)).status);
		}
		expect(statuses).toEqual([401, 429, 429, 429, 429]);
		const limited = await postWebhook(backend, body, await signer.sign(body));
		expect(limited.status).toBe(429);
		expect(limited.headers.get('retry-after')).toBe('60');
		expect(keyLookups()).toBe(1);

		vi.setSystemTime(Date.now() + 61_000);
		expect((await postWebhook(backend, body, await signer.sign(body))).status).toBe(200);
		expect(keyLookups()).toBe(2);

		vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
		expect((await postWebhook(backend, body, await signer.sign(body))).status).toBe(200);
		const kids = await backend.t.run(async (ctx) =>
			(await ctx.db.query('webhookKeys').collect()).map((row) => row.kid)
		);
		expect(kids).toEqual(['key-synthetic-1']);
	});

	test('answers 429 with Retry-After while Plaid cannot serve the key, then accepts the retry', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const backend = await connectedBudget();
		const body = syncUpdatesBody(itemId);
		plaid.state.keyOutage = true;

		const deferred = await postWebhook(backend, body, await signer.sign(body));
		expect(deferred.status).toBe(429);
		expect(deferred.headers.get('retry-after')).toBe('60');

		plaid.state.keyOutage = false;
		vi.setSystemTime(Date.now() + 61_000);
		expect((await postWebhook(backend, body, await signer.sign(body))).status).toBe(200);
		expect(keyLookups()).toBe(2);
	});

	test('a flood of forged keys naming one Item does not hold up webhooks for another', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const backend = await connectedBudget();
		const otherItemId = 'item-synthetic-2';
		await connectAnotherItem(backend, otherItemId);
		await cancelScheduled(backend);
		const impostor = await webhookSigner();
		const forged = syncUpdatesBody(itemId);

		const statuses: number[] = [];
		for (let i = 0; i < 2; i++) {
			const token = await impostor.sign(forged, { kid: `key-forged-${String(i)}` });
			statuses.push((await postWebhook(backend, forged, token)).status);
		}
		expect(statuses).toEqual([401, 429]);

		const other = syncUpdatesBody(otherItemId);
		expect((await postWebhook(backend, other, await signer.sign(other))).status).toBe(200);
	});

	test('one forged key sent for two Items in turn still reaches Plaid at most once a minute for each Item', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const backend = await connectedBudget();
		const otherItemId = 'item-synthetic-2';
		await connectAnotherItem(backend, otherItemId);
		await cancelScheduled(backend);
		const impostor = await webhookSigner();
		const forgedFor = async (forItemId: string) => {
			const body = syncUpdatesBody(forItemId);
			const token = await impostor.sign(body, { kid: 'key-forged-shared' });
			return (await postWebhook(backend, body, token)).status;
		};

		const statuses: number[] = [];
		for (let i = 0; i < 3; i++) {
			statuses.push(await forgedFor(itemId), await forgedFor(otherItemId));
		}
		expect(statuses).toEqual([401, 401, 429, 429, 429, 429]);
		expect(keyLookups()).toBe(2);
	});

	async function webhookDuringHeldLease() {
		const backend = await connectedBudget();
		const lease = Date.now() + 60_000;
		await backend.t.run((ctx) =>
			ctx.db.patch('bankConnections', backend.connectionId, { syncLeaseUntil: lease })
		);
		const body = syncUpdatesBody(itemId);
		expect((await postWebhook(backend, body, await signer.sign(body))).status).toBe(200);
		await runScheduled(backend);
		expect(plaid.paths).not.toContain('/transactions/sync');
		return { ...backend, lease };
	}

	test('a webhook while a sync holds the lease syncs again once that sync finishes', async () => {
		const backend = await webhookDuringHeldLease();

		await backend.t.mutation(internal.bankConnections.apply, {
			connectionId: backend.connectionId,
			lease: backend.lease,
			fromCursor: null,
			nextCursor: 'cursor-synthetic-held',
			hasMore: false,
			rows: [],
			modified: [],
			removed: [],
			release: true,
			attentionNotices: 0
		});
		await runScheduled(backend);

		expect(await backend.rows()).toHaveLength(2);
	});

	test('a webhook while a sync holds the lease syncs again once that sync fails', async () => {
		const backend = await webhookDuringHeldLease();

		await backend.t.mutation(internal.bankConnections.fail, {
			connectionId: backend.connectionId,
			lease: backend.lease,
			message: 'Plaid refused the sync (INVALID_FIELD).',
			status: 'failed',
			attempt: 0
		});
		await runScheduled(backend);

		expect(await backend.rows()).toHaveLength(2);
	});

	test('a sync that finishes with no webhook waiting schedules nothing', async () => {
		const backend = await connectedBudget();

		await backend.t.action(internal.bankConnections.sync, { connectionId: backend.connectionId });

		expect(await scheduled(backend)).toEqual([]);
	});

	test('a webhook for an Item with no stored token returns at once', async () => {
		const backend = newBackend();
		await backend.t.mutation(internal.seed.run, {});
		const body = syncUpdatesBody(itemId);

		expect((await postWebhook(backend, body, await signer.sign(body))).status).toBe(200);

		expect(await scheduled(backend)).toEqual([]);
		expect(plaid.paths).toEqual([]);
	});

	test('a body that is not a Plaid webhook is refused', async () => {
		const backend = await connectedBudget();

		expect((await postWebhook(backend, 'not json', null)).status).toBe(400);
		expect(plaid.paths).toEqual([]);
	});
});

describe('a bank Account the owner adds at the bank', () => {
	const heldExternalIds = async ({ t }: Backend) =>
		(await t.run((ctx) => ctx.db.query('connectionAccounts').collect()))
			.filter((account) => account.state === 'held')
			.map((account) => account.externalId);

	const newAccountsBody = JSON.stringify({
		webhook_type: 'ITEM',
		webhook_code: 'NEW_ACCOUNTS_AVAILABLE',
		item_id: itemId,
		error: null,
		environment: 'sandbox'
	});
	const postNewAccounts = async (backend: Backend) => {
		const body = newAccountsBody;
		return await postWebhook(backend, body, await signer.sign(body));
	};

	test('NEW_ACCOUNTS_AVAILABLE holds it for the owner to map', async () => {
		const backend = await connectedBudget();

		const response = await postNewAccounts(backend);
		expect(response.status).toBe(200);
		await runScheduled(backend);

		expect(plaid.paths).toContain('/accounts/get');
		expect(await heldExternalIds(backend)).toEqual([newExternalId]);
	});

	test('NEW_ACCOUNTS_AVAILABLE while another sync holds the lease is looked into once it finishes', async () => {
		const backend = await connectedBudget();
		const lease = Date.now() + 60_000;
		await backend.t.run((ctx) =>
			ctx.db.patch('bankConnections', backend.connectionId, { syncLeaseUntil: lease })
		);
		expect((await postNewAccounts(backend)).status).toBe(200);
		await runScheduled(backend);
		expect(plaid.paths).not.toContain('/accounts/get');

		await backend.t.mutation(internal.bankConnections.apply, {
			connectionId: backend.connectionId,
			lease,
			fromCursor: null,
			nextCursor: 'cursor-synthetic-held',
			hasMore: false,
			rows: [],
			modified: [],
			removed: [],
			release: true,
			attentionNotices: 0
		});
		await runScheduled(backend);

		expect(await heldExternalIds(backend)).toEqual([newExternalId]);
	});

	test.each([
		{ answered: 50, held: 49 },
		{ answered: 51, held: 0 }
	])(
		'a bank answer of $answered Accounts is taken whole or not at all',
		async ({ answered, held }) => {
			const backend = await connectedBudget();
			plaid.state.moreAccounts = answered - 2;

			await postNewAccounts(backend);
			await runScheduled(backend);

			expect(plaid.paths).toContain('/accounts/get');
			expect(await heldExternalIds(backend)).toHaveLength(held);
		}
	);

	test('an answer Plaid gave before a newer request does not settle that request', async () => {
		const backend = await connectedBudget();
		const { t, connectionId } = backend;
		let releaseOlderAnswer: () => void = () => undefined;
		const release = new Promise<void>((resolve) => {
			releaseOlderAnswer = resolve;
		});
		const reached = new Promise<void>((resolve) => {
			plaid.state.heldAnswer = { reached: resolve, release };
		});
		const olderLook = t.action(internal.heldAccounts.discover, { connectionId });
		await reached;

		plaid.state.moreAccounts = 1;
		plaid.state.accountsOutage = true;
		await postNewAccounts(backend);
		await runScheduled(backend);
		plaid.state.accountsOutage = false;
		releaseOlderAnswer();
		await olderLook;
		expect(await heldExternalIds(backend)).toEqual([newExternalId]);
		plaid.paths.length = 0;

		await t.action(internal.bankConnections.sync, { connectionId });

		expect(plaid.paths).toContain('/accounts/get');
		expect(await heldExternalIds(backend)).toEqual([newExternalId, 'account-synthetic-more-0']);
	});

	test('a failed look at the Accounts is tried again on the next sync', async () => {
		const backend = await connectedBudget();
		plaid.state.accountsOutage = true;
		await postNewAccounts(backend);
		await runScheduled(backend);
		expect(await heldExternalIds(backend)).toEqual([]);
		plaid.state.accountsOutage = false;

		await backend.t.action(internal.bankConnections.sync, { connectionId: backend.connectionId });

		expect(await heldExternalIds(backend)).toEqual([newExternalId]);
	});

	test('once the Accounts are looked at, later syncs do not ask again', async () => {
		const backend = await connectedBudget();
		await postNewAccounts(backend);
		await runScheduled(backend);
		plaid.paths.length = 0;

		await backend.t.action(internal.bankConnections.sync, { connectionId: backend.connectionId });

		expect(plaid.paths).not.toContain('/accounts/get');
	});

	describe.each([
		{
			entry: 'Sync now',
			run: ({ owner, connectionId }: Awaited<ReturnType<typeof connectedBudget>>) =>
				owner.action(api.bankConnections.syncNow, { connectionId })
		},
		{
			entry: 'a sync after Reconnect',
			run: ({ owner, connectionId }: Awaited<ReturnType<typeof connectedBudget>>) =>
				owner.action(api.bankConnections.syncAfterReconnect, { connectionId })
		}
	])("$entry reports this run's counts, not a running total", ({ run }) => {
		test('the Transactions it added and the rows waiting for that Account, then zeros for a quiet run', async () => {
			const backend = await connectedBudget();
			plaid.state.unmappedRows = 3;

			expect(await run(backend)).toEqual({ kind: 'synced', added: 2, matched: 0, held: 3 });

			plaid.state.quiet = true;
			expect(await run(backend)).toEqual({ kind: 'synced', added: 0, matched: 0, held: 0 });
		});

		test('a row matching a Transaction the owner entered counts as matched, not added', async () => {
			const backend = await connectedBudget();
			await backend.owner.mutation(api.transactions.create, {
				accountId: backend.accounts.Checking,
				date: '2026-08-13',
				amount: -4_250,
				payee: 'Grocer',
				memo: 'weekly shop'
			});

			expect(await run(backend)).toEqual({ kind: 'synced', added: 1, matched: 1, held: 0 });
		});

		test('a run that only brings rows for that Account adds nothing and says they wait', async () => {
			const backend = await connectedBudget();
			plaid.state.onlyUnmapped = true;
			plaid.state.unmappedRows = 2;

			expect(await run(backend)).toEqual({ kind: 'synced', added: 0, matched: 0, held: 2 });
		});
	});

	test('a sync after Reconnect holds it for the owner to map', async () => {
		const backend = await connectedBudget();

		await backend.owner.action(api.bankConnections.syncAfterReconnect, {
			connectionId: backend.connectionId
		});

		expect(plaid.paths).toContain('/accounts/get');
		expect(await heldExternalIds(backend)).toEqual([newExternalId]);
	});
});

describe('setting up a Bank Connection', () => {
	test('syncs it at once, so an update Plaid sent before it was saved is not lost', async () => {
		const backend = await startBudget({ cutoverDate, accounts: { Checking: ['cash', 0] } });
		const { owner, t } = backend;
		const { Checking: checking } = backend.accounts;

		await t.action(internal.bankConnections.setup, {
			name: 'Sample Bank',
			itemId,
			accessToken,
			accounts: [{ externalId, accountId: checking }]
		});
		await runScheduled(backend);

		const { page } = await owner.query(api.transactions.list, {
			accountId: checking,
			paginationOpts: { numItems: 50, cursor: null }
		});
		expect(page.filter((row) => row.payeeName !== 'Starting Balance')).toHaveLength(2);
	});
});

describe('the daily sync', () => {
	test('syncs every Bank Connection with a token', async () => {
		const backend = await connectedBudget();

		await backend.t.mutation(internal.bankConnections.syncAll, {});
		await runScheduled(backend);

		expect(await backend.rows()).toHaveLength(2);
	});

	test('schedules a sync for every Bank Connection with a token, however many there are', async () => {
		const backend = newBackend();
		const connections = 45;
		await backend.t.run(async (ctx) => {
			for (let i = 0; i < connections; i++) {
				await ctx.db.insert('bankConnections', {
					name: `Bank ${String(i)}`,
					status: 'ok',
					provider: {
						kind: 'plaid',
						itemId: `item-synthetic-${String(i)}`,
						encryptedToken: 'sealed-token-synthetic'
					}
				});
			}
			await ctx.db.insert('bankConnections', {
				name: 'Sample Bank',
				status: 'ok',
				provider: { kind: 'sandbox' }
			});
		});

		await backend.t.mutation(internal.bankConnections.syncAll, {});
		await runScheduled(backend);

		const syncs = (await scheduled(backend)).filter((job) => job.name === 'bankConnections:sync');
		expect(
			new Set(syncs.map((job) => (job.args[0] as { connectionId: string }).connectionId)).size
		).toBe(connections);
	});

	test('on a server without a token key, records no failure on any Bank Connection', async () => {
		const backend = await connectedBudget();
		vi.stubEnv('BUDGE_TOKEN_KEY', undefined);

		await backend.t.mutation(internal.bankConnections.syncAll, {});
		await runScheduled(backend);

		const [connection] = await backend.owner.query(api.bankConnections.list, { now: Date.now() });
		expect(connection?.lastError).toBeNull();
	});

	test('makes no Plaid call for the seeded Bank Connection, which has no token', async () => {
		const backend = newBackend();
		await backend.t.mutation(internal.seed.run, {});

		await backend.t.mutation(internal.bankConnections.syncAll, {});
		await runScheduled(backend);

		expect(plaid.paths).toEqual([]);
	});
});

describe('connecting a bank from the app', () => {
	const linked = {
		publicToken: 'public-sandbox-synthetic',
		institutionName: 'Sample Credit Union'
	};

	test("links a new Item for transactions with Budge's webhook, then lists its bank accounts with a suggested kind", async () => {
		const { owner } = await startBudget({ cutoverDate });
		plaid.state.card = true;

		expect(await owner.action(api.bankConnections.connect, {})).toEqual({
			linkToken: 'link-sandbox-synthetic'
		});
		expect(plaid.bodies['/link/token/create']).toMatchObject({
			webhook: expect.stringMatching(/\/plaid\/webhook$/) as unknown
		});

		await owner.action(api.bankConnections.finishConnect, linked);
		expect(plaid.bodies['/item/public_token/exchange']).toMatchObject({
			public_token: linked.publicToken
		});
		const connections = await owner.query(api.bankConnections.list, { now: Date.now() });
		expect(connections.map(({ name, status }) => ({ name, status }))).toEqual([
			{ name: 'Sample Credit Union', status: 'ok' }
		]);
		const waiting = await owner.query(api.heldAccounts.list, {});
		expect(waiting.map(({ name, mask, kind }) => ({ name, mask, kind }))).toEqual([
			{ name: 'Sample Checking', mask: '0000', kind: 'cash' },
			{ name: 'Sample Savings', mask: '1111', kind: 'cash' },
			{ name: 'Sample Rewards Card', mask: '2222', kind: 'creditCard' }
		]);
	});

	test('lists the bank accounts on a later sync when the bank could not list them at connect', async () => {
		const backend = await startBudget({ cutoverDate });
		const { owner, t } = backend;
		plaid.state.quiet = true;
		plaid.state.institutionDown = true;
		await owner.action(api.bankConnections.finishConnect, linked);
		await runScheduled(backend);
		expect(await owner.query(api.heldAccounts.list, {})).toEqual([]);

		plaid.state.institutionDown = false;
		await t.mutation(internal.bankConnections.syncAll, {});
		await runScheduled(backend);

		const waiting = await owner.query(api.heldAccounts.list, {});
		expect(waiting.map(({ name }) => name)).toEqual(['Sample Checking', 'Sample Savings']);
	});

	async function fillConnections(t: Awaited<ReturnType<typeof startBudget>>['t'], count: number) {
		await t.run(async (ctx) => {
			for (let i = 0; i < count; i++) {
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
	}
	const full = {
		code: 'INVALID_INPUT',
		message: `Budge holds at most ${String(MAX_BANK_CONNECTIONS)} Bank Connections. Remove one first.`
	};

	test('at the Bank Connection limit, Connect a bank refuses before opening the bank', async () => {
		const { owner, t } = await startBudget({ cutoverDate });
		await fillConnections(t, MAX_BANK_CONNECTIONS);

		expect(await publicErrorOf(owner.action(api.bankConnections.connect, {}))).toEqual(full);
		expect(plaid.paths).toEqual([]);
	});

	test('a connect that finishes after the limit filled removes the Item it exchanged', async () => {
		const { owner, t } = await startBudget({ cutoverDate });
		await fillConnections(t, MAX_BANK_CONNECTIONS - 1);
		await owner.action(api.bankConnections.connect, {});
		await fillConnections(t, 1);

		expect(await publicErrorOf(owner.action(api.bankConnections.finishConnect, linked))).toEqual(
			full
		);
		expect(plaid.bodies['/item/remove']).toEqual({ access_token: accessToken });
		expect(
			await t.run(async (ctx) => (await ctx.db.query('bankConnections').collect()).length)
		).toBe(MAX_BANK_CONNECTIONS);
	});

	test('a bank with no institution name is saved as "Bank"', async () => {
		const { owner } = await startBudget({ cutoverDate });
		await owner.action(api.bankConnections.finishConnect, { publicToken: linked.publicToken });
		const [connection] = await owner.query(api.bankConnections.list, { now: Date.now() });
		expect(connection?.name).toBe('Bank');
	});

	test('before the cutover date is set, Connect a bank asks for it and calls no bank', async () => {
		const { owner } = newBackend();
		expect(await publicErrorOf(owner.action(api.bankConnections.connect, {}))).toEqual({
			code: 'INVALID_INPUT',
			message: 'Set the cutover date first.'
		});
		expect(plaid.paths).toEqual([]);
	});

	test.each(['PLAID_CLIENT_ID', 'PLAID_SECRET', 'BUDGE_TOKEN_KEY'])(
		'without %s, Budge says bank sync is not set up instead of blaming the bank',
		async (name) => {
			const { owner } = await startBudget({ cutoverDate });
			vi.stubEnv(name, undefined);
			expect(await owner.query(api.bankConnections.service, {})).toEqual({
				available: false,
				environment: 'sandbox'
			});
			expect(await publicErrorOf(owner.action(api.bankConnections.connect, {}))).toEqual({
				code: 'BANK_SYNC_UNAVAILABLE',
				message: "Bank sync isn't set up on this server."
			});
			expect(plaid.paths).toEqual([]);
		}
	);

	test.each(['PLAID_SECRET', 'BUDGE_TOKEN_KEY'])(
		'Sync now on a server without %s says bank sync is not set up, calls no bank and leaves the connection without a failure',
		async (name) => {
			const { owner, connectionId } = await connectedBudget();
			const called = plaid.paths.length;
			vi.stubEnv(name, undefined);
			expect(
				await publicErrorOf(owner.action(api.bankConnections.syncNow, { connectionId }))
			).toEqual({
				code: 'BANK_SYNC_UNAVAILABLE',
				message: "Bank sync isn't set up on this server."
			});
			expect(plaid.paths).toHaveLength(called);
			const [connection] = await owner.query(api.bankConnections.list, { now: Date.now() });
			expect(connection?.lastError).toBeNull();
		}
	);

	test('with credentials and a token key, bank sync is available', async () => {
		const { owner } = await startBudget({ cutoverDate });
		expect(await owner.query(api.bankConnections.service, {})).toEqual({
			available: true,
			environment: 'sandbox'
		});
	});
});
