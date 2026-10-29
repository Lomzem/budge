// Decodes the bank files the owner downloads into Bank Rows: whole cents, ISO dates, Bank Text,
// and the bank's import ID when the file has one. Rows dated before the cutover date are dropped.

import { Effect, Schema, SchemaGetter, SchemaIssue } from 'effect';

import { isIsoDate } from './dates';
import type { BankRow } from './matcher';
import { parseCents } from './money';

/** Why a bank file could not be read, worded for the owner. */
export class BankFileError extends Schema.TaggedError<
	BankFileError,
	{ readonly brand: unique symbol }
>()('BankFileError', {
	message: Schema.String
}) {}

export type BankFileFormat = 'capitalOneCsv' | 'capitalOneCardCsv' | 'discoverCsv' | 'qfx';

export interface BankFile {
	format: BankFileFormat;
	source: 'csv' | 'qfx';
	rows: BankRow[];
}

/** Bank Rows read from the text of a Capital One or Discover CSV, or any bank's QFX. */
export const decodeBankFile = Effect.fnUntraced(function* (
	text: string,
	cutoverDate: string
): Effect.fn.Return<BankFile, BankFileError> {
	const file = /<OFX>/i.test(text) ? yield* decodeQfx(text) : yield* decodeCsv(text);
	return { ...file, rows: file.rows.filter((row) => row.date >= cutoverDate) };
});

// Field decoders.

function parsedString<T extends Schema.Top>(
	to: T,
	parse: (text: string) => T['Encoded'] | undefined,
	message: string
) {
	return Schema.String.pipe(
		Schema.decodeTo(to, {
			decode: SchemaGetter.transformEffect((text: string) => {
				const value = parse(text);
				return value === undefined
					? Effect.fail(new SchemaIssue.InvalidValue({ message: `${message}: “${text}”` }))
					: Effect.succeed(value);
			}),
			encode: SchemaGetter.transform(String)
		})
	);
}

const SHORT_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const pad = (n: string) => n.padStart(2, '0');

/** `MM/DD/YY`, `MM/DD/YYYY`, or `YYYY-MM-DD`, as an ISO date. */
const CsvDate = parsedString(
	Schema.String,
	(text) => {
		const trimmed = text.trim();
		const short = SHORT_DATE.exec(trimmed);
		const iso = short
			? `${short[3]?.length === 2 ? `20${short[3]}` : (short[3] ?? '')}-${pad(short[1] ?? '')}-${pad(short[2] ?? '')}`
			: trimmed;
		return isIsoDate(iso) ? iso : undefined;
	},
	'Expected a date'
);

/** An OFX `YYYYMMDD…` date and time, as the ISO date written in it, without moving time zones. */
const OfxDate = parsedString(
	Schema.String,
	(text) => {
		const digits = /^(\d{4})(\d{2})(\d{2})/.exec(text.trim());
		const iso = digits ? `${digits[1] ?? ''}-${digits[2] ?? ''}-${digits[3] ?? ''}` : '';
		return isIsoDate(iso) ? iso : undefined;
	},
	'Expected a date'
);

/** A dollar amount, as whole cents. */
const Cents = parsedString(
	Schema.Finite,
	(text) => parseCents(text.trim().replace(/^\+/, '')),
	'Expected an amount in dollars and cents'
);

/** A dollar amount or an empty cell, as whole cents. */
const OptionalCents = parsedString(
	Schema.Finite,
	(text) => (text.trim() === '' ? 0 : parseCents(text)),
	'Expected an amount in dollars and cents'
);

const Text = parsedString(
	Schema.String,
	(text) => text.replace(/\s+/g, ' ').trim() || undefined,
	'Expected a description'
);

// CSV.

interface CsvProfile {
	format: BankFileFormat;
	headers: readonly string[];
	decode: (record: Record<string, string>) => Effect.Effect<BankRow, Schema.SchemaError>;
}

function csvProfile<S extends Schema.Top & { readonly DecodingServices: never }>(
	format: BankFileFormat,
	row: S & Schema.Struct<Schema.Struct.Fields>,
	toBankRow: (row: S['Type']) => BankRow
): CsvProfile {
	return {
		format,
		headers: Object.keys(row.fields),
		decode: (record) => Effect.map(Schema.decodeEffect(row)(record), toBankRow)
	};
}

