import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import { newBackend, publicErrorCode, useOwnerEnv } from './test.helper';

useOwnerEnv();

describe('the cutover date', () => {
	test('is unset until the owner sets it', async () => {
		const { owner } = newBackend();

		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: null });

		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: '2026-08-01' });
	});

	test('must be a real date', async () => {
		const { owner } = newBackend();

		expect(
			await publicErrorCode(
				owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-02-30' })
			)
		).toBe('INVALID_INPUT');
	});
});
