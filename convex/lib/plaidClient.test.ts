import { describe, expect, it } from '@effect/vitest';
import { Effect, Fiber, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { TestClock } from 'effect/testing';

import { PlaidClient } from './plaidClient';

// Obviously fake credentials and IDs: no test ever reaches Plaid.
const config = {
	clientId: 'client-id-synthetic',
	secret: 'secret-synthetic-not-real',
	environment: 'sandbox'
} as const;
const accessToken = 'access-token-synthetic-not-real';

interface Sent {
	url: string;
	headers: Record<string, string>;
	body: Record<string, unknown>;
}

/**
 * The live PlaidClient over a fake `fetch`, so its requests, retries, and timeouts run for real
 * without a network. `respond` answers each attempt in turn.
 */
function fakePlaid(respond: (attempt: number, signal: AbortSignal) => Promise<Response>) {
	const sent: Sent[] = [];
	const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		sent.push({
			url: input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
			headers: Object.fromEntries(new Headers(init?.headers).entries()),
			body: JSON.parse(new TextDecoder().decode(init?.body as Uint8Array)) as Record<
				string,
				unknown
			>
		});
		return await respond(sent.length, init?.signal ?? new AbortController().signal);
	};
	const layer = PlaidClient.layer(config).pipe(
		Layer.provide(FetchHttpClient.layer),
		Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))
	);
	return { sent, layer };
}

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const syncBody = {
	added: [],
	modified: [],
	removed: [],
	next_cursor: 'cursor-synthetic-1',
	has_more: false,
	request_id: 'request-synthetic-1'
};

const plaidError = (status: number, code: string) =>
	json(status, {
		error_type: 'ITEM_ERROR',
		error_code: code,
		error_message: `the login details of this item have changed for ${accessToken}`,
		display_message: null,
		request_id: 'request-synthetic-2'
	});

/** A `fetch` that never answers, until its request is aborted. */
const hang = (signal: AbortSignal) =>
	new Promise<Response>((_, reject) => {
		signal.addEventListener('abort', () => {
			reject(new Error(`aborted ${accessToken}`));
		});
	});

const sync = PlaidClient.use((plaid) =>
	plaid.transactionsSync({ accessToken, cursor: null, count: 100 })
);

describe('PlaidClient', () => {
	it.effect('posts to Plaid Sandbox with the credentials and decodes the page', () => {
		const plaid = fakePlaid(() => Promise.resolve(json(200, syncBody)));
		return Effect.gen(function* () {
			const page = yield* sync;

			expect(page).toEqual({ added: [], nextCursor: 'cursor-synthetic-1', hasMore: false });
			expect(plaid.sent).toHaveLength(1);
			const [request] = plaid.sent;
			expect(request?.url).toBe('https://sandbox.plaid.com/transactions/sync');
			expect(request?.headers['plaid-client-id']).toBe(config.clientId);
			expect(request?.headers['plaid-secret']).toBe(config.secret);
			// The first sync sends no cursor, and asks for the bank's original wording.
			expect(request?.body).toEqual({
				access_token: accessToken,
				count: 100,
				options: { include_original_description: true }
			});
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('retries a network failure, making at most three attempts', () => {
		const plaid = fakePlaid(() => Promise.reject(new Error(`connection reset ${accessToken}`)));
		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(Effect.flip(sync));
			yield* TestClock.adjust('1 minute');
			const error = yield* Fiber.join(fiber);

			expect(error._tag).toBe('PlaidTransport');
			expect(plaid.sent).toHaveLength(3);
			// Errors never carry the request, the token, or the underlying cause.
			expect(JSON.stringify(error)).not.toContain(accessToken);
			expect(String(error)).not.toContain(accessToken);
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('succeeds when a retry gets through', () => {
		const plaid = fakePlaid((attempt) =>
			attempt < 3
				? Promise.resolve(plaidError(500, 'INTERNAL_SERVER_ERROR'))
				: Promise.resolve(json(200, syncBody))
		);
		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(sync);
			yield* TestClock.adjust('1 minute');
			const page = yield* Fiber.join(fiber);

			expect(page.nextCursor).toBe('cursor-synthetic-1');
			expect(plaid.sent).toHaveLength(3);
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('gives each attempt 10 seconds and the whole call 35', () => {
		const plaid = fakePlaid((_, signal) => hang(signal));
		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(Effect.flip(sync));
			yield* TestClock.adjust('10 seconds');
			expect(plaid.sent).toHaveLength(1);
			// The first attempt times out at 10 seconds, and the second starts after a short backoff.
			yield* TestClock.adjust('5 seconds');
			expect(plaid.sent).toHaveLength(2);
			yield* TestClock.adjust('15 seconds');
			expect(plaid.sent).toHaveLength(3);
			yield* TestClock.adjust('4 seconds');
			expect(fiber.pollUnsafe()).toBeUndefined();
			yield* TestClock.adjust('1 second');
			const error = yield* Fiber.join(fiber);

			expect(error._tag).toBe('PlaidTimeout');
			expect(plaid.sent).toHaveLength(3);
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect("reports Plaid's error code, status, and request ID, without retrying", () => {
		const plaid = fakePlaid(() => Promise.resolve(plaidError(400, 'ITEM_LOGIN_REQUIRED')));
		return Effect.gen(function* () {
			const error = yield* Effect.flip(sync);

			expect(error).toMatchObject({
				_tag: 'PlaidApi',
				error_code: 'ITEM_LOGIN_REQUIRED',
				status: 400,
				request_id: 'request-synthetic-2'
			});
			expect(plaid.sent).toHaveLength(1);
			// Plaid's message can quote the request, so it is never kept.
			expect(JSON.stringify(error)).not.toContain(accessToken);
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('fails a response it cannot read without retrying or keeping the body', () => {
		const plaid = fakePlaid(() =>
			Promise.resolve(json(200, { added: [{ account_id: accessToken }], has_more: 'yes' }))
		);
		return Effect.gen(function* () {
			const error = yield* Effect.flip(sync);

			expect(error._tag).toBe('PlaidDecode');
			expect(plaid.sent).toHaveLength(1);
			expect(JSON.stringify(error)).not.toContain(accessToken);
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('asks Plaid to refresh, and points the Item webhook at Budge', () => {
		const plaid = fakePlaid(() =>
			Promise.resolve(json(200, { request_id: 'request-synthetic-3' }))
		);
		return Effect.gen(function* () {
			const client = yield* PlaidClient;
			yield* client.transactionsRefresh(accessToken);
			yield* client.setWebhook(accessToken, 'https://example.invalid/plaid/webhook');

			expect(plaid.sent.map(({ url, body }) => [url, body])).toEqual([
				['https://sandbox.plaid.com/transactions/refresh', { access_token: accessToken }],
				[
					'https://sandbox.plaid.com/item/webhook/update',
					{ access_token: accessToken, webhook: 'https://example.invalid/plaid/webhook' }
				]
			]);
		}).pipe(Effect.provide(plaid.layer));
	});
});
