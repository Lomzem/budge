import { describe, expect, test } from 'vitest';

import { formatSynced } from './freshness';

const now = Date.parse('2026-10-27T12:00:00Z');
const ago = (ms: number) => now - ms;
const MINUTE = 60_000;

describe('formatSynced', () => {
	test.each([
		[null, 'Never synced'],
		[ago(30_000), 'Synced just now'],
		[ago(MINUTE), 'Synced 1 minute ago'],
		[ago(59 * MINUTE), 'Synced 59 minutes ago'],
		[ago(60 * MINUTE), 'Synced 1 hour ago'],
		[ago(2 * 60 * MINUTE + 59 * MINUTE), 'Synced 2 hours ago'],
		[ago(24 * 60 * MINUTE), 'Synced 1 day ago'],
		[ago(9 * 24 * 60 * MINUTE), 'Synced 9 days ago'],
		// A clock a little behind the server's still reads as just now.
		[now + 5_000, 'Synced just now']
	])('%s reads as %s', (lastSyncedAt, text) => {
		expect(formatSynced(lastSyncedAt, now)).toBe(text);
	});
});
