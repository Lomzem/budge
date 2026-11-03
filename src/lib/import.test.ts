import { describe, expect, test } from 'vitest';

import { readBankFile } from './import';

const LIMIT_BYTES = 5_000_000;
const CUTOVER_DATE = '2026-01-01';

function inventedCsvOfExactly(bytes: number) {
	const csv = [
		'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
		'0000,SAMPLE PADDED ROW,02/03/2026,Debit,12.34,100.00',
		''
	].join('\n');
	const text = csv + ' '.repeat(bytes - csv.length);
	return new File([text], 'bank.csv', { type: 'text/csv' });
}

describe('reading a bank file by size', () => {
	test('a file of exactly the limit is read', async () => {
		const file = inventedCsvOfExactly(LIMIT_BYTES);
		expect(file.size).toBe(LIMIT_BYTES);

		const read = await readBankFile(file, CUTOVER_DATE);

		expect(read.ok && read.file.rows).toEqual([
			expect.objectContaining({ date: '2026-02-03', amount: -1234 })
		]);
	});

	test('a file one byte over the limit is refused unread, with a message for the owner', async () => {
		const file = inventedCsvOfExactly(LIMIT_BYTES + 1);
		expect(file.size).toBe(LIMIT_BYTES + 1);

		expect(await readBankFile(file, CUTOVER_DATE)).toEqual({
			ok: false,
			message: 'This file is too large to be a bank export.'
		});
	});
});
