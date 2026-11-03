import type { PlaidError } from './plaidClient';
import type { TokenCipherError } from './tokenCipher';

export type FailureStatus = 'needsAttention' | 'shortLived' | 'failed';

export interface SyncFailure {
	status: FailureStatus;
	message: string;
}

const NEEDS_ATTENTION = new Set([
	'ITEM_LOGIN_REQUIRED',
	'ITEM_NOT_FOUND',
	'USER_PERMISSION_REVOKED',
	'PENDING_DISCONNECT',
	'PENDING_EXPIRATION'
]);

const SHORT_LIVED = new Set([
	'INSTITUTION_DOWN',
	'INSTITUTION_NOT_RESPONDING',
	'INSTITUTION_NOT_AVAILABLE',
	'PRODUCT_NOT_READY'
]);

export function failureOfPlaidCode(code: string, httpStatus = 400): SyncFailure {
	if (NEEDS_ATTENTION.has(code)) {
		return { status: 'needsAttention', message: `The bank needs you to reconnect (${code}).` };
	}
	if (SHORT_LIVED.has(code) || httpStatus >= 500 || httpStatus === 429) {
		return { status: 'shortLived', message: `The bank is unavailable for now (${code}).` };
	}
	return { status: 'failed', message: `Plaid refused the sync (${code}).` };
}

export function failureOf(error: PlaidError | TokenCipherError): SyncFailure {
	switch (error._tag) {
		case 'PlaidApi':
			return failureOfPlaidCode(error.error_code, error.status);
		case 'PlaidTransport':
			return { status: 'shortLived', message: "Couldn't reach Plaid." };
		case 'PlaidTimeout':
			return { status: 'shortLived', message: "Plaid didn't answer in time." };
		case 'PlaidDecode':
			return { status: 'failed', message: "Plaid sent a response Budge couldn't read." };
		case 'TokenCipherError':
			return { status: 'failed', message: "Budge couldn't open the stored bank login." };
	}
}
