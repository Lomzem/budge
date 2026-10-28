import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';

import { internal } from './_generated/api';

const modules = import.meta.glob('./**/*.ts');

test('runs Convex functions that import the domain module', async () => {
	const t = convexTest(undefined, modules);
	expect(await t.query(internal.health.ping, {})).toBe('Budge');
});
