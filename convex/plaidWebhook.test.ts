import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';

import syncPage from '../src/lib/domain/fixtures/synthetic/plaid-sync-page.json';
import { api, internal } from './_generated/api';
import { syncUpdatesBody, webhookSigner } from './lib/plaidWebhook.helper';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

const accessToken = 'access-token-synthetic-not-real';
const itemId = 'item-synthetic-1';
const externalId = 'account-synthetic-checking';
const cutoverDate = '2026-08-01';

type Signer = Awaited<ReturnType<typeof webhookSigner>>;

function fakePlaid(signer: Signer) {
	const paths: string[] = [];
	const state = { keyOutage: false };
	const fetch = (input: RequestInfo | URL) => {
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
			case '/item/webhook/update':
				return answer({ item: { item_id: itemId } });
			case '/webhook_verification_key/get':
				return state.keyOutage
					? Promise.resolve(new Response('Service Unavailable', { status: 503 }))
					: answer({ key: signer.wireKey });
			case '/transactions/sync':
				return answer(syncPage);
			default:
				return assert.fail(`Unexpected Plaid call ${url.pathname}`);
		}
	};
	return { paths, state, fetch };
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
	vi.stubGlobal('fetch', (input: RequestInfo | URL) => plaid.fetch(input));
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function connectedBudget() {
	const backend = newBackend();
	const { owner, t } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate });
	const checking = await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 0
	});
	const connectionId = await t.action(internal.bankConnections.setup, {
		name: 'Sample Bank',
		itemId,
		accessToken,
		accounts: [{ externalId, accountId: checking }]
	});
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
	t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());

describe('the Plaid webhook', () => {
	test('SYNC_UPDATES_AVAILABLE runs the sync', async () => {
		const backend = await connectedBudget();
		const body = syncUpdatesBody(itemId);

		const response = await postWebhook(backend, body, await signer.sign(body));
		expect(response.status).toBe(200);
		await runScheduled(backend);

		expect(await backend.rows()).toHaveLength(2);
		expect(plaid.paths).toEqual(['/webhook_verification_key/get', '/transactions/sync']);
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

	test('asks Plaid about keys it has not seen at most once a minute, answering 429 with Retry-After so Plaid retries', async () => {
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
			release: true
		});
		await runScheduled(backend);

		expect(await backend.rows()).toHaveLength(2);
	});

	test('a webhook while a sync holds the lease syncs again once that sync fails', async () => {
		const backend = await webhookDuringHeldLease();

		await backend.t.mutation(internal.bankConnections.fail, {
			connectionId: backend.connectionId,
			lease: backend.lease,
			message: "Couldn't reach Plaid.",
			needsLogin: false
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

	test('makes no Plaid call for the seeded Bank Connection, which has no token', async () => {
		const backend = newBackend();
		await backend.t.mutation(internal.seed.run, {});

		await backend.t.mutation(internal.bankConnections.syncAll, {});
		await runScheduled(backend);

		expect(plaid.paths).toEqual([]);
	});
});
