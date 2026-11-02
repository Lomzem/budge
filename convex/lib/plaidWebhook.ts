import { v } from 'convex/values';
import { Context, Effect, Layer, Option, Result, Schema } from 'effect';

import { isRetryable, PlaidClient, type WebhookKey } from './plaidClient';

const TOKEN_REPLAY_WINDOW_SECONDS = 5 * 60;

export const KEY_TTL_MS = 24 * 60 * 60 * 1000;

export const KEY_LOOKUP_INTERVAL_MS = 60 * 1000;

export const webhookKeyValidator = v.object({
	kty: v.string(),
	crv: v.string(),
	x: v.string(),
	y: v.string(),
	expiredAt: v.union(v.number(), v.null())
});

export class KeyLookupDeferred extends Schema.TaggedError<
	KeyLookupDeferred,
	{ readonly brand: unique symbol }
>()('KeyLookupDeferred', {}) {}

export class WebhookKeys extends Context.Service<
	WebhookKeys,
	{
		readonly find: (kid: string) => Effect.Effect<Option.Option<WebhookKey>, KeyLookupDeferred>;
	}
>()('budge/WebhookKeys') {
	static readonly layerPlaid: Layer.Layer<WebhookKeys, never, PlaidClient> = Layer.effect(
		WebhookKeys,
		Effect.map(PlaidClient, (plaid) => ({
			find: (kid: string) => lookUpKey(plaid, kid)
		}))
	);
}

export function lookUpKey(
	plaid: PlaidClient['Service'],
	kid: string
): Effect.Effect<Option.Option<WebhookKey>, KeyLookupDeferred> {
	return plaid.webhookVerificationKey(kid).pipe(
		Effect.asSome,
		Effect.catch((error) =>
			isRetryable(error) ? Effect.fail(new KeyLookupDeferred()) : Effect.succeedNone
		)
	);
}

export interface Webhook {
	type: string;
	code: string;
	itemId: string;
}

export function readWebhook(body: Uint8Array): Webhook | null {
	const parsed = parseJson(new TextDecoder().decode(body));
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
	const {
		webhook_type: type,
		webhook_code: code,
		item_id: itemId
	} = parsed as Record<string, unknown>;
	if (typeof type !== 'string' || typeof code !== 'string' || typeof itemId !== 'string') {
		return null;
	}
	return { type, code, itemId };
}

export const verifyWebhook = Effect.fnUntraced(function* (input: {
	body: Uint8Array<ArrayBuffer>;
	token: string | null;
	now: number;
}): Effect.fn.Return<boolean, KeyLookupDeferred, WebhookKeys> {
	const token = readToken(input.token);
	if (token === null) return false;

	const key = yield* (yield* WebhookKeys).find(token.kid);
	if (Option.isNone(key)) return false;
	const { expiredAt } = key.value;
	if (expiredAt !== null && expiredAt * 1000 <= input.now) return false;
	if (!(yield* signedBy(key.value, token))) return false;

	if (Math.abs(input.now / 1000 - token.iat) > TOKEN_REPLAY_WINDOW_SECONDS) return false;
	const digest = yield* attempt(() => crypto.subtle.digest('SHA-256', input.body));
	if (digest === null) return false;
	return equalInConstantTime(toHex(new Uint8Array(digest)), token.bodyHash);
});

interface WebhookToken {
	kid: string;
	iat: number;
	bodyHash: string;
	signingInput: Uint8Array<ArrayBuffer>;
	signature: Uint8Array<ArrayBuffer>;
}

function readToken(token: string | null): WebhookToken | null {
	const parts = token?.split('.') ?? [];
	if (parts.length !== 3) return null;
	const [encodedHeader = '', encodedPayload = '', encodedSignature = ''] = parts;
	const header = decodeJsonPart(encodedHeader);
	if (header?.alg !== 'ES256' || typeof header.kid !== 'string') return null;
	const { iat, request_body_sha256: bodyHash } = decodeJsonPart(encodedPayload) ?? {};
	if (typeof iat !== 'number' || typeof bodyHash !== 'string') return null;
	const signature = fromBase64url(encodedSignature);
	if (signature === null) return null;
	const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
	return { kid: header.kid, iat, bodyHash, signingInput, signature };
}

function signedBy({ kty, crv, x, y }: WebhookKey, token: WebhookToken): Effect.Effect<boolean> {
	return attempt(async () => {
		const publicKey = await crypto.subtle.importKey(
			'jwk',
			{ kty, crv, x, y },
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify']
		);
		return await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			publicKey,
			token.signature,
			token.signingInput
		);
	}).pipe(Effect.map((signed) => signed === true));
}

function attempt<A>(run: () => Promise<A>): Effect.Effect<A | null> {
	return Effect.tryPromise(run).pipe(Effect.orElseSucceed(() => null));
}

function parseJson(text: string): unknown {
	return Result.getOrUndefined(Result.try(() => JSON.parse(text) as unknown));
}

function decodeJsonPart(part: string): Record<string, unknown> | null {
	const bytes = fromBase64url(part);
	if (bytes === null) return null;
	const parsed = parseJson(new TextDecoder().decode(bytes));
	return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
		? (parsed as Record<string, unknown>)
		: null;
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
	const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
	const decoded = Result.try(() => atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
	return Result.isSuccess(decoded)
		? Uint8Array.from(decoded.success, (c) => c.charCodeAt(0))
		: null;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equalInConstantTime(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return difference === 0;
}
