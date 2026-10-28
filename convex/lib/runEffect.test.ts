import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { readPublicError } from '../../src/lib/publicError';
import { runEffect } from './runEffect';

class BankLoginExpired {
	readonly _tag = 'BankLoginExpired';
}

const toPublicError = (error: BankLoginExpired) =>
	({ code: 'BANK_CONNECTION_NEEDS_LOGIN', message: error._tag }) as const;

test('returns what the program succeeds with', async () => {
	expect(await runEffect(Effect.succeed(42), toPublicError)).toBe(42);
});

test('throws a typed failure as its public error', async () => {
	const error: unknown = await runEffect(Effect.fail(new BankLoginExpired()), toPublicError).catch(
		(thrown: unknown) => thrown
	);

	expect(readPublicError(error)).toEqual({
		code: 'BANK_CONNECTION_NEEDS_LOGIN',
		message: 'BankLoginExpired'
	});
});

test('leaves a defect unmapped', async () => {
	const defect = new Error('unexpected');
	const error: unknown = await runEffect(Effect.die(defect), toPublicError).catch(
		(thrown: unknown) => thrown
	);

	expect(error).toBe(defect);
	expect(readPublicError(error)).toBeUndefined();
});
