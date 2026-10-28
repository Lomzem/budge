import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { requireCents } from './input';
import { countTransaction } from './monthlyTotals';
import { requireCutoverDate, requireIsoDate } from './settings';
import { publicError } from './publicError';

export type TransactionFields = Omit<Doc<'transactions'>, '_id' | '_creationTime'>;

/** What the owner enters for a Transaction; the Payee is a name, blank for none. */
export interface TransactionInput {
	accountId: Id<'accounts'>;
	date: string;
	amount: number;
	payee: string;
	/** Left out for Uncategorized. */
	categoryId?: Id<'categories'> | undefined;
	memo: string;
}

/** Checks a hand-entered Transaction and resolves its Payee, creating it on first use. */
export async function transactionFields(
	ctx: MutationCtx,
	input: TransactionInput
): Promise<Omit<TransactionFields, 'cleared'>> {
	if ((await ctx.db.get('accounts', input.accountId)) === null) throw publicError('NOT_FOUND');
	requireIsoDate(input.date);
	if (input.date < (await requireCutoverDate(ctx))) {
		throw publicError('INVALID_INPUT', 'Budge starts on the cutover date; pick a later date.');
	}
	if (
		input.categoryId !== undefined &&
		(await ctx.db.get('categories', input.categoryId)) === null
	) {
		throw publicError('NOT_FOUND');
	}
	const payeeId = await payeeNamed(ctx, input.payee);
	const memo = input.memo.trim();
	return {
		accountId: input.accountId,
		date: input.date,
		amount: requireCents(input.amount),
		...(payeeId === undefined ? {} : { payeeId }),
		...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
		...(memo === '' ? {} : { memo })
	};
}

async function payeeNamed(ctx: MutationCtx, name: string): Promise<Id<'payees'> | undefined> {
	const trimmed = name.trim();
	if (trimmed === '') return undefined;
	const existing = await ctx.db
		.query('payees')
		.withIndex('by_name', (q) => q.eq('name', trimmed))
		.first();
	return existing?._id ?? (await ctx.db.insert('payees', { name: trimmed }));
}

// Every Transaction write goes through these three, so the monthly totals stay in step.

export async function insertTransaction(ctx: MutationCtx, fields: TransactionFields) {
	const id = await ctx.db.insert('transactions', fields);
	await countTransaction(ctx, fields, 1);
	return id;
}

export async function replaceTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'>,
	fields: TransactionFields
) {
	await countTransaction(ctx, existing, -1);
	await ctx.db.replace('transactions', existing._id, fields);
	await countTransaction(ctx, fields, 1);
}

export async function deleteTransaction(ctx: MutationCtx, existing: Doc<'transactions'>) {
	await countTransaction(ctx, existing, -1);
	await ctx.db.delete('transactions', existing._id);
}
