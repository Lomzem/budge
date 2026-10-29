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
	/** The other Account, which makes this a Transfer; it then has no Category and no Payee. */
	transferAccountId?: Id<'accounts'> | undefined;
}

/** Checks a hand-entered Transaction and resolves its Payee, creating it on first use. */
export async function transactionFields(
	ctx: MutationCtx,
	input: Omit<TransactionInput, 'transferAccountId'>
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

/**
 * Saves what the owner entered, as a new Transaction or over `existing`, which keeps whether it
 * is Cleared. With `transferAccountId` it saves both sides of a Transfer, creating the other side
 * uncleared if there is none yet. Without it, an existing Transfer's other side is deleted.
 */
export async function saveTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'> | null,
	{ transferAccountId, ...input }: TransactionInput
): Promise<Id<'transactions'>> {
	const fields = {
		...(await transactionFields(ctx, input)),
		cleared: existing?.cleared ?? 'uncleared'
	};
	const counterpart =
		existing?.transferTransactionId === undefined
			? null
			: await ctx.db.get('transactions', existing.transferTransactionId);
	if (transferAccountId === undefined) {
		if (counterpart !== null) await deleteOne(ctx, counterpart);
		if (existing === null) return await insertTransaction(ctx, fields);
		await replaceTransaction(ctx, existing, fields);
		return existing._id;
	}

	if ((await ctx.db.get('accounts', transferAccountId)) === null) throw publicError('NOT_FOUND');
	if (transferAccountId === fields.accountId) {
		throw publicError('INVALID_INPUT', 'Pick another Account to transfer with.');
	}
	if (fields.categoryId !== undefined || fields.payeeId !== undefined) {
		throw publicError('INVALID_INPUT', 'A Transfer has no Category or Payee.');
	}
	const other: TransactionFields = {
		accountId: transferAccountId,
		date: fields.date,
		amount: -fields.amount,
		...(fields.memo === undefined ? {} : { memo: fields.memo }),
		cleared: counterpart?.cleared ?? 'uncleared'
	};
	return await writeTransfer(ctx, { existing, fields }, { existing: counterpart, fields: other });
}

interface Side {
	existing: Doc<'transactions'> | null;
	fields: TransactionFields;
}

/** Writes both sides of a Transfer, each pointing at the other, and returns the first side. */
async function writeTransfer(ctx: MutationCtx, first: Side, second: Side) {
	for (const side of [first, second]) {
		if (side.existing !== null) await countTransaction(ctx, side.existing, -1);
	}
	const firstId = first.existing?._id ?? (await ctx.db.insert('transactions', first.fields));
	const secondFields = { ...second.fields, transferTransactionId: firstId };
	let secondId;
	if (second.existing === null) {
		secondId = await ctx.db.insert('transactions', secondFields);
	} else {
		secondId = second.existing._id;
		await ctx.db.replace('transactions', secondId, secondFields);
	}
	const firstFields = { ...first.fields, transferTransactionId: secondId };
	await ctx.db.replace('transactions', firstId, firstFields);
	await countTransaction(ctx, firstFields, 1);
	await countTransaction(ctx, secondFields, 1);
	return firstId;
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

/** Deletes a Transaction, and both sides when it is a Transfer. */
export async function deleteTransaction(ctx: MutationCtx, existing: Doc<'transactions'>) {
	if (existing.transferTransactionId !== undefined) {
		const counterpart = await ctx.db.get('transactions', existing.transferTransactionId);
		if (counterpart !== null) await deleteOne(ctx, counterpart);
	}
	await deleteOne(ctx, existing);
}

async function deleteOne(ctx: MutationCtx, existing: Doc<'transactions'>) {
	await countTransaction(ctx, existing, -1);
	await ctx.db.delete('transactions', existing._id);
}
