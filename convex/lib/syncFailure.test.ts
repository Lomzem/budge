import { describe, expect, it } from '@effect/vitest';

import { PlaidApi, PlaidDecode, PlaidTimeout, PlaidTransport } from './plaidClient';
import { failureOf } from './syncFailure';
import { TokenCipherError } from './tokenCipher';

const refused = (error_code: string, status = 400) =>
	new PlaidApi({ error_code, status, request_id: 'request-synthetic-1' });

describe('a failed sync maps to a provider-neutral status', () => {
	it.each([
		['a needed login', refused('ITEM_LOGIN_REQUIRED')],
		['access removed by the owner', refused('ITEM_NOT_FOUND')],
		['revoked consent', refused('USER_PERMISSION_REVOKED')],
		['an announced disconnect', refused('PENDING_DISCONNECT')],
		['an announced consent expiry', refused('PENDING_EXPIRATION')]
	])('%s needs the owner', (_, error) => {
		expect(failureOf(error)).toEqual({
			status: 'needsAttention',
			message: `The bank needs you to reconnect (${error.error_code}).`
		});
	});

	it.each([
		['no answer', new PlaidTransport(), "Couldn't reach Plaid."],
		['a timeout', new PlaidTimeout(), "Plaid didn't answer in time."],
		[
			"Plaid's outage",
			refused('INTERNAL_SERVER_ERROR', 500),
			'The bank is unavailable for now (INTERNAL_SERVER_ERROR).'
		],
		['a rate limit', refused('RATE_LIMIT', 429), 'The bank is unavailable for now (RATE_LIMIT).'],
		[
			"the bank's outage",
			refused('INSTITUTION_DOWN'),
			'The bank is unavailable for now (INSTITUTION_DOWN).'
		],
		[
			'a bank not answering',
			refused('INSTITUTION_NOT_RESPONDING'),
			'The bank is unavailable for now (INSTITUTION_NOT_RESPONDING).'
		],
		[
			'data not ready',
			refused('PRODUCT_NOT_READY'),
			'The bank is unavailable for now (PRODUCT_NOT_READY).'
		]
	])('%s is short-lived', (_, error, message) => {
		expect(failureOf(error)).toEqual({ status: 'shortLived', message });
	});

	it.each([
		['another refusal', refused('INVALID_FIELD'), 'Plaid refused the sync (INVALID_FIELD).'],
		['an unreadable answer', new PlaidDecode(), "Plaid sent a response Budge couldn't read."],
		[
			'a sealed token Budge cannot open',
			new TokenCipherError(),
			"Budge couldn't open the stored bank login."
		]
	])('%s is a plain failure', (_, error, message) => {
		expect(failureOf(error)).toEqual({ status: 'failed', message });
	});
});
