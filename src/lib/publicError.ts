import { ConvexError } from 'convex/values';
import { Option } from 'effect';

import { decodePublicError, type PublicError } from './domain/publicError';

export function readPublicError(error: unknown): PublicError | undefined {
	if (!(error instanceof ConvexError)) return undefined;
	return Option.getOrUndefined(decodePublicError(error.data));
}
