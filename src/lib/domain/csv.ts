// CSV as RFC 4180 describes it: CRLF line ends, and a field quoted when it holds a comma, a quote,
// or a line break.

function text(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return String(value);
	}
	if (typeof value === 'object' && value !== null) return JSON.stringify(value);
	return '';
}

function cell(value: unknown): string {
	const field = text(value);
	return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/**
 * One table as CSV. The header lists every field any row has, in the order they first appear; a
 * row without a field leaves its cell empty. A nested value is written as JSON.
 */
export function toCsv(rows: readonly Readonly<Record<string, unknown>>[]): string {
	const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
	if (fields.length === 0) return '';
	const lines = [fields, ...rows.map((row) => fields.map((field) => row[field]))];
	return lines.map((line) => line.map(cell).join(',') + '\r\n').join('');
}
