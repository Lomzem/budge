import { describe, expect, test } from 'vitest';

import {
	BANK_CHANGES,
	countedTransactions,
	dateRangeOf,
	type DateRange,
	filtersFromUrl,
	noFilters,
	offeredFilters,
	UNAPPROVED,
	UNCATEGORIZED,
	withDateRange
} from './transactionFilters';

describe('the register count names the filter that narrowed it', () => {
	test.each([
		{ shown: 'no filter', count: 1, values: {}, line: '1 Transaction' },
		{
			shown: 'Uncategorized',
			count: 9,
			values: { categoryId: UNCATEGORIZED },
			line: '9 Uncategorized Transactions'
		},
		{
			shown: 'Unapproved and Uncategorized',
			count: 2,
			values: { status: UNAPPROVED, categoryId: UNCATEGORIZED },
			line: '2 Unapproved Uncategorized Transactions'
		},
		{
			shown: 'bank changes',
			count: 1,
			values: { status: BANK_CHANGES },
			line: '1 Transaction the bank changed'
		},
		{
			shown: 'a search on Unapproved',
			count: 3,
			values: { search: 'coffee', status: UNAPPROVED },
			line: '3 matching Unapproved Transactions'
		},
		{
			shown: 'a date range',
			count: 4,
			values: { from: '2026-10-01' },
			line: '4 matching Transactions'
		}
	])('$shown reads "$line"', ({ count, values, line }) => {
		expect(countedTransactions(count, { ...noFilters, ...values })).toBe(line);
	});
});

const loaded = { accountIds: ['acct1'], categoryIds: ['cat1'], payeeIds: ['payee1'] };

describe('offeredFilters', () => {
	test.each([
		{ url: '?account=acct1&category=cat1&payee=payee1', kept: ['acct1', 'cat1', 'payee1'] },
		{ url: '?account=abc&category=123&payee=xyz', kept: ['', '', ''] },
		{ url: '?account=cat1&category=payee1&payee=acct1', kept: ['', '', ''] },
		{ url: '?account=a%20b&category=..%2F&payee=%3Cx%3E', kept: ['', '', ''] },
		{ url: `?category=${UNCATEGORIZED}`, kept: ['', UNCATEGORIZED, ''] }
	])('keeps only what the filter menus offer from $url', ({ url, kept }) => {
		const values = filtersFromUrl(new URL(`https://budge.test/accounts${url}`));
		const offered = offeredFilters(values, loaded);
		expect([offered?.accountId, offered?.categoryId, offered?.payeeId]).toEqual(kept);
	});

	test('waits for a list before judging a filter that needs it', () => {
		const values = filtersFromUrl(new URL('https://budge.test/accounts?payee=payee1&q=rent'));
		expect(offeredFilters(values, { ...loaded, payeeIds: undefined })).toBeUndefined();
		expect(offeredFilters(values, { ...loaded, accountIds: undefined })).toEqual({
			...noFilters,
			search: 'rent',
			payeeId: 'payee1'
		});
	});
});

describe('date range presets run on local calendar dates', () => {
	test.each([
		{
			today: '2026-03-15',
			ranges: {
				'this-month': ['2026-03-01', '2026-03-31'],
				'last-month': ['2026-02-01', '2026-02-28'],
				'last-30-days': ['2026-02-14', '2026-03-15'],
				'this-year': ['2026-01-01', '2026-12-31']
			}
		},
		{
			today: '2028-01-05',
			ranges: {
				'this-month': ['2028-01-01', '2028-01-31'],
				'last-month': ['2027-12-01', '2027-12-31'],
				'last-30-days': ['2027-12-07', '2028-01-05'],
				'this-year': ['2028-01-01', '2028-12-31']
			}
		},
		{
			today: '2028-03-31',
			ranges: {
				'this-month': ['2028-03-01', '2028-03-31'],
				'last-month': ['2028-02-01', '2028-02-29'],
				'last-30-days': ['2028-03-02', '2028-03-31'],
				'this-year': ['2028-01-01', '2028-12-31']
			}
		}
	])('on $today', ({ today, ranges }) => {
		for (const [range, [from, to]] of Object.entries(ranges)) {
			const values = withDateRange(noFilters, range as DateRange, today);
			expect([values.from, values.to]).toEqual([from, to]);
			expect(dateRangeOf(values, today)).toBe(range);
		}
	});

	test('dates that match no preset read as a custom range, and none as any date', () => {
		expect(dateRangeOf({ ...noFilters, from: '2026-03-02' }, '2026-03-15')).toBe('custom');
		expect(dateRangeOf({ ...noFilters, to: '2026-03-31' }, '2026-03-15')).toBe('custom');
		expect(dateRangeOf(noFilters, '2026-03-15')).toBe('');
		expect(withDateRange({ ...noFilters, from: '2026-03-02' }, '', '2026-03-15')).toEqual(
			noFilters
		);
	});

	test('a preset keeps the other filters', () => {
		const values = { ...noFilters, search: 'rent', payeeId: 'payee1' };
		expect(withDateRange(values, 'this-month', '2026-03-15')).toEqual({
			...values,
			from: '2026-03-01',
			to: '2026-03-31'
		});
	});
});
