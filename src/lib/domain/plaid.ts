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

const RemovedTransaction = Schema.Struct({
	transaction_id: Schema.String,
	account_id: Schema.String
});

const SyncResponse = Schema.Struct({
	added: Schema.Array(SyncTransaction),
	modified: Schema.Array(SyncTransaction),
	removed: Schema.Array(RemovedTransaction),
	next_cursor: Schema.String,
	has_more: Schema.Boolean
});

export interface SyncPage {
	added: readonly (typeof SyncTransaction.Type)[];
	modified: readonly (typeof SyncTransaction.Type)[];
	removed: readonly (typeof RemovedTransaction.Type)[];
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

export interface SyncRemoval {
	externalAccountId: string;
	sourceId: string;
}

export interface SyncChanges {
	added: SyncRow[];
	modified: SyncRow[];
	removed: SyncRemoval[];
}

export const decodeSyncPage = (body: unknown): Effect.Effect<SyncPage, Schema.SchemaError> =>
	Schema.decodeUnknownEffect(SyncResponse)(body).pipe(
		Effect.map((response) => ({
			added: response.added,
			modified: response.modified,
			removed: response.removed,
			nextCursor: response.next_cursor,
			hasMore: response.has_more
		}))
	);

export function syncRowsOf(page: SyncPage, cutoverDate: string): SyncChanges {
	return {
		added: bankRowsOf(page.added, cutoverDate),
		modified: bankRowsOf(page.modified, cutoverDate),
		removed: [
			...page.removed.map((removal) => ({
				externalAccountId: removal.account_id,
				sourceId: removal.transaction_id
			})),
			...page.modified
				.filter((transaction) => transaction.date < cutoverDate)
				.map((transaction) => ({
					externalAccountId: transaction.account_id,
					sourceId: transaction.transaction_id
				}))
		]
	};
}

function bankRowsOf(
	transactions: readonly (typeof SyncTransaction.Type)[],
	cutoverDate: string
): SyncRow[] {
	return transactions.flatMap((transaction) => {
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

const Cents = Schema.Finite.pipe(
	Schema.decodeTo(Schema.Finite, {
		decode: SchemaGetter.transformEffect((amount: number) => {
			const cents = parseCents(String(amount));
			return cents === undefined
				? Effect.fail(new SchemaIssue.InvalidValue({ message: 'Expected dollars and cents' }))
				: Effect.succeed(cents);
		}),
		encode: SchemaGetter.transform((cents: number) => cents / 100)
	})
);

const PlaidAccount = Schema.Struct({
	account_id: Schema.String,
	name: Schema.String,
	mask: Schema.optionalKey(Schema.NullOr(Schema.String)),
	type: Schema.String,
	balances: Schema.Struct({ current: Schema.NullOr(Cents) })
});

const AccountsResponse = Schema.Struct({ accounts: Schema.Array(PlaidAccount) });

export type BankAccountKind = 'cash' | 'creditCard';

export interface BankAccount {
	externalId: string;
	name: string;
	mask?: string;

	kind?: BankAccountKind;
	balance: number | null;
}

const OWED_TYPES = new Set(['credit', 'loan']);

function suggestedKind(type: string): BankAccountKind | undefined {
	if (OWED_TYPES.has(type)) return 'creditCard';
	return type === 'depository' ? 'cash' : undefined;
}

function budgetSigned(type: string, current: number) {
	return OWED_TYPES.has(type) && current !== 0 ? -current : current;
}

export const decodeAccounts = (body: unknown): Effect.Effect<BankAccount[], Schema.SchemaError> =>
	Schema.decodeUnknownEffect(AccountsResponse)(body).pipe(
		Effect.map((response) =>
			response.accounts.map((account) => {
				const current = account.balances.current;
				const mask = clean(account.mask);
				const kind = suggestedKind(account.type);
				return {
					externalId: account.account_id,
					name: clean(account.name) ?? 'Bank account',
					...(mask === undefined ? {} : { mask }),
					...(kind === undefined ? {} : { kind }),
					balance: current === null ? null : budgetSigned(account.type, current)
				};
			})
		)
	);

function clean(text: string | null | undefined) {
	const trimmed = text?.replace(/\s+/g, ' ').trim();
	return trimmed === '' ? undefined : trimmed;
}
