import { describe, expect, test } from 'vitest';

import { formatDate, isIsoDate, localIsoDate, monthOf } from './dates';

describe('isIsoDate', () => {
	test.each(['2026-10-27', '2024-02-29', '2026-01-01'])('accepts %s', (text) => {
		expect(isIsoDate(text)).toBe(true);
	});

	test.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '2026-1-5', '26-10-27', ''])(
		'rejects %j',
		(text) => {
			expect(isIsoDate(text)).toBe(false);
		}
	);
});

test('a date belongs to its calendar month', () => {
	expect(monthOf('2026-10-27')).toBe('2026-10');
});

test('today is read on the local calendar', () => {
	expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
});

test('a date shows as its own calendar day, not shifted by the time zone', () => {
	expect(formatDate('2026-08-01')).toBe('Aug 1, 2026');
	expect(formatDate('2026-12-31', 'short')).toBe('12/31/26');
});
