import { describe, expect, it } from '@effect/vitest';
import { Effect, Exit } from 'effect';

import { TokenCipher } from './tokenCipher';

// Obviously fake: never a real access token.
const token = 'access-token-synthetic-not-real';

const freshKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

describe('TokenCipher', () => {
	it.effect('round-trips a token, storing only ciphertext', () =>
		Effect.gen(function* () {
			const cipher = yield* TokenCipher;

			const sealed = yield* cipher.encrypt(token, 'item-synthetic-1');

			expect(sealed).not.toContain(token);
			expect(sealed).not.toContain(btoa(token));
			expect(yield* cipher.decrypt(sealed, 'item-synthetic-1')).toBe(token);
			// A fresh IV each time, so the same token never encrypts the same way twice.
			expect(yield* cipher.encrypt(token, 'item-synthetic-1')).not.toBe(sealed);
		}).pipe(Effect.provide(TokenCipher.layerTest))
	);

	it.effect('refuses ciphertext sealed for another Item', () =>
		Effect.gen(function* () {
			const cipher = yield* TokenCipher;
			const sealed = yield* cipher.encrypt(token, 'item-synthetic-1');

			const error = yield* Effect.flip(cipher.decrypt(sealed, 'item-synthetic-2'));

			expect(error._tag).toBe('TokenCipherError');
			expect(JSON.stringify(error)).not.toContain(token);
		}).pipe(Effect.provide(TokenCipher.layerTest))
	);

	it.effect('refuses ciphertext sealed under another key', () =>
		Effect.gen(function* () {
			const sealed = yield* TokenCipher.use((cipher) =>
				cipher.encrypt(token, 'item-synthetic-1')
			).pipe(Effect.provide(TokenCipher.layer(freshKey())));

			const exit = yield* Effect.exit(
				TokenCipher.use((cipher) => cipher.decrypt(sealed, 'item-synthetic-1')).pipe(
					Effect.provide(TokenCipher.layer(freshKey()))
				)
			);

			expect(Exit.isFailure(exit)).toBe(true);
		})
	);

	it.effect('fails without a 32-byte key, never encrypting with a weak one', () =>
		Effect.gen(function* () {
			for (const key of [undefined, '', btoa('too short')]) {
				const error = yield* Effect.flip(
					TokenCipher.use((cipher) => cipher.encrypt(token, 'item-synthetic-1')).pipe(
						Effect.provide(TokenCipher.layer(key))
					)
				);
				expect(error._tag).toBe('TokenCipherError');
			}
		})
	);
});
