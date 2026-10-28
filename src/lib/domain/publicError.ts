import { Schema } from 'effect';

// The only error payload a public Convex function may throw. Codes are fixed, so tokens,
// request bodies, and raw bank responses never reach the UI or logs.
export const PublicErrorCode = Schema.Literals([
	'FORBIDDEN',
	'NOT_FOUND',
	'INVALID_INPUT',
	'BANK_CONNECTION_NEEDS_LOGIN',
	'BANK_UNAVAILABLE'
]);
export type PublicErrorCode = typeof PublicErrorCode.Type;

export const PublicError = Schema.Struct({
	code: PublicErrorCode,
	message: Schema.optionalKey(Schema.String)
});
export type PublicError = typeof PublicError.Type;

export const decodePublicError = Schema.decodeUnknownOption(PublicError);
