import { Effect, Schema, SchemaGetter, SchemaIssue } from 'effect';

import { isIsoDate } from './dates';
import { parseCents } from './money';

const OutflowPositiveCents = Schema.Finite.pipe(
	Schema.decodeTo(Schema.Finite, {
		decode: SchemaGetter.transformEffect((amount: number) => {
			const cents = parseCents(String(amount));
			return cents === undefined
				? Effect.fail(new SchemaIssue.InvalidValue({ message: 'Expected dollars and cents' }))
				: Effect.succeed(cents === 0 ? 0 : -cents);
		}),
		encode: SchemaGetter.transform((cents: number) => -cents / 100)
	})
);

const IsoDate = Schema.String.check(
	Schema.makeFilter((date: string) => isIsoDate(date) || 'Expected a YYYY-MM-DD date')
);

const SyncTransaction = Schema.Struct({
	transaction_id: Schema.String,
	account_id: Schema.String,
	amount: OutflowPositiveCents,
	date: IsoDate,
	name: Schema.NullOr(Schema.String),
	original_description: Schema.optionalKey(Schema.NullOr(Schema.String)),
	merchant_name: Schema.optionalKey(Schema.NullOr(Schema.String)),
	pending: Schema.Boolean
});

const SyncResponse = Schema.Struct({
	added: Schema.Array(SyncTransaction),
	next_cursor: Schema.String,
	has_more: Schema.Boolean
});

export interface SyncPage {
	added: readonly (typeof SyncTransaction.Type)[];
	nextCursor: string;
	hasMore: boolean;
}

export interface SyncRow {
	externalAccountId: string;

	sourceId: string;
	date: string;
	amount: number;
	bankText: string;
	merchantName?: string;
}

export const decodeSyncPage = (body: unknown): Effect.Effect<SyncPage, Schema.SchemaError> =>
	Schema.decodeUnknownEffect(SyncResponse)(body).pipe(
		Effect.map((response) => ({
			added: response.added,
			nextCursor: response.next_cursor,
			hasMore: response.has_more
		}))
	);

export function syncRowsOf(page: SyncPage, cutoverDate: string): SyncRow[] {
	return page.added.flatMap((transaction) => {
		if (transaction.pending || transaction.date < cutoverDate) return [];
		const bankText = clean(transaction.original_description) ?? clean(transaction.name);
		if (bankText === undefined) return [];
		const merchantName = clean(transaction.merchant_name);
		return [
			{
				externalAccountId: transaction.account_id,
				sourceId: transaction.transaction_id,
				date: transaction.date,
				amount: transaction.amount,
				bankText,
				...(merchantName === undefined ? {} : { merchantName })
			}
		];
	});
}

function clean(text: string | null | undefined) {
	const trimmed = text?.replace(/\s+/g, ' ').trim();
	return trimmed === '' ? undefined : trimmed;
}
