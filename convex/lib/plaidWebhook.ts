// Plaid webhooks: reading one, and checking Plaid signed it. Plaid signs each webhook with an ES256
// JWT in the `Plaid-Verification` header, whose payload holds the SHA-256 of the exact body bytes.
// https://plaid.com/docs/api/webhooks/webhook-verification/

import { Effect, Option } from 'effect';

import { PlaidClient } from './plaidClient';

/** How old a webhook's token may be, either way, before it is refused as a replay. */
const MAX_AGE_SECONDS = 5 * 60;

export interface Webhook {
	type: string;
	code: string;
	itemId: string;
}

/** The webhook's type, code, and Item; `null` for a body that isn't a Plaid Item webhook. */
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

/**
 * Whether Plaid signed `body`: the token names an ES256 key Plaid still uses, its signature holds
 * under that key, it was issued within five minutes of `now`, and it carries the body's hash. Any
 * failure, including Plaid not giving the key, is a refusal.
 */
export const verifyWebhook = Effect.fnUntraced(function* (input: {
	body: Uint8Array<ArrayBuffer>;
	token: string | null;
	/** Milliseconds since the epoch. */
	now: number;
}): Effect.fn.Return<boolean, never, PlaidClient> {
	const parts = input.token?.split('.') ?? [];
	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	if (
		parts.length !== 3 ||
		encodedHeader === undefined ||
		encodedPayload === undefined ||
		encodedSignature === undefined
	) {
		return false;
	}
	const header = decodeJsonPart(encodedHeader);
	if (header?.alg !== 'ES256' || typeof header.kid !== 'string') return false;

	const plaid = yield* PlaidClient;
	const key = yield* Effect.option(plaid.webhookVerificationKey(header.kid));
	if (Option.isNone(key)) return false;
	const { kty, crv, x, y, expiredAt } = key.value;
	if (expiredAt !== null && expiredAt * 1000 <= input.now) return false;

	const signature = fromBase64url(encodedSignature);
	if (signature === null) return false;
	const signed = yield* attempt(async () => {
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
			signature,
			new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
		);
	});
	if (signed !== true) return false;

	const payload = decodeJsonPart(encodedPayload);
	const { iat, request_body_sha256: bodyHash } = payload ?? {};
	if (typeof iat !== 'number' || typeof bodyHash !== 'string') return false;
	if (Math.abs(input.now / 1000 - iat) > MAX_AGE_SECONDS) return false;
	const digest = yield* attempt(() => crypto.subtle.digest('SHA-256', input.body));
	if (digest === null) return false;
	return equalInConstantTime(toHex(new Uint8Array(digest)), bodyHash);
});

/** A WebCrypto call; a failure becomes `null`. */
function attempt<A>(run: () => Promise<A>): Effect.Effect<A | null> {
	return Effect.tryPromise(run).pipe(Effect.orElseSucceed(() => null));
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
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
	try {
		return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) =>
			c.charCodeAt(0)
		);
	} catch {
		return null;
	}
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Compares two strings without stopping at the first difference. */
function equalInConstantTime(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return difference === 0;
}
