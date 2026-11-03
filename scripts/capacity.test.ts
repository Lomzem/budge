import { afterEach, expect, test } from 'vitest';
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