const csvProfiles = [
	// Checking and savings: an unsigned amount and a Debit or Credit type.
	csvProfile(
		'capitalOneCsv',
		Schema.Struct({
			'Transaction Date': CsvDate,
			'Transaction Description': Text,
			'Transaction Type': Schema.Literals(['Debit', 'Credit']),
			'Transaction Amount': Cents
		}),
		(row) => ({
			date: row['Transaction Date'],
			amount: (row['Transaction Type'] === 'Credit' ? 1 : -1) * Math.abs(row['Transaction Amount']),
			bankText: row['Transaction Description']
		})
	),
	// Credit cards: separate Debit and Credit columns.
	csvProfile(
		'capitalOneCardCsv',
		Schema.Struct({
			'Transaction Date': CsvDate,
			Description: Text,
			Debit: OptionalCents,
			Credit: OptionalCents
		}),
		(row) => ({
			date: row['Transaction Date'],
			amount: Math.abs(row.Credit) - Math.abs(row.Debit),
			bankText: row.Description
		})
	),
	// Discover writes purchases positive and payments negative.
	csvProfile(
		'discoverCsv',
		Schema.Struct({ 'Trans. Date': CsvDate, Description: Text, Amount: Cents }),
		(row) => ({ date: row['Trans. Date'], amount: -row.Amount, bankText: row.Description })
	)
];

const unknownLayout = () =>
	new BankFileError({
		message: 'This file is not a Capital One or Discover CSV, or a QFX file.'
	});

const formatIssue = SchemaIssue.makeFormatterDefault();

const decodeCsv = Effect.fnUntraced(function* (
	text: string
): Effect.fn.Return<Omit<BankFile, 'rows'> & { rows: BankRow[] }, BankFileError> {
	const [header = [], ...records] = parseCsv(text.replace(/^\uFEFF/, ''));
	const columns = header.map((name) => name.trim());
	const profile = csvProfiles.find((candidate) =>
		candidate.headers.every((name) => columns.includes(name))
	);
	if (profile === undefined) return yield* unknownLayout();

	const rows: BankRow[] = [];
	for (const [index, cells] of records.entries()) {
		if (cells.every((cell) => cell.trim() === '')) continue;
		const record = Object.fromEntries(
			columns.flatMap((name, column) => {
				const cell = cells[column];
				return cell === undefined ? [] : [[name, cell]];
			})
		);
		rows.push(
			yield* profile.decode(record).pipe(
				Effect.mapError(
					(error) =>
						new BankFileError({
							message: `Row ${String(index + 2)}: ${formatIssue(error.issue)}`
						})
				)
			)
		);
	}
	return { format: profile.format, source: 'csv', rows };
});

/** The rows of RFC 4180 CSV text, with quoted fields unquoted. */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i);
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += char;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

// QFX, both the SGML of OFX 1 and the XML of OFX 2.

const QfxTransaction = Schema.Struct({
	DTPOSTED: OfxDate,
	DTUSER: Schema.optionalKey(OfxDate),
	TRNAMT: Cents,
	FITID: Text,
	NAME: Schema.optionalKey(Schema.String),
	MEMO: Schema.optionalKey(Schema.String)
});

const decodeQfx = Effect.fnUntraced(function* (
	text: string
): Effect.fn.Return<Omit<BankFile, 'rows'> & { rows: BankRow[] }, BankFileError> {
	const rows: BankRow[] = [];
	// Posted transactions only: pending ones sit in STMTTRNP, which this never matches.
	const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];
	for (const [index, [, block = '']] of blocks.entries()) {
		const tags: Record<string, string> = Object.fromEntries(
			[...block.matchAll(/<([A-Z0-9.]+)>([^<\r\n]*)/gi)]
				.map(([, name = '', value = '']): [string, string] => [
					name.toUpperCase(),
					decodeEntities(value).trim()
				])
				.filter(([, value]) => value !== '')
		);
		// A correction rewrites an earlier row; the matcher has no way to apply it, so it is skipped.
		if ('CORRECTACTION' in tags) continue;
		const transaction = yield* Schema.decodeUnknownEffect(QfxTransaction)(tags).pipe(
			Effect.mapError(
				(error) =>
					new BankFileError({
						message: `Transaction ${String(index + 1)}: ${formatIssue(error.issue)}`
					})
			)
		);
		const bankText = [transaction.NAME, transaction.MEMO]
			.filter((part) => part !== undefined)
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (bankText === '') {
			return yield* new BankFileError({
				message: `Transaction ${String(index + 1)}: Expected a name or memo`
			});
		}
		rows.push({
			date: transaction.DTUSER ?? transaction.DTPOSTED,
			amount: transaction.TRNAMT,
			bankText,
			sourceId: transaction.FITID
		});
	}
	return { format: 'qfx', source: 'qfx', rows };
});

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
		if (name.startsWith('#x') || name.startsWith('#X'))
			return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
		if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
		return ENTITIES[name.toLowerCase()] ?? entity;
	});
}
