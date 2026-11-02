import type { PublicError } from './domain/publicError';
import { readPublicError } from './publicError';

export type Attempt<A> =
	| { readonly ok: true; readonly value: A }
	| { readonly ok: false; readonly error: PublicError | undefined };

export function attempt<A>(run: () => PromiseLike<A>): Promise<Attempt<A>> {
	return new Promise<A>((resolve) => {
		resolve(run());
	}).then(
		(value): Attempt<A> => ({ ok: true, value }),
		(thrown: unknown): Attempt<A> => ({ ok: false, error: readPublicError(thrown) })
	);
}
