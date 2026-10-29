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

	test('keeps a string a spreadsheet would run as a formula as text', () => {
		const csv = toCsv([
			{ name: '=HYPERLINK("https://example.test")' },
			{ name: '+1' },
			{ name: '-1' },
			{ name: '@SUM(A1)' },
			{ name: '\tTab' },
			{ name: '\rReturn' },
			{ name: 'Grocer = food' }
		]);

		expect(csv).toBe(
			'name\r\n"\'=HYPERLINK(""https://example.test"")"\r\n\'+1\r\n\'-1\r\n\'@SUM(A1)\r\n' +
				'\'\tTab\r\n"\'\rReturn"\r\nGrocer = food\r\n'
		);
	});

	test('leaves a negative amount a number', () => {
		expect(toCsv([{ amount: -120_000 }])).toBe('amount\r\n-120000\r\n');
	});

	test('writes nothing for no rows', () => {
		expect(toCsv([])).toBe('');
	});
});
