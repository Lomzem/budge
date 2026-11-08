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

	test.each([
		{ shape: 'a bare code string', data: 'INVALID_INPUT' },
		{ shape: 'no data', data: null },
		{ shape: 'a list', data: ['INVALID_INPUT'] },
		{ shape: 'a message without a code', data: { message: 'Enter a name.' } },
		{ shape: 'an unknown code', data: { code: 'SERVER_ON_FIRE', message: 'Enter a name.' } },
		{ shape: 'a lowercase code', data: { code: 'invalid_input' } },
		{ shape: 'a code that is not text', data: { code: 404 } },
		{ shape: 'a message that is not text', data: { code: 'INVALID_INPUT', message: 42 } }
	])('a ConvexError carrying $shape gives no public error', async ({ data }) => {
		expect(await attempt(() => Promise.reject(new ConvexError(data)))).toEqual({
			ok: false,
			error: undefined
		});
	});

	test('any other failure, even a synchronous throw, gives no public error', async () => {
		const rejected = attempt(() => Promise.reject(new Error('network down')));
		const thrown = attempt(() => JSON.parse('{') as Promise<unknown>);

		expect(await rejected).toEqual({ ok: false, error: undefined });
		expect(await thrown).toEqual({ ok: false, error: undefined });
	});
});
