import { describe, expect, it } from '@effect/vitest';
import { Effect, Fiber, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { TestClock } from 'effect/testing';

import { PlaidClient, type PlaidConfig } from './plaidClient';

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

function urlOf(input: RequestInfo | URL) {
	if (input instanceof URL) return input.href;
	return typeof input === 'string' ? input : input.url;
}

function fakePlaid(
	respond: (attempt: number, signal: AbortSignal) => Promise<Response>,
	plaidConfig: PlaidConfig = config
) {
	const sent: Sent[] = [];
	const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		sent.push({
			url: urlOf(input),
			headers: Object.fromEntries(new Headers(init?.headers).entries()),
			body: JSON.parse(new TextDecoder().decode(init?.body as Uint8Array)) as Record<
				string,
				unknown
			>
		});
		return await respond(sent.length, init?.signal ?? new AbortController().signal);
	};
	const layer = PlaidClient.layer(plaidConfig).pipe(
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
	it.effect(
		"posts the first sync to Plaid Sandbox with the credentials, no cursor, and the bank's original wording asked for, and decodes the page",
		() => {
			const plaid = fakePlaid(() => Promise.resolve(json(200, syncBody)));
			return Effect.gen(function* () {
				const page = yield* sync;

				expect(page).toEqual({
					added: [],
					modified: [],
					removed: [],
					nextCursor: 'cursor-synthetic-1',
					hasMore: false
				});
				expect(plaid.sent).toHaveLength(1);
				const [request] = plaid.sent;
				expect(request?.url).toBe('https://sandbox.plaid.com/transactions/sync');
				expect(request?.headers['plaid-client-id']).toBe(config.clientId);
				expect(request?.headers['plaid-secret']).toBe(config.secret);
				expect(request?.body).toEqual({
					access_token: accessToken,
					count: 100,
					options: { include_original_description: true }
				});
			}).pipe(Effect.provide(plaid.layer));
		}
	);

	it.effect("reads when the bank's consent ends from the Item", () => {
		const item = (consent: string | null) =>
			json(200, {
				item: { item_id: 'item-synthetic-1', consent_expiration_time: consent, error: null },
				status: null,
				request_id: 'request-synthetic-1'
			});
		const plaid = fakePlaid((attempt) =>
			Promise.resolve(item(attempt === 1 ? '2026-11-20T15:00:00Z' : null))
		);
		const itemGet = PlaidClient.use((client) => client.itemGet(accessToken));
		return Effect.gen(function* () {
			expect(yield* itemGet).toEqual({ consentExpiresAt: Date.UTC(2026, 10, 20, 15) });
			expect(yield* itemGet).toEqual({ consentExpiresAt: null });
			expect(plaid.sent[0]?.url).toBe('https://sandbox.plaid.com/item/get');
			expect(plaid.sent[0]?.body).toEqual({ access_token: accessToken });
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('asks for an update-mode Link token with the access token and no products', () => {
		const plaid = fakePlaid(() =>
			Promise.resolve(
				json(200, {
					link_token: 'link-token-synthetic-1',
					expiration: '2026-11-02T04:00:00Z',
					request_id: 'request-synthetic-1'
				})
			)
		);
		return Effect.gen(function* () {
			const token = yield* PlaidClient.use((client) =>
				client.linkTokenCreate({
					mode: 'update',
					accessToken,
					clientUserId: 'connection-synthetic-1'
				})
			);

			expect(token).toBe('link-token-synthetic-1');
			expect(plaid.sent[0]?.url).toBe('https://sandbox.plaid.com/link/token/create');
			expect(plaid.sent[0]?.body).toEqual({
				access_token: accessToken,
				client_name: 'Budge',
				language: 'en',
				country_codes: ['US'],
				user: { client_user_id: 'connection-synthetic-1' }
			});
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect(
		"asks for a create-mode Link token for transactions, with Budge's webhook and no Item",
		() => {
			const plaid = fakePlaid(() =>
				Promise.resolve(
					json(200, { link_token: 'link-token-synthetic-2', request_id: 'request-synthetic-2' })
				)
			);
			return Effect.gen(function* () {
				const token = yield* PlaidClient.use((client) =>
					client.linkTokenCreate({
						mode: 'create',
						webhook: 'https://budge.example.test/plaid/webhook',
						clientUserId: 'budge-owner'
					})
				);

				expect(token).toBe('link-token-synthetic-2');
				expect(plaid.sent[0]?.body).toEqual({
					client_name: 'Budge',
					language: 'en',
					country_codes: ['US'],
					user: { client_user_id: 'budge-owner' },
					products: ['transactions'],
					webhook: 'https://budge.example.test/plaid/webhook'
				});
			}).pipe(Effect.provide(plaid.layer));
		}
	);

	it.effect("exchanges a public token for the Item's access token and id", () => {
		const plaid = fakePlaid(() =>
			Promise.resolve(
				json(200, {
					access_token: accessToken,
					item_id: 'item-synthetic-9',
					request_id: 'request-synthetic-3'
				})
			)
		);
		return Effect.gen(function* () {
			const item = yield* PlaidClient.use((client) =>
				client.publicTokenExchange('public-token-synthetic-1')
			);

			expect(item).toEqual({ accessToken, itemId: 'item-synthetic-9' });
			expect(plaid.sent[0]?.url).toBe('https://sandbox.plaid.com/item/public_token/exchange');
			expect(plaid.sent[0]?.body).toEqual({ public_token: 'public-token-synthetic-1' });
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('never retries a public token exchange, which Plaid honors only once', () => {
		const plaid = fakePlaid(() => Promise.resolve(plaidError(500, 'INTERNAL_SERVER_ERROR')));
		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(
				Effect.flip(
					PlaidClient.use((client) => client.publicTokenExchange('public-token-synthetic-1'))
				)
			);
			yield* TestClock.adjust('1 minute');
			const error = yield* Fiber.join(fiber);

			expect(error._tag).toBe('PlaidApi');
			expect(plaid.sent).toHaveLength(1);
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect(
		'retries a network failure, making at most three attempts, with no request, token, or cause in the error',
		() => {
			const plaid = fakePlaid(() => Promise.reject(new Error(`connection reset ${accessToken}`)));
			return Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(Effect.flip(sync));
				yield* TestClock.adjust('1 minute');
				const error = yield* Fiber.join(fiber);

				expect(error._tag).toBe('PlaidTransport');
				expect(plaid.sent).toHaveLength(3);
				expect(JSON.stringify(error)).not.toContain(accessToken);
				expect(String(error)).not.toContain(accessToken);
			}).pipe(Effect.provide(plaid.layer));
		}
	);

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
			const shortBackoffAfterTheFirstTimeout = '5 seconds';
			yield* TestClock.adjust(shortBackoffAfterTheFirstTimeout);
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

	it.effect(
		"reports Plaid's error code, status, and request ID, without retrying or keeping Plaid's message, which can quote the request",
		() => {
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
				expect(JSON.stringify(error)).not.toContain(accessToken);
			}).pipe(Effect.provide(plaid.layer));
		}
	);

	it.effect("retries Plaid's outage even when its body isn't JSON", () => {
		const plaid = fakePlaid(() =>
			Promise.resolve(new Response('<html>Service Unavailable</html>', { status: 503 }))
		);
		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(Effect.flip(sync));
			yield* TestClock.adjust('1 minute');
			const error = yield* Fiber.join(fiber);

			expect(error).toMatchObject({ _tag: 'PlaidApi', error_code: 'HTTP_503', status: 503 });
			expect(plaid.sent).toHaveLength(3);
		}).pipe(Effect.provide(plaid.layer));
	});

	it.effect('fails with a typed error, sending nothing, when the credentials are not set', () => {
		const plaid = fakePlaid(() => Promise.resolve(json(200, syncBody)), {
			...config,
			secret: undefined
		});
		return Effect.gen(function* () {
			const error = yield* Effect.flip(sync);

			expect(error._tag).toBe('PlaidTransport');
			expect(plaid.sent).toHaveLength(0);
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

	it.effect(
		'looks up a webhook key in one attempt of at most five seconds, since Plaid sends a webhook answered 429 again',
		() => {
			const plaid = fakePlaid((_, signal) => hang(signal));
			return Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					Effect.flip(PlaidClient.use((client) => client.webhookVerificationKey('key-synthetic-1')))
				);
				yield* TestClock.adjust('5 seconds');
				const error = yield* Fiber.join(fiber);

				expect(error._tag).toBe('PlaidTimeout');
				expect(plaid.sent).toHaveLength(1);
			}).pipe(Effect.provide(plaid.layer));
		}
	);

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

	it.effect("reads the Item's Accounts, optionally only some", () => {
		const plaid = fakePlaid(() =>
			Promise.resolve(
				json(200, {
					accounts: [
						{
							account_id: 'account-synthetic-card',
							balances: { available: null, current: 12.5, limit: 500 },
							mask: '7310',
							name: 'Sample Card',
							official_name: null,
							subtype: 'credit card',
							type: 'credit'
						}
					],
					item: { item_id: 'item-synthetic-1' },
					request_id: 'request-synthetic-4'
				})
			)
		);
		return Effect.gen(function* () {
			const client = yield* PlaidClient;
			yield* client.accountsGet(accessToken);
			const accounts = yield* client.accountsGet(accessToken, ['account-synthetic-card']);

			expect(accounts).toEqual([
				{
					externalId: 'account-synthetic-card',
					name: 'Sample Card',
					mask: '7310',
					kind: 'creditCard',
					balance: -1_250
				}
			]);
			expect(plaid.sent.map(({ url, body }) => [url, body])).toEqual([
				['https://sandbox.plaid.com/accounts/get', { access_token: accessToken }],
				[
					'https://sandbox.plaid.com/accounts/get',
					{ access_token: accessToken, options: { account_ids: ['account-synthetic-card'] } }
				]
			]);
		}).pipe(Effect.provide(plaid.layer));
	});
});
