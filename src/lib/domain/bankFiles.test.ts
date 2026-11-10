import { readFileSync } from 'node:fs';

import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';

import { decodeBankFile } from './bankFiles';

const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/synthetic/${name}`, import.meta.url), 'utf8');

const cutoverDate = '2026-08-01';

describe('decoding a bank file', () => {
	it.effect(
		'reads a Capital One CSV by header not column order, outflows negative even when a debit is already written negative',
		() =>
			Effect.gen(function* () {
				const file = yield* decodeBankFile(fixture('capital-one-checking.csv'), cutoverDate);

				expect(file.source).toBe('csv');
				expect(file.rows).toEqual([
					{ date: '2026-08-14', amount: -4_250, bankText: 'Debit Card Purchase - SAMPLE GROCER' },
					{ date: '2026-08-15', amount: 231_042, bankText: 'Deposit from SAMPLE PAYROLL, INC' },
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

	it.effect('keeps a character reference past Unicode as written', () =>
		Effect.gen(function* () {
			const text = fixture('capital-one-checking.qfx').replace(
				'SAMPLE GROCER',
				'SAMPLE &#x110000; GROCER &#99999999;'
			);

			const file = yield* decodeBankFile(text, cutoverDate);

			expect(file.rows[0]?.bankText).toBe('SAMPLE &#x110000; GROCER &#99999999;');
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
		[
			'a byte order mark',
			'﻿Trans. Date,Post Date,Description,Amount,Category\n08/14/2026,08/15/2026,SAMPLE TACO STAND,18.25,Restaurants\n'
		],
		[
			'CRLF line endings',
			'Trans. Date,Post Date,Description,Amount,Category\r\n08/14/2026,08/15/2026,SAMPLE TACO STAND,18.25,Restaurants\r\n'
		],
		[
			'trailing blank lines',
			'Trans. Date,Post Date,Description,Amount,Category\n08/14/2026,08/15/2026,SAMPLE TACO STAND,18.25,Restaurants\n\n,,,,\n\n'
		],
		[
			'blank columns after the last header',
			'Trans. Date,Post Date,Description,Amount,Category,,\n08/14/2026,08/15/2026,SAMPLE TACO STAND,18.25,Restaurants,,\n'
		]
	] as const)('reads a Discover CSV with %s', ([, text]) =>
		Effect.gen(function* () {
			const file = yield* decodeBankFile(text, cutoverDate);

			expect(file.rows).toEqual([
				{ date: '2026-08-14', amount: -1_825, bankText: 'SAMPLE TACO STAND' }
			]);
		})
	);

	it.effect('reads a quote inside an unquoted Description as part of the text', () =>
		Effect.gen(function* () {
			const file = yield* decodeBankFile(
				'Trans. Date,Post Date,Description,Amount,Category\n08/14/2026,08/15/2026,SAMPLE 12" PIZZA,18.25,Restaurants\n08/16/2026,08/16/2026,SAMPLE BAKERY,4.50,Restaurants\n',
				cutoverDate
			);

			expect(file.rows).toEqual([
				{ date: '2026-08-14', amount: -1_825, bankText: 'SAMPLE 12" PIZZA' },
				{ date: '2026-08-16', amount: -450, bankText: 'SAMPLE BAKERY' }
			]);
		})
	);

	it.effect.each([
		[
			'an unknown layout, naming the columns it found',
			'Date,Thing\n08/14/2026,1\n',
			'not a Capital One or Discover CSV, or a QFX file. Its columns are “Date”, “Thing”.'
		],
		[
			'an unknown layout with many columns, naming six and counting the rest',
			'A,B,C,D,E,F,G,H\n1,2,3,4,5,6,7,8\n',
			'Its columns are “A”, “B”, “C”, “D”, “E”, “F” and 2 more. Download'
		],
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
		[
			'an empty file',
			'',
			'not a Capital One or Discover CSV, or a QFX file. It has no column names.'
		],
		[
			'a quote that never closes',
			'Trans. Date,Post Date,Description,Amount,Category\n08/14/2026,08/15/2026,SAMPLE TACO STAND,18.25,"Restaurants\n08/18/2026,08/18/2026,SAMPLE PAYMENT,-200.00,Payments\n',
			'Row 2 opens a quote'
		],
		[
			'text after a closing quote',
			'Trans. Date,Post Date,Description,Amount,Category\n08/14/2026,08/15/2026,"SAMPLE TACO"STAND,18.25,Restaurants\n',
			'Row 2 has text after a closing quote'
		],
		[
			'a header that names a column twice',
			'Trans. Date,Post Date,Description,Amount, Amount\n08/14/2026,08/15/2026,SAMPLE TACO STAND,18.25,99.00\n',
			'“Amount” more than once'
		],
		[
			'a row with more cells than the header has columns',
			'Trans. Date,Post Date,Description,Amount,Category\n08/14/2026,08/15/2026,SAMPLE TACO STAND,18.25,Gas, Auto\n',
			'Row 2 has 6 cells'
		],
		[
			'a QFX cut off inside a Transaction',
			fixture('capital-one-checking.qfx').split('<FITID>DEMO-0002')[0] ?? '',
			'Transaction 2 never closes'
		],
		[
			'a QFX Transaction left open at the end of its list',
			fixture('capital-one-card.qfx').replace('</STMTTRN>', ''),
			'Transaction 1 never closes'
		],
		[
			'a QFX Transaction left open before the next one',
			fixture('capital-one-checking.qfx').replace('&amp; CO\r\n</STMTTRN>', '&amp; CO\r\n'),
			'Transaction 2 never closes'
		]
	] as const)('refuses %s', ([, text, message]) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeBankFile(text, cutoverDate));

			expect(error._tag).toBe('BankFileError');
			expect(error.message).toContain(message);
		})
	);
});
