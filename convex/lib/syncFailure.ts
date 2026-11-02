// Where Plaid's failures become provider-neutral: what a failed sync means for its Bank Connection,
// worded for the owner, with Plaid's raw code kept only as display text.

import type { PlaidError } from './plaidClient';
import type { TokenCipherError } from './tokenCipher';

/**
 * `needsAttention`: only the owner can fix it, through Reconnect; sync pauses until then.
 * `shortLived`: an outage or rate limit that passes; sync retries quietly.
 * `failed`: anything else; recorded for the owner, with no retry.
 */
export type FailureStatus = 'needsAttention' | 'shortLived' | 'failed';

export interface SyncFailure {
	status: FailureStatus;
	/** Fixed wording: no token, body, or bank data. */
	message: string;
}

// Plaid's codes that need the owner to go through Link update mode. Some reach Budge only as
// webhooks: a revoked consent, or a disconnect or consent expiry Plaid announces a week ahead.
const NEEDS_ATTENTION = new Set([
	'ITEM_LOGIN_REQUIRED',
	'ITEM_NOT_FOUND',
	'USER_PERMISSION_REVOKED',
	'PENDING_DISCONNECT',
	'PENDING_EXPIRATION'
]);

// Plaid's codes, answered with HTTP 400, for an outage at the bank or data not ready yet.
const SHORT_LIVED = new Set([
	'INSTITUTION_DOWN',
	'INSTITUTION_NOT_RESPONDING',
	'INSTITUTION_NOT_AVAILABLE',
	'PRODUCT_NOT_READY'
]);

/** What one of Plaid's codes, from an API error or a webhook, means for the Bank Connection. */
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
