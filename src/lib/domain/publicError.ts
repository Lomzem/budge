import { Schema } from 'effect';

export const PublicErrorCode = Schema.Literals([
	'FORBIDDEN',
	'NOT_FOUND',
	'INVALID_INPUT',
	'BANK_CONNECTION_NEEDS_LOGIN',
	'BANK_UNAVAILABLE',
	'BANK_SYNC_UNAVAILABLE'
]);
export type PublicErrorCode = typeof PublicErrorCode.Type;

export const PublicError = Schema.Struct({
	code: PublicErrorCode,
	message: Schema.optionalKey(Schema.String)
});
export type PublicError = typeof PublicError.Type;

export const decodePublicError = Schema.decodeUnknownOption(PublicError);
