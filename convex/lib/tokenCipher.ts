import { Context, Effect, Layer, Schema } from 'effect';

export class TokenCipherError extends Schema.TaggedError<
	TokenCipherError,
	{ readonly brand: unique symbol }
>()('TokenCipherError', {}) {}

interface TokenCipherShape {
	readonly encrypt: (token: string, context: string) => Effect.Effect<string, TokenCipherError>;
	readonly decrypt: (sealed: string, context: string) => Effect.Effect<string, TokenCipherError>;
}

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class TokenCipher extends Context.Service<TokenCipher, TokenCipherShape>()(
	'budge/TokenCipher'
) {
	static layer(key: string | undefined): Layer.Layer<TokenCipher> {
		return Layer.succeed(TokenCipher, makeCipher(importKey(key)));
	}

	static readonly layerTest: Layer.Layer<TokenCipher> = Layer.suspend(() =>
		TokenCipher.layer(toBase64(crypto.getRandomValues(new Uint8Array(KEY_BYTES))))
	);
}

function importKey(key: string | undefined): Effect.Effect<CryptoKey, TokenCipherError> {
	return Effect.cached(
		Effect.gen(function* () {
			if (key === undefined) return yield* new TokenCipherError();
			const bytes = yield* fromBase64(key);
			if (bytes.length !== KEY_BYTES) return yield* new TokenCipherError();
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
				if (version !== VERSION || iv === undefined || data === undefined) {
					return yield* new TokenCipherError();
				}
				const ivBytes = yield* fromBase64(iv);
				const dataBytes = yield* fromBase64(data);
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

const attempt = <A>(run: () => PromiseLike<A>) =>
	Effect.tryPromise({ try: run, catch: () => new TokenCipherError() });

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Effect.Effect<Uint8Array<ArrayBuffer>, TokenCipherError> {
	return Effect.try({
		try: () => Uint8Array.from(atob(text), (char) => char.charCodeAt(0)),
		catch: () => new TokenCipherError()
	});
}
