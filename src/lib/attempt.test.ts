import { ConvexError } from 'convex/values';
import { describe, expect, test } from 'vitest';

import { attempt } from './attempt';

describe('attempting a call', () => {
	test('a call that resolves gives its value', async () => {
		expect(await attempt(() => Promise.resolve(42))).toEqual({ ok: true, value: 42 });
	});

	test('a call that fails with a public error gives that error', async () => {
		const failed = attempt(() =>
			Promise.reject(new ConvexError({ code: 'INVALID_INPUT', message: 'Enter a name.' }))
		);

		expect(await failed).toEqual({
			ok: false,
			error: { code: 'INVALID_INPUT', message: 'Enter a name.' }
		});
	});

	test('any other failure, even a synchronous throw, gives no public error', async () => {
		const rejected = attempt(() => Promise.reject(new Error('network down')));
		const thrown = attempt(() => JSON.parse('{') as Promise<unknown>);

		expect(await rejected).toEqual({ ok: false, error: undefined });
		expect(await thrown).toEqual({ ok: false, error: undefined });
	});
});
