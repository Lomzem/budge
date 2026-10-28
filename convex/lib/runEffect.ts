import { ConvexError } from 'convex/values';
import { Cause, Effect, Exit, Option } from 'effect';

import type { PublicError } from '../../src/lib/domain/publicError';

/**
 * Runs one action's or workflow mutation's program exactly once. A typed failure is thrown as its
 * fixed public error; a defect is rethrown unmapped, so it surfaces as a server error.
 */
export async function runEffect<A, E>(
	program: Effect.Effect<A, E>,
	toPublicError: (error: E) => PublicError
): Promise<A> {
	const exit = await Effect.runPromiseExit(program);
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.findErrorOption(exit.cause);
	if (Option.isSome(failure)) throw new ConvexError(toPublicError(failure.value));
	throw Cause.squash(exit.cause);
}
