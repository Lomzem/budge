import { expect, it } from '@effect/vitest';
import { Effect } from 'effect';

import { APP_NAME } from './index';

it.effect('runs Effect programs against the domain module', () =>
	Effect.gen(function* () {
		const name = yield* Effect.succeed(APP_NAME);
		expect(name).toBe('Budge');
	})
);
