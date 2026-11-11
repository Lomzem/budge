import { readFileSync } from 'node:fs';

import { describe, expect, it } from '@effect/vitest';
import { Effect, Exit } from 'effect';

import { decodeAccounts, decodeSyncPage, syncRowsOf } from './plaid';

const page: unknown = JSON.parse(
	readFileSync(new URL('./fixtures/synthetic/plaid-sync-page.json', import.meta.url), 'utf8')
);

const accounts: unknown = JSON.parse(
	readFileSync(new URL('./fixtures/synthetic/plaid-accounts.json', import.meta.url), 'utf8')
);

describe('decoding a Plaid sync page', () => {
	it.effect(
		"keeps posted rows from the cutover date on, as signed cents with outflows negative, the original wording (else Plaid's name) as Bank Text, and the merchant naming the Payee",
		() =>
			Effect.gen(function* () {
				const decoded = yield* decodeSyncPage(page);

				expect(decoded.nextCursor).toBe('cursor-synthetic-2');
				expect(decoded.hasMore).toBe(false);
				expect(syncRowsOf(decoded, '2026-08-01')).toEqual({
					added: [
						{
							externalAccountId: 'account-synthetic-checking',
							sourceId: 'txn-synthetic-1',
							date: '2026-08-14',
							amount: -4_250,
							bankText: 'DEBIT CARD PURCHASE SAMPLE GROCER 0193',
							merchantName: 'Sample Grocer'
						},
						{
							externalAccountId: 'account-synthetic-checking',
							sourceId: 'txn-synthetic-2',
							date: '2026-08-15',
							amount: 231_042,
							bankText: 'SAMPLE PAYROLL'
						}
					],
					modified: [],
					removed: [
						{ externalAccountId: 'account-synthetic-checking', sourceId: 'txn-synthetic-0' }
					]
				});
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
				decodeSyncPage({
					added: [row],
					modified: [],
					removed: [],
					next_cursor: 'c',
					has_more: false
				})
			);

			expect(Exit.isFailure(exit)).toBe(true);
		})
	);

	it.effect(
		'keeps modified rows as Bank Rows, and removes every removed ID and every row the bank moved before the cutover date, with its Account',
		() =>
			Effect.gen(function* () {
				const base = (page as { added: object[] }).added;
				const decoded = yield* decodeSyncPage({
					added: [],
					modified: [{ ...base[0], amount: 45.5 }, base[2], base[3]],
					removed: [
						{ transaction_id: 'txn-synthetic-2', account_id: 'account-synthetic-checking' }
					],
					next_cursor: 'c',
					has_more: false
				});

				expect(syncRowsOf(decoded, '2026-08-01')).toEqual({
					added: [],
					modified: [
						{
							externalAccountId: 'account-synthetic-checking',
							sourceId: 'txn-synthetic-1',
							date: '2026-08-14',
							amount: -4_550,
							bankText: 'DEBIT CARD PURCHASE SAMPLE GROCER 0193',
							merchantName: 'Sample Grocer'
						}
					],
					removed: [
						{ externalAccountId: 'account-synthetic-checking', sourceId: 'txn-synthetic-2' },
						{ externalAccountId: 'account-synthetic-checking', sourceId: 'txn-synthetic-4' }
					]
				});
			})
	);
});

describe("decoding Plaid's Accounts", () => {
	it.effect(
		'reads each Account, its kind, and its current balance as a Budge balance in cents',
		() =>
			Effect.gen(function* () {
				expect(yield* decodeAccounts(accounts)).toEqual([
					{
						externalId: 'account-synthetic-checking',
						name: 'Sample Checking',
						mask: '0042',
						kind: 'cash',
						balance: 120_417
					},
					{
						externalId: 'account-synthetic-card',
						name: 'Sample Card',
						mask: '7310',
						kind: 'creditCard',
						balance: -89_990
					},
					{
						externalId: 'account-synthetic-savings',
						name: 'Sample Savings',
						kind: 'cash',
						balance: null
					},
					{
						externalId: 'account-synthetic-loan',
						name: 'Sample Car Loan',
						mask: '5521',
						kind: 'creditCard',
						balance: -1_250_000
					}
				]);
			})
	);

	it.effect('fails on a balance finer than a cent', () =>
		Effect.gen(function* () {
			const {
				accounts: [first, ...rest]
			} = accounts as { accounts: { balances: object }[] };
			const exit = yield* Effect.exit(
				decodeAccounts({
					...(accounts as object),
					accounts: [{ ...first, balances: { ...first?.balances, current: 1.005 } }, ...rest]
				})
			);

			expect(Exit.isFailure(exit)).toBe(true);
		})
	);

	it.effect('fails on a response without its Accounts', () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(decodeAccounts({ item: {} }));

			expect(Exit.isFailure(exit)).toBe(true);
		})
	);
});
