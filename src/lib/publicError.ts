import { ConvexError } from 'convex/values';
import { Option } from 'effect';

import { decodePublicError, type PublicError } from './domain/publicError';

/** The public error a Convex call failed with, or `undefined` for anything else (a defect). */
export function readPublicError(error: unknown): PublicError | undefined {
	if (!(error instanceof ConvexError)) return undefined;
	return Option.getOrUndefined(decodePublicError(error.data));
}
