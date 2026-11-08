import { describe, expect, test } from 'vitest';

import {
	BANK_CHANGES,
	countedTransactions,
	noFilters,
	UNAPPROVED,
	UNCATEGORIZED
} from './components/transactions/filters';

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
