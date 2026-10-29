import { describe, expect, test } from 'vitest';

import { toCsv } from './csv';

describe('toCsv', () => {
	test('writes a header of every field, then one line per row', () => {
		const csv = toCsv([
			{ _id: 'a1', name: 'Checking', position: 0 },
			{ _id: 'a2', name: 'Savings', position: 1, hidden: true }
		]);

		expect(csv).toBe('_id,name,position,hidden\r\na1,Checking,0,\r\na2,Savings,1,true\r\n');
	});

	test('quotes commas, quotes, and line breaks', () => {
		const csv = toCsv([
			{ memo: 'Rent, August' },
			{ memo: 'The "big" one' },
			{ memo: 'two\nlines' }
		]);

		expect(csv).toBe('memo\r\n"Rent, August"\r\n"The ""big"" one"\r\n"two\nlines"\r\n');
	});

	test('writes a nested value as JSON', () => {
		const csv = toCsv([{ target: { kind: 'monthly', amount: 5000 } }]);

		expect(csv).toBe('target\r\n"{""kind"":""monthly"",""amount"":5000}"\r\n');
	});

	test('writes nothing for no rows', () => {
		expect(toCsv([])).toBe('');
	});
});
