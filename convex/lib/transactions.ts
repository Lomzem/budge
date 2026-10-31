import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { addDays } from '../../src/lib/domain/dates';
import { MATCH_WINDOW_DAYS } from '../../src/lib/domain/matcher';
import { requireCents } from './input';
import { countTransaction } from './monthlyTotals';
import { payeeNamed, rememberCategory, rememberRename } from './payees';
import { requireCutoverDate, requireIsoDate } from './settings';
import { publicError } from './publicError';

export type TransactionFields = Omit<Doc<'transactions'>, '_id' | '_creationTime' | 'approved'> & {
	// Every write says whether the Transaction is approved; only old rows leave it out.
	approved: boolean;
};

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
	/**
	 * An imported Transaction in `transferAccountId` to link as the other side, in place of
	 * creating one. It must be one of `transferCandidatesOf`.
	 */
	transferTransactionId?: Id<'transactions'> | undefined;
}

/** Checks a hand-entered Transaction and resolves its Payee, creating it on first use. */
export async function transactionFields(
	ctx: MutationCtx,
	input: Omit<TransactionInput, 'transferAccountId' | 'transferTransactionId'>
): Promise<Omit<TransactionFields, 'cleared' | 'approved'>> {
	if ((await ctx.db.get('accounts', input.accountId)) === null) throw publicError('NOT_FOUND');
	requireIsoDate(input.date);
	if (input.date < (await requireCutoverDate(ctx))) {
		throw publicError('INVALID_INPUT', 'Budge starts on the cutover date; pick a later date.');
	}
	if (input.categoryId !== undefined) {
		const category = await ctx.db.get('categories', input.categoryId);
		if (category === null) throw publicError('NOT_FOUND');
		// Only a card's starting debt sits in its Payment Category, where the card's move cancels it.
		if (category.kind === 'creditCardPayment' && category.accountId !== input.accountId) {
			throw publicError('INVALID_INPUT', "A Payment Category takes only its card's starting debt.");
		}
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

/**
 * Refuses a change to a Reconciled Transaction other than its Category, Payee, or memo, until the
 * owner unlocks it.
 */
export function requireUnlocked(transaction: Pick<Doc<'transactions'>, 'cleared'>) {
	if (transaction.cleared === 'reconciled') {
		throw publicError(
			'INVALID_INPUT',
			'This Transaction is Reconciled. Unlock it to change its amount, date, or Account.'
		);
	}
}

/** Refuses saving `fields` over a Reconciled Transaction with another amount, date, or Account. */
function requireLockKept(
	existing: Doc<'transactions'> | null,
	fields: Pick<TransactionFields, 'accountId' | 'date' | 'amount'>
) {
	if (
		existing !== null &&
		(existing.accountId !== fields.accountId ||
			existing.date !== fields.date ||
			existing.amount !== fields.amount)
	) {
		requireUnlocked(existing);
	}
}

/**
 * Saves what the owner entered, as a new Transaction or over `existing`, which keeps whether it
 * is Cleared. A Reconciled one, or the Reconciled other side of a Transfer, keeps its amount, date,
 * and Account. Saving approves it. With `transferAccountId` it saves both sides of a Transfer,
 * creating the other side uncleared and approved if there is none yet; an existing other side keeps
 * whether it is Cleared and approved. With `transferTransactionId` as well, that imported
 * Transaction becomes the other side, approved, in place of any other side there was. Without
 * `transferAccountId`, an existing Transfer's other side is deleted. Giving the Payee a Category
 * updates Payee memory, and renaming the Payee of an imported Transaction updates rename memory
 * for each of its Bank Texts.
 */
export async function saveTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'> | null,
	{ transferAccountId, transferTransactionId, ...input }: TransactionInput
): Promise<Id<'transactions'>> {
	const fields = {
		...(await transactionFields(ctx, input)),
		cleared: existing?.cleared ?? 'uncleared',
		approved: true
	};
	requireLockKept(existing, fields);
	if (fields.payeeId !== undefined) {
		if (fields.categoryId !== undefined) {
			await rememberCategory(ctx, fields.payeeId, fields.categoryId);
		}
		if (existing !== null && existing.payeeId !== fields.payeeId) {
			for (const bankRow of await bankRowsOf(ctx, existing._id)) {
				await rememberRename(ctx, bankRow.bankText, fields.payeeId);
			}
		}
	}
	const counterpart =
		existing?.transferTransactionId === undefined
			? null
			: await ctx.db.get('transactions', existing.transferTransactionId);
	if (transferAccountId === undefined) {
		if (transferTransactionId !== undefined) {
			throw publicError('INVALID_INPUT', 'Pick the Account to transfer with.');
		}
		if (counterpart !== null) await deleteOne(ctx, counterpart);
		if (existing === null) return await insertTransaction(ctx, fields);
		await replaceTransaction(ctx, existing, fields);
		return existing._id;
	}

	const target = await ctx.db.get('accounts', transferAccountId);
	if (target === null) throw publicError('NOT_FOUND');
	if (transferAccountId === fields.accountId) {
		throw publicError('INVALID_INPUT', 'Pick another Account to transfer with.');
	}
	// A Transfer is between two Cash Accounts, or a card payment: money from a Cash Account into
	// a Credit Card Account, entered from either side.
	const source = await ctx.db.get('accounts', fields.accountId);
	if (source?.kind !== 'cash' && target.kind !== 'cash') {
		throw publicError('INVALID_INPUT', 'A Transfer needs a Cash Account on one side.');
	}
	const cashSideAmount = source?.kind === 'cash' ? fields.amount : -fields.amount;
	if ((source?.kind !== 'cash' || target.kind !== 'cash') && cashSideAmount > 0) {
		throw publicError('INVALID_INPUT', 'A card payment moves money from a Cash Account.');
	}
	if (fields.categoryId !== undefined || fields.payeeId !== undefined) {
		throw publicError('INVALID_INPUT', 'A Transfer has no Category or Payee.');
	}
	let otherSide = counterpart;
	let linking = false;
	if (transferTransactionId !== undefined && transferTransactionId !== counterpart?._id) {
		const candidates = await transferCandidatesOf(
			ctx,
			transferAccountId,
			fields.date,
			fields.amount
		);
		const linked = candidates.find((candidate) => candidate._id === transferTransactionId);
		if (linked === undefined) {
			throw publicError(
				'INVALID_INPUT',
				'Link an imported Transaction with the opposite amount, within 10 days.'
			);
		}
		if (counterpart !== null) await deleteOne(ctx, counterpart);
		otherSide = linked;
		linking = true;
	}
	const other: TransactionFields = {
		accountId: transferAccountId,
		date: fields.date,
		amount: -fields.amount,
		...(fields.memo === undefined ? {} : { memo: fields.memo }),
		cleared: otherSide?.cleared ?? 'uncleared',
		// Picking the import to link reviews it.
		approved: linking || otherSide?.approved !== false
	};
	requireLockKept(otherSide, other);
	return await writeTransfer(ctx, { existing, fields }, { existing: otherSide, fields: other });
}

/**
 * The imported Transactions in `accountId` that could be the other side of a Transfer of `amount`
 * on `date`: not yet a Transfer side, with the opposite amount, dated within the match window.
 */
export async function transferCandidatesOf(
	ctx: QueryCtx,
	accountId: Id<'accounts'>,
	date: string,
	amount: number
) {
	const candidates: Doc<'transactions'>[] = [];
	const nearby = ctx.db
		.query('transactions')
		.withIndex('by_account_date', (q) =>
			q
				.eq('accountId', accountId)
				.gte('date', addDays(date, -MATCH_WINDOW_DAYS))
				.lte('date', addDays(date, MATCH_WINDOW_DAYS))
		);
	for await (const transaction of nearby) {
		if (transaction.amount !== -amount || transaction.transferTransactionId !== undefined) continue;
		if ((await bankRowsOf(ctx, transaction._id)).length === 0) continue;
		candidates.push(transaction);
	}
	return candidates;
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

/** Deletes a Transaction, and both sides when it is a Transfer; neither may be Reconciled. */
export async function deleteTransaction(ctx: MutationCtx, existing: Doc<'transactions'>) {
	if (existing.transferTransactionId !== undefined) {
		const counterpart = await ctx.db.get('transactions', existing.transferTransactionId);
		if (counterpart !== null) await deleteOne(ctx, counterpart);
	}
	await deleteOne(ctx, existing);
}

async function deleteOne(ctx: MutationCtx, existing: Doc<'transactions'>) {
	requireUnlocked(existing);
	await countTransaction(ctx, existing, -1);
	await ctx.db.delete('transactions', existing._id);
	// Its Bank Rows stay, unlinked, so importing the same file again doesn't bring it back.
	for (const bankRow of await bankRowsOf(ctx, existing._id)) {
		await ctx.db.patch('imports', bankRow._id, { transactionId: undefined, matched: false });
	}
}

/** The Bank Rows linked to a Transaction: at most one per source. */
export async function bankRowsOf(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	return await ctx.db
		.query('imports')
		.withIndex('by_transactionId', (q) => q.eq('transactionId', transactionId))
		.take(10);
}
