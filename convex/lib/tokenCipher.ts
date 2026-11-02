import { Context, Effect, Layer, Schema } from 'effect';

/**
 * A token could not be sealed or opened. It carries nothing else, so neither the token nor the key
 * can reach a log or an error.
 */
export class TokenCipherError extends Schema.TaggedError<
	TokenCipherError,
	{ readonly brand: unique symbol }
>()('TokenCipherError', {}) {}

interface TokenCipherShape {
	/** Seals a token for storage. `context` (the Plaid Item ID) must match to open it again. */
	readonly encrypt: (token: string, context: string) => Effect.Effect<string, TokenCipherError>;
	readonly decrypt: (sealed: string, context: string) => Effect.Effect<string, TokenCipherError>;
}

// `v1.<IV>.<ciphertext and tag>`, both base64. The version leaves room to change the scheme.
const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Bank Connection tokens, sealed with AES-256-GCM under `BUDGE_TOKEN_KEY` (32 random bytes,
 * base64). Only the sealed form is ever stored.
 */
export class TokenCipher extends Context.Service<TokenCipher, TokenCipherShape>()(
	'budge/TokenCipher'
) {
	/** The cipher under a base64 key. A missing or short key fails each call; it never falls back. */
	static layer(key: string | undefined): Layer.Layer<TokenCipher> {
		return Layer.succeed(TokenCipher, makeCipher(importKey(key)));
	}

	/** The real cipher under a fresh random key, for tests. */
	static readonly layerTest: Layer.Layer<TokenCipher> = Layer.suspend(() =>
		TokenCipher.layer(toBase64(crypto.getRandomValues(new Uint8Array(KEY_BYTES))))
	);
}

function importKey(key: string | undefined): Effect.Effect<CryptoKey, TokenCipherError> {
	return Effect.cached(
		Effect.gen(function* () {
			const bytes = key === undefined ? undefined : fromBase64(key);
			if (bytes?.length !== KEY_BYTES) return yield* new TokenCipherError();
			return yield* attempt(() =>
				crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
			);
		})
	).pipe(Effect.runSync);
}

function makeCipher(key: Effect.Effect<CryptoKey, TokenCipherError>): TokenCipherShape {
	const encoder = new TextEncoder();
	return {
		encrypt: (token, context) =>
			Effect.gen(function* () {
				const cryptoKey = yield* key;
				const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
				const sealed = yield* attempt(() =>
					crypto.subtle.encrypt(
						{ name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
						cryptoKey,
						encoder.encode(token)
					)
				);
				return `${VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`;
			}),
		decrypt: (sealed, context) =>
			Effect.gen(function* () {
				const [version, iv, data] = sealed.split('.');
				const ivBytes = iv === undefined ? undefined : fromBase64(iv);
				const dataBytes = data === undefined ? undefined : fromBase64(data);
				if (version !== VERSION || ivBytes === undefined || dataBytes === undefined) {
					return yield* new TokenCipherError();
				}
				const cryptoKey = yield* key;
				const opened = yield* attempt(() =>
					crypto.subtle.decrypt(
						{ name: 'AES-GCM', iv: ivBytes, additionalData: encoder.encode(context) },
						cryptoKey,
						dataBytes
					)
				);
				return new TextDecoder().decode(opened);
			})
	};
}

// Web Crypto's errors are dropped rather than wrapped, so nothing about the key or data escapes.
const attempt = <A>(run: () => PromiseLike<A>) =>
	Effect.tryPromise({ try: run, catch: () => new TokenCipherError() });

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> | undefined {
	try {
		return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
	} catch {
		return undefined;
	}
}
