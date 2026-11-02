// Signs webhooks the way Plaid does, under a key made up for each test. The bundler skips files
// with more than one dot, so this never deploys.

import { assert } from 'vitest';

import type { WebhookKey } from './plaidClient';

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

const encodeJson = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));

export async function sha256Hex(body: string): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(body)));
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface SignOptions {
	/** Seconds since the epoch; now by default. */
	iat?: number;
	alg?: string;
	kid?: string;
	/** The body hash to claim; the body's own by default. */
	bodyHash?: string;
}

/** A fresh ES256 key pair standing in for Plaid's, and a signer for webhook bodies. */
export async function webhookSigner(kid = 'key-synthetic-1') {
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	]);
	const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
	assert(jwk.x !== undefined && jwk.y !== undefined, 'expected an EC key');
	const key: WebhookKey = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, expiredAt: null };
	/** The key as `/webhook_verification_key/get` returns it. */
	const wireKey = {
		alg: 'ES256',
		crv: 'P-256',
		kid,
		kty: 'EC',
		use: 'sig',
		x: jwk.x,
		y: jwk.y,
		created_at: 1_700_000_000,
		expired_at: null
	};

	const sign = async (body: string, options: SignOptions = {}) => {
		const header = encodeJson({ alg: options.alg ?? 'ES256', kid: options.kid ?? kid, typ: 'JWT' });
		const payload = encodeJson({
			iat: options.iat ?? Math.floor(Date.now() / 1000),
			request_body_sha256: options.bodyHash ?? (await sha256Hex(body))
		});
		const signature = await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			pair.privateKey,
			encoder.encode(`${header}.${payload}`)
		);
		return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
	};

	return { kid, key, wireKey, sign };
}

/** A `SYNC_UPDATES_AVAILABLE` body for `itemId`, laid out as Plaid sends it. */
export function syncUpdatesBody(itemId: string): string {
	return JSON.stringify(
		{
			environment: 'sandbox',
			historical_update_complete: true,
			initial_update_complete: true,
			item_id: itemId,
			webhook_code: 'SYNC_UPDATES_AVAILABLE',
			webhook_type: 'TRANSACTIONS'
		},
		null,
		2
	);
}
