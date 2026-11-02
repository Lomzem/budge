import type { PublicError } from './domain/publicError';
import { readPublicError } from './publicError';

/** How a call ended: its value, or the public error it failed with (`undefined` for a defect). */
export type Attempt<A> =
	| { readonly ok: true; readonly value: A }
	| { readonly ok: false; readonly error: PublicError | undefined };

/**
 * Runs a call, such as a Convex mutation, and returns how it ended instead of throwing, so the UI
 * shows a failure as a value. A synchronous throw from `run` fails the same way as a rejection.
 */
export function attempt<A>(run: () => PromiseLike<A>): Promise<Attempt<A>> {
	return new Promise<A>((resolve) => {
		resolve(run());
	}).then(
		(value): Attempt<A> => ({ ok: true, value }),
		(thrown: unknown): Attempt<A> => ({ ok: false, error: readPublicError(thrown) })
	);
}
