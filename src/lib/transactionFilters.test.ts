import { describe, expect, test } from 'vitest';

import { filtersFromUrl, noFilters, urlWithFilters } from './components/transactions/filters';

const at = (search: string) => new URL(`https://budge.example.test/accounts${search}`);

describe('filters in the URL', () => {
	test('every filter survives a trip through the URL, beside parameters it does not own', () => {
		const values = {
			search: 'corner market',
			accountId: 'k17abc',
			categoryId: 'uncategorized',
			status: 'bank-changes',
			payeeId: 'p42xyz',
			from: '2026-08-01',
			to: '2026-08-31'
		};

		const url = urlWithFilters(at('?tab=ledger&status=unapproved'), values);

		expect(filtersFromUrl(url)).toEqual(values);
		expect(url.searchParams.get('tab')).toBe('ledger');
	});

	test('clearing the filters leaves only the parameters they do not own', () => {
		const url = urlWithFilters(at('?q=rent&status=unapproved&tab=ledger'), noFilters);

		expect(url.search).toBe('?tab=ledger');
	});

	test.each([
		{ search: '?status=everything', field: 'status' },
		{ search: '?from=August', field: 'from' },
		{ search: '?to=2026-02-30', field: 'to' },
		{ search: '?account=../settings', field: 'accountId' },
		{ search: '?payee=Robert%27);', field: 'payeeId' },
		{ search: '?category=Rent%20%26%20Bills', field: 'categoryId' }
	])('a malformed $field from the URL is dropped', ({ search }) => {
		expect(filtersFromUrl(at(search))).toEqual(noFilters);
	});
});
