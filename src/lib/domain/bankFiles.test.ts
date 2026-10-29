import { readFileSync } from 'node:fs';

import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';

import { decodeBankFile } from './bankFiles';

// Hand-written synthetic files that mirror only the banks' layouts.
const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const cutoverDate = '2026-08-01';

describe('decoding a bank file', () => {
	it.effect('reads a Capital One CSV, outflows negative, by header not column order', () =>
		Effect.gen(function* () {
			const file = yield* decodeBankFile(fixture('capital-one-checking.csv'), cutoverDate);

			expect(file.source).toBe('csv');
			expect(file.rows).toEqual([
				{ date: '2026-08-14', amount: -4_250, bankText: 'Debit Card Purchase - SAMPLE GROCER' },
				{ date: '2026-08-15', amount: 231_042, bankText: 'Deposit from SAMPLE PAYROLL, INC' },
				// A debit already written negative is still an outflow, never an inflow.
				{ date: '2026-08-16', amount: -450, bankText: 'Debit Card Purchase - SAMPLE COFFEE' },
				{ date: '2026-08-16', amount: -450, bankText: 'Debit Card Purchase - SAMPLE COFFEE' }
			]);
		})
	);

	it.effect('reads a Capital One card CSV as credit minus debit, by transaction date', () =>
		Effect.gen(function* () {
			const file = yield* decodeBankFile(fixture('capital-one-card.csv'), cutoverDate);

			expect(file.rows).toEqual([
				{ date: '2026-08-14', amount: -2_310, bankText: 'SAMPLE NOODLE BAR' },
				{ date: '2026-08-20', amount: 15_000, bankText: 'SAMPLE CARD PAYMENT' }
			]);
		})
	);

	it.effect('reads a Discover CSV with positive purchases as outflows and no ID', () =>
		Effect.gen(function* () {
			const file = yield* decodeBankFile(fixture('discover.csv'), cutoverDate);

			expect(file.source).toBe('csv');
			expect(file.rows).toEqual([
				{ date: '2026-08-14', amount: -1_825, bankText: 'SAMPLE TACO STAND' },
				{ date: '2026-08-18', amount: 20_000, bankText: 'SAMPLE PAYMENT - THANK YOU' }
			]);
		})
	);

	it.effect('reads a Capital One QFX with FITID as the import ID, posted rows only', () =>
		Effect.gen(function* () {
			const file = yield* decodeBankFile(fixture('capital-one-checking.qfx'), cutoverDate);

			expect(file.source).toBe('qfx');
			expect(file.rows).toEqual([
				{ date: '2026-08-14', amount: -4_250, bankText: 'SAMPLE GROCER', sourceId: 'DEMO-0001' },
				{
					date: '2026-08-15',
					amount: 231_042,
					bankText: 'SAMPLE PAYROLL & CO',
					sourceId: 'DEMO-0002'
				}
			]);
		})
	);

	it.effect('reads an XML QFX, dated by when the purchase was made', () =>
		Effect.gen(function* () {
			const file = yield* decodeBankFile(fixture('capital-one-card.qfx'), cutoverDate);

			expect(file.rows).toEqual([
				{
					date: '2026-08-14',
					amount: -2_310,
					bankText: 'SAMPLE NOODLE BAR',
					sourceId: 'DEMO-CARD-1'
				}
			]);
		})
	);

	it.effect.each([
		['an unknown layout', 'Date,Thing\n08/14/2026,1\n', 'not a Capital One or Discover'],
		[
			'a date that does not exist',
			'Trans. Date,Post Date,Description,Amount,Category\n02/30/2026,03/01/2026,SAMPLE,1.00,X\n',
			'Row 2'
		],
		[
			'an amount with fractions of a cent',
			'Trans. Date,Post Date,Description,Amount,Category\n08/14/2026,08/14/2026,SAMPLE,1.005,X\n',
			'Row 2'
		],
		['an empty file', '', 'not a Capital One or Discover']
	] as const)('refuses %s', ([, text, message]) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeBankFile(text, cutoverDate));

			expect(error._tag).toBe('BankFileError');
			expect(error.message).toContain(message);
		})
	);
});
