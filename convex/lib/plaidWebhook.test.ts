import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';

import {
	PlaidApi,
	PlaidClient,
	PlaidTimeout,
	PlaidTransport,
	type PlaidError,
	type WebhookKey
} from './plaidClient';
import { syncUpdatesBody, webhookSigner, type SignOptions } from './plaidWebhook.helper';
import { readWebhook, verifyWebhook, WebhookKeys } from './plaidWebhook';

const encoder = new TextEncoder();
const body = syncUpdatesBody('item-synthetic-1');

const verify = Effect.fnUntraced(function* (
	options: SignOptions & {
		token?: string | null;
		key?: (signer: WebhookKey) => Effect.Effect<WebhookKey, PlaidError>;
		received?: string;
	} = {}
) {
	const signer = yield* Effect.promise(() => webhookSigner());
	const token =
		options.token === undefined
			? yield* Effect.promise(() => signer.sign(body, options))
			: options.token;
	const asked: string[] = [];
	const verified = yield* verifyWebhook({
		body: encoder.encode(options.received ?? body),
		token,
		now: Date.now()
	}).pipe(
		Effect.provide(
			WebhookKeys.layerPlaid.pipe(
				Layer.provide(
					PlaidClient.layerTest({
						webhookVerificationKey: (kid) => {
							asked.push(kid);
							return options.key === undefined
								? Effect.succeed(signer.key)
								: options.key(signer.key);
						}
					})
				)
			)
		)
	);
	return { verified, asked };
});

describe('verifying a Plaid webhook', () => {
	it.effect('accepts a body Plaid signed, under the key its header names', () =>
		Effect.gen(function* () {
			expect(yield* verify()).toEqual({ verified: true, asked: ['key-synthetic-1'] });
		})
	);

	it.effect('rejects a request with no token, without asking Plaid for a key', () =>
		Effect.gen(function* () {
			expect(yield* verify({ token: null })).toEqual({ verified: false, asked: [] });
			expect(yield* verify({ token: 'not-a-jwt' })).toEqual({ verified: false, asked: [] });
		})
	);

	it.effect('rejects any algorithm but ES256', () =>
		Effect.gen(function* () {
			expect((yield* verify({ alg: 'HS256' })).verified).toBe(false);
			expect((yield* verify({ alg: 'none' })).verified).toBe(false);
		})
	);

	it.effect('rejects a body that was changed after signing', () =>
		Effect.gen(function* () {
			const changed = body.replace('item-synthetic-1', 'item-synthetic-2');
			expect((yield* verify({ received: changed })).verified).toBe(false);
			expect((yield* verify({ received: JSON.stringify(JSON.parse(body)) })).verified).toBe(false);
		})
	);

	it.effect('rejects a token issued more than five minutes ago', () =>
		Effect.gen(function* () {
			const now = Math.floor(Date.now() / 1000);
			expect((yield* verify({ iat: now - 4 * 60 })).verified).toBe(true);
			expect((yield* verify({ iat: now - 6 * 60 })).verified).toBe(false);
			expect((yield* verify({ iat: now + 6 * 60 })).verified).toBe(false);
		})
	);

	it.effect('rejects a signature from another key', () =>
		Effect.gen(function* () {
			const other = yield* Effect.promise(() => webhookSigner());
			expect((yield* verify({ key: () => Effect.succeed(other.key) })).verified).toBe(false);
		})
	);

	it.effect('rejects a key Plaid has expired', () =>
		Effect.gen(function* () {
			const expired = (key: WebhookKey) =>
				Effect.succeed({ ...key, expiredAt: Math.floor(Date.now() / 1000) - 60 });
			expect((yield* verify({ key: expired })).verified).toBe(false);
		})
	);

	it.effect('rejects when Plaid will not give the key', () =>
		Effect.gen(function* () {
			const refused = () =>
				Effect.fail(
					new PlaidApi({
						error_code: 'INVALID_INPUT',
						status: 400,
						request_id: 'request-synthetic'
					})
				);
			expect((yield* verify({ key: refused })).verified).toBe(false);
		})
	);

	it.effect('leaves the webhook undecided while Plaid is down, so Plaid sends it again', () =>
		Effect.gen(function* () {
			const outages: PlaidError[] = [
				new PlaidApi({ error_code: 'INTERNAL_SERVER_ERROR', status: 500, request_id: '' }),
				new PlaidApi({ error_code: 'RATE_LIMIT_EXCEEDED', status: 429, request_id: '' }),
				new PlaidTransport(),
				new PlaidTimeout()
			];
			for (const outage of outages) {
				const error = yield* Effect.flip(verify({ key: () => Effect.fail(outage) }));
				expect(error._tag).toBe('KeyLookupDeferred');
			}
		})
	);
});

describe('reading a Plaid webhook', () => {
	it('reads its type, code, and Item', () => {
		expect(readWebhook(encoder.encode(body))).toEqual({
			type: 'TRANSACTIONS',
			code: 'SYNC_UPDATES_AVAILABLE',
			itemId: 'item-synthetic-1',
			errorCode: null
		});
	});

	it("reads an ITEM ERROR's error code", () => {
		const itemError = JSON.stringify({
			webhook_type: 'ITEM',
			webhook_code: 'ERROR',
			item_id: 'item-synthetic-1',
			error: { error_code: 'ITEM_LOGIN_REQUIRED' }
		});
		expect(readWebhook(encoder.encode(itemError))).toEqual({
			type: 'ITEM',
			code: 'ERROR',
			itemId: 'item-synthetic-1',
			errorCode: 'ITEM_LOGIN_REQUIRED'
		});
	});

	it('refuses anything else', () => {
		expect(readWebhook(encoder.encode('not json'))).toBeNull();
		expect(readWebhook(encoder.encode('{"webhook_type":"TRANSACTIONS"}'))).toBeNull();
		expect(readWebhook(encoder.encode('[]'))).toBeNull();
	});
});
