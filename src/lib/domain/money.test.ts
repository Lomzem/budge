import { describe, expect, test } from 'vitest';

import { formatCents, parseCents } from './money';

describe('parseCents', () => {
	test.each([
		['12.34', 1234],
		['12', 1200],
		['12.5', 1250],
		['.75', 75],
		['0', 0],
		['-0', 0],
		['1,234.56', 123456],
		['$1,234.56', 123456],
		['  42.10 ', 4210],
		['-3.07', -307],
		['−3.07', -307]
	])('reads %j as %i cents', (text, cents) => {
		expect(parseCents(text)).toBe(cents);
	});

	test.each(['', '   ', 'abc', '12.345', '1.2.3', '12-', '--1', '1e5', '99999999999999999'])(
		'rejects %j',
		(text) => {
			expect(parseCents(text)).toBeUndefined();
		}
	);
});

describe('formatCents', () => {
	test.each([
		[123456, '$1,234.56'],
		[5, '$0.05'],
		[0, '$0.00'],
		[-45000, '−$450.00']
	])('shows %i cents as %s', (cents, text) => {
		expect(formatCents(cents)).toBe(text);
	});
});
