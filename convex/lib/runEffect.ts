import { Cause, Effect, Exit, Option } from 'effect';

import type { PublicError } from '../../src/lib/domain/publicError';
import { publicError } from './publicError';

export async function runEffect<A, E>(
	program: Effect.Effect<A, E>,
	toPublicError: (error: E) => PublicError
): Promise<A> {
	const exit = await Effect.runPromiseExit(program);
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.findErrorOption(exit.cause);
	if (Option.isNone(failure)) {
		return Effect.runPromise(Effect.failCause(exit.cause));
	}
	const { code, message } = toPublicError(failure.value);
	throw publicError(code, message);
}
