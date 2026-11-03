import { afterEach, expect, test } from 'vitest';
import { capacityPassed } from './capacity/limits';
import { spawnSync } from 'node:child_process';
import { fakeCheckout, hermeticEnv, removeFakeCheckouts } from './test-support';

afterEach(removeFakeCheckouts);

test('capacity refuses a cloud deployment before changing data', () => {
	const cwd = fakeCheckout({
		'.env.local':
			'CONVEX_DEPLOYMENT=dev:invented\nPUBLIC_CONVEX_URL=https://invented.convex.cloud\n'
	});
	const run = spawnSync(
		'bun',
		['--no-env-file', new URL('capacity/run.js', import.meta.url).pathname],
		{ cwd, env: hermeticEnv(), encoding: 'utf8' }
	);
	expect(run.status).toBe(1);
	expect(run.stderr).toContain('backend is not a local anonymous deployment');
});

const measured = (overrides = {}) => ({
	result: {
		metrics: {
			bytesRead: { used: 100 },
			bytesWritten: { used: 100 },
			documentsRead: { used: 10 },
			documentsWritten: { used: 10 },
			databaseQueries: { used: 10 },
			...overrides
		}
	},
	completion: { returnBytes: 100 }
});

test('capacity requires measurements and rejects any exhausted transaction resource', () => {
	expect(capacityPassed([])).toBe(false);
	expect(capacityPassed([measured()])).toBe(true);
	for (const [key, limit] of Object.entries({
		bytesRead: 16777216,
		bytesWritten: 16777216,
		documentsRead: 32000,
		documentsWritten: 16000,
		databaseQueries: 4096
	})) {
		expect(capacityPassed([measured(), measured({ [key]: { used: limit } })])).toBe(false);
	}
	expect(capacityPassed([{ ...measured(), error: 'invented failure' }])).toBe(false);
	expect(capacityPassed([{ ...measured(), completion: { returnBytes: 16777216 } }])).toBe(false);
});
