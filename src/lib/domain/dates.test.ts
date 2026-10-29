import { describe, expect, test } from 'vitest';

import {
	addMonths,
	formatDate,
	formatMonth,
	isIsoDate,
	isIsoMonth,
	localIsoDate,
	monthOf,
	ordinal
} from './dates';

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

test.each([
	['2026-10', 1, '2026-11'],
	['2026-12', 1, '2027-01'],
	['2026-01', -1, '2025-12'],
	['2026-03', -14, '2025-01']
])('%s moved by %i months is %s', (month, by, moved) => {
	expect(addMonths(month, by)).toBe(moved);
});

test('a month is written YYYY-MM', () => {
	expect(isIsoMonth('2026-10')).toBe(true);
	expect(['2026-13', '2026-1', '2026-10-01', ''].map(isIsoMonth)).toEqual([
		false,
		false,
		false,
		false
	]);
});

test('a month shows by name', () => {
	expect(formatMonth('2026-01')).toBe('January 2026');
});

test.each([
	[1, '1st'],
	[2, '2nd'],
	[3, '3rd'],
	[4, '4th'],
	[11, '11th'],
	[12, '12th'],
	[13, '13th'],
	[21, '21st'],
	[22, '22nd'],
	[23, '23rd'],
	[31, '31st']
])('day %i of the month reads %s', (day, text) => {
	expect(ordinal(day)).toBe(text);
});
