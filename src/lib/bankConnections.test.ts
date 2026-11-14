import { describe, expect, test } from 'vitest';

import {
	describeReconnect,
	describeSync,
	type Report,
	type SyncOutcome
} from './bankConnections.svelte';

type Expected = Omit<Report, 'failed'> & { failed?: true };

describe('describeSync', () => {
	test.each([
		[{ kind: 'synced', added: 12, matched: 0, held: 0 }, { text: '12 Transactions added.' }],
		[{ kind: 'synced', added: 1, matched: 0, held: 0 }, { text: '1 Transaction added.' }],
		[{ kind: 'synced', added: 0, matched: 0, held: 0 }, { text: 'No Transactions added.' }],
		[
			{ kind: 'synced', added: 2, matched: 1, held: 0 },
			{ text: '2 Transactions added.', detail: '1 matched a Transaction you entered.' }
		],
		[
			{ kind: 'synced', added: 0, matched: 3, held: 0 },
			{ text: 'No Transactions added.', detail: '3 matched Transactions you entered.' }
		],
		[
			{ kind: 'synced', added: 0, matched: 0, held: 3 },
			{ text: 'No Transactions added. 3 wait for setup below.' }
		],
		[
			{ kind: 'synced', added: 2, matched: 0, held: 1 },
			{ text: '2 Transactions added. 1 waits for setup below.' }
		],
		[{ kind: 'busy' }, { text: 'A sync is already running.' }],
		[
			{ kind: 'noToken' },
			{ text: 'This Bank Connection has no bank login, so it never syncs.', failed: true }
		]
	] satisfies [SyncOutcome, Expected][])('reports %j as %j', (outcome, expected: Expected) => {
		expect(describeSync(outcome)).toEqual({ failed: false, ...expected });
	});
});

describe('describeReconnect', () => {
	test.each([
		[
			{ kind: 'synced', added: 2, matched: 1, held: 0 },
			{ text: 'Reconnected. 2 Transactions added.', detail: '1 matched a Transaction you entered.' }
		],
		[
			{ kind: 'synced', added: 0, matched: 0, held: 2 },
			{
				text: 'Reconnected. No Transactions added. 2 wait for setup below.'
			}
		],
		[{ kind: 'busy' }, { text: 'Reconnected. A sync is already running.' }],
		[
			{ kind: 'noToken' },
			{
				text: 'Reconnected. This Bank Connection has no bank login, so it never syncs.',
				failed: true
			}
		]
	] satisfies [SyncOutcome, Expected][])('reports %j as %j', (outcome, expected: Expected) => {
		expect(describeReconnect(outcome)).toEqual({ failed: false, ...expected });
	});
});
