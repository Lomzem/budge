import { readFileSync } from 'node:fs';

import { describe, expect, it } from '@effect/vitest';
import { Effect, Exit } from 'effect';

import { decodeSyncPage, syncRowsOf } from './plaid';

// A hand-written synthetic response that mirrors only the shape of Plaid's `/transactions/sync`.
const page: unknown = JSON.parse(
	readFileSync(new URL('./fixtures/synthetic/plaid-sync-page.json', import.meta.url), 'utf8')
);

describe('decoding a Plaid sync page', () => {
	it.effect('keeps posted rows from the cutover date on, as signed cents', () =>
		Effect.gen(function* () {
			const decoded = yield* decodeSyncPage(page);

			expect(decoded.nextCursor).toBe('cursor-synthetic-2');
			expect(decoded.hasMore).toBe(false);
			expect(syncRowsOf(decoded, '2026-08-01')).toEqual([
				// Plaid writes outflows positive; Budge writes them negative. The original bank wording
				// is the Bank Text, and the merchant name names the Payee.
				{
					externalAccountId: 'account-synthetic-checking',
					sourceId: 'txn-synthetic-1',
					date: '2026-08-14',
					amount: -4_250,
					bankText: 'DEBIT CARD PURCHASE SAMPLE GROCER 0193',
					merchantName: 'Sample Grocer'
				},
				// Without an original description, Plaid's name is the Bank Text.
				{
					externalAccountId: 'account-synthetic-checking',
					sourceId: 'txn-synthetic-2',
					date: '2026-08-15',
					amount: 231_042,
					bankText: 'SAMPLE PAYROLL'
				}
			]);
		})
	);

	it.effect('fails on a response without the fields sync needs', () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeSyncPage({ added: [], has_more: false }));

			expect(Exit.isFailure(exit)).toBe(true);
		})
	);

	it.effect('fails on an amount finer than a cent', () =>
		Effect.gen(function* () {
			const row = { ...(page as { added: object[] }).added[0], amount: 1.005 };
			const exit = yield* Effect.exit(
				decodeSyncPage({ added: [row], next_cursor: 'c', has_more: false })
			);

			expect(Exit.isFailure(exit)).toBe(true);
		})
	);
});
