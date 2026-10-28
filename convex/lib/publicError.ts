import { ConvexError } from 'convex/values';

import type { PublicError, PublicErrorCode } from '../../src/lib/domain/publicError';

export function publicError(code: PublicErrorCode, message?: string): ConvexError<PublicError> {
	return new ConvexError(message === undefined ? { code } : { code, message });
}
