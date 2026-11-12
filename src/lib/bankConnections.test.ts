import { describe, expect, test } from 'vitest';

import { describeReconnect } from './bankConnections.svelte';

describe('describeReconnect', () => {
	test.each([
		[{ kind: 'synced', added: 2, matched: 1 }, 'Reconnected. Added 2, Matched 1.', false],
		[{ kind: 'busy' }, 'Reconnected. A sync is already running.', false],
		[
			{ kind: 'noToken' },
			'Reconnected. This Bank Connection has no bank login, so it never syncs.',
			true
		]
	] as const)('reports %j as %j', (outcome, text, failed) => {
		expect(describeReconnect(outcome)).toEqual({ text, failed });
	});
});
