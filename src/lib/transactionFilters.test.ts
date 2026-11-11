import { describe, expect, test } from 'vitest';

import {
	BANK_CHANGES,
	countedTransactions,
	filtersFromUrl,
	noFilters,
	offeredFilters,
	UNAPPROVED,
	UNCATEGORIZED
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
