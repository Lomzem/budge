import { describe, expect, test } from 'vitest';

import { formatUnapprovedCount, UNAPPROVED_COUNT_LIMIT } from './unapproved';

describe('formatUnapprovedCount', () => {
	test('writes a count up to the limit as it is', () => {
		expect(formatUnapprovedCount(3)).toBe('3');
		expect(formatUnapprovedCount(UNAPPROVED_COUNT_LIMIT)).toBe('1,000');
	});

	test('writes a count past the limit as a lower bound', () => {
		expect(formatUnapprovedCount(UNAPPROVED_COUNT_LIMIT + 1)).toBe('1,000+');
	});
});
