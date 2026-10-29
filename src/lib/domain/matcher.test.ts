import { describe, expect, test } from 'vitest';

import { matchBankRows, type BankSource, type MatchCandidate, type MatchContext } from './matcher';

// Invented Bank Text and amounts.
const coffee = { date: '2026-08-14', amount: -450, bankText: 'SAMPLE COFFEE 0042' };

function handEntered(
	id: string,
	change: Partial<MatchCandidate<string>> = {}
): MatchCandidate<string> {
	return { id, date: '2026-08-14', amount: -450, cleared: false, linkedSources: [], ...change };
}

function decide(
	rows: Parameters<typeof matchBankRows<string>>[1],
	context: Partial<MatchContext<string>> = {},
	source: BankSource = 'csv'
) {
	return matchBankRows(source, rows, { knownImportIds: new Set(), candidates: [], ...context });
}

describe('the matcher', () => {
	test('a Bank Row with no candidate is New', () => {
		expect(decide([coffee])).toEqual([{ kind: 'new' }]);
	});

	test('a Bank Row whose import ID is already known in the Account is skipped', () => {
		expect(
			decide([{ ...coffee, sourceId: 'FIT-1' }], {
				knownImportIds: new Set(['FIT-1']),
				candidates: [handEntered('a')]
			})
		).toEqual([{ kind: 'skip' }]);
	});

	test('a Bank Row with exactly one candidate Matches it', () => {
		expect(decide([coffee], { candidates: [handEntered('a')] })).toEqual([
			{ kind: 'match', transactionId: 'a' }
		]);
	});

	test('a Bank Row with two candidates asks, nearest date first', () => {
		expect(
			decide([coffee], {
				candidates: [handEntered('far', { date: '2026-08-04' }), handEntered('near')]
			})
		).toEqual([{ kind: 'ask', candidates: ['near', 'far'] }]);
	});

	test.each([
		['another amount', { amount: -451 }],
		['dated 11 days before', { date: '2026-08-03' }],
		['dated 11 days after', { date: '2026-08-25' }],
		['already Cleared', { cleared: true }],
		['already linked to a Bank Row from the same source', { linkedSources: ['csv' as const] }]
	])('a Transaction %s is no candidate', (_, change) => {
		expect(decide([coffee], { candidates: [handEntered('a', change)] })).toEqual([{ kind: 'new' }]);
	});

	test('a Transaction dated 10 days either side is a candidate', () => {
		expect(
			decide([coffee], {
				candidates: [
					handEntered('a', { date: '2026-08-04' }),
					handEntered('b', { date: '2026-08-24' })
				]
			})
		).toEqual([{ kind: 'ask', candidates: ['a', 'b'] }]);
	});

	test('a file row may Match a Transaction already imported by sync', () => {
		const synced = handEntered('a', { cleared: true, linkedSources: ['plaid'] });

		expect(decide([coffee], { candidates: [synced] }, 'qfx')).toEqual([
			{ kind: 'match', transactionId: 'a' }
		]);
		expect(decide([coffee], { candidates: [synced] }, 'plaid')).toEqual([{ kind: 'new' }]);
	});

	test('each Transaction takes at most one row, so two identical coffees stay two', () => {
		expect(decide([coffee, coffee], { candidates: [handEntered('a')] })).toEqual([
			{ kind: 'match', transactionId: 'a' },
			{ kind: 'new' }
		]);
		expect(decide([coffee, coffee])).toEqual([{ kind: 'new' }, { kind: 'new' }]);
	});

	test('a repeated import ID within one batch is skipped', () => {
		const row = { ...coffee, sourceId: 'FIT-1' };

		expect(decide([row, row], {}, 'qfx')).toEqual([{ kind: 'new' }, { kind: 'skip' }]);
	});

	test('a row without an ID repeats a known identical row once per known row', () => {
		expect(
			decide([coffee, coffee, { ...coffee, bankText: 'SAMPLE BAKERY' }], {
				knownRowsWithoutId: [coffee]
			})
		).toEqual([{ kind: 'skip' }, { kind: 'new' }, { kind: 'new' }]);
	});

	test('a pick resolves an ask', () => {
		const candidates = [handEntered('a'), handEntered('b')];

		expect(decide([{ ...coffee, pick: 'b' }], { candidates })).toEqual([
			{ kind: 'match', transactionId: 'b' }
		]);
		expect(decide([{ ...coffee, pick: 'new' }], { candidates })).toEqual([{ kind: 'new' }]);
		expect(decide([{ ...coffee, pick: 'elsewhere' }], { candidates })).toEqual([
			{ kind: 'ask', candidates: ['a', 'b'] }
		]);
	});

	test('a picked Transaction is taken, so a later identical row Matches the other', () => {
		expect(
			decide([{ ...coffee, pick: 'b' }, coffee], {
				candidates: [handEntered('a'), handEntered('b')]
			})
		).toEqual([
			{ kind: 'match', transactionId: 'b' },
			{ kind: 'match', transactionId: 'a' }
		]);
	});
});
