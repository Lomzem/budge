import { describe, expect, it } from '@effect/vitest';
import { Effect, Exit } from 'effect';

import { TokenCipher } from './tokenCipher';

const token = 'access-token-synthetic-not-real';

const freshKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

describe('TokenCipher', () => {
	it.effect('round-trips a token, storing only ciphertext with a fresh IV each time', () =>
		Effect.gen(function* () {
			const cipher = yield* TokenCipher;

			const sealed = yield* cipher.encrypt(token, 'item-synthetic-1');

			expect(sealed).not.toContain(token);
			expect(sealed).not.toContain(btoa(token));
			expect(yield* cipher.decrypt(sealed, 'item-synthetic-1')).toBe(token);
			const sealedAgain = yield* cipher.encrypt(token, 'item-synthetic-1');
			expect(sealedAgain).not.toBe(sealed);
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

	const flipFirstByte = (field: string) => {
		const bytes = Uint8Array.from(atob(field), (char) => char.charCodeAt(0));
		bytes[0] = (bytes[0] ?? 0) ^ 1;
		return btoa(String.fromCharCode(...bytes));
	};

	it.effect.each([
		{ corruption: 'an unknown version', corrupt: (iv: string, data: string) => `v2.${iv}.${data}` },
		{ corruption: 'no version', corrupt: (iv: string, data: string) => `${iv}.${data}` },
		{ corruption: 'no ciphertext', corrupt: (iv: string) => `v1.${iv}` },
		{ corruption: 'nothing at all', corrupt: () => '' },
		{
			corruption: 'an IV that is not base64',
			corrupt: (_: string, data: string) => `v1.%%.${data}`
		},
		{
			corruption: 'ciphertext that is not base64',
			corrupt: (iv: string, data: string) => `v1.${iv}.${data.slice(1)}!`
		},
		{
			corruption: 'an altered IV',
			corrupt: (iv: string, data: string) => `v1.${flipFirstByte(iv)}.${data}`
		},
		{
			corruption: 'altered ciphertext',
			corrupt: (iv: string, data: string) => `v1.${iv}.${flipFirstByte(data)}`
		},
		{
			corruption: 'ciphertext cut short',
			corrupt: (iv: string, data: string) => `v1.${iv}.${btoa(atob(data).slice(0, -1))}`
		}
	])('refuses a sealed token with $corruption, saying only that it cannot be read', ({ corrupt }) =>
		Effect.gen(function* () {
			const cipher = yield* TokenCipher;
			const [, iv = '', data = ''] = (yield* cipher.encrypt(token, 'item-synthetic-1')).split('.');
			const corrupted = corrupt(iv, data);

			const error = yield* Effect.flip(cipher.decrypt(corrupted, 'item-synthetic-1'));

			expect(error._tag).toBe('TokenCipherError');
			const told = `${String(error)} ${JSON.stringify(error)}`;
			expect(told).not.toContain(token);
			if (corrupted !== '') expect(told).not.toContain(corrupted);
		}).pipe(Effect.provide(TokenCipher.layerTest))
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
