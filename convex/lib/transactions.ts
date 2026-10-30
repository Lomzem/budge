import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { addDays } from '../../src/lib/domain/dates';
import { MATCH_WINDOW_DAYS } from '../../src/lib/domain/matcher';
import { requireCents } from './input';
import { countTransaction, lineCounted } from './monthlyTotals';
import { requireCutoverDate, requireIsoDate } from './settings';
import { publicError } from './publicError';

/** The most lines one split takes. */
export const SPLIT_LINE_LIMIT = 50;

export type TransactionFields = Omit<Doc<'transactions'>, '_id' | '_creationTime' | 'approved'> & {
	// Every write says whether the Transaction is approved; only old rows leave it out.
	approved: boolean;
};

/** One line of a split Transaction, as the owner enters it. */
export interface SplitInput {
	categoryId: Id<'categories'>;
	amount: number;
	memo: string;
}

/** A checked split line, before it takes its Transaction's ID and date. */
export type SplitLine = Pick<Doc<'transactionSplits'>, 'categoryId' | 'amount' | 'memo'>;

/** What the owner enters for a Transaction; the Payee is a name, blank for none. */
export interface TransactionInput {
	accountId: Id<'accounts'>;
	date: string;
	amount: number;
	payee: string;
	/** Left out for Uncategorized, and for a split. */
	categoryId?: Id<'categories'> | undefined;
	memo: string;
	/** Two or more lines summing to `amount`, which split the Transaction across Categories. */
	splits?: readonly SplitInput[] | undefined;
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
	input: Omit<TransactionInput, 'transferAccountId' | 'transferTransactionId' | 'splits'>
): Promise<Omit<TransactionFields, 'cleared' | 'approved'>> {
	if ((await ctx.db.get('accounts', input.accountId)) === null) throw publicError('NOT_FOUND');
	requireIsoDate(input.date);
	if (input.date < (await requireCutoverDate(ctx))) {
		throw publicError('INVALID_INPUT', 'Budge starts on the cutover date; pick a later date.');
	}
	if (input.categoryId !== undefined) {
		await requireCategoryFor(ctx, input.categoryId, input.accountId);
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

/** Checks that a Transaction in `accountId`, or one of its split lines, may take this Category. */
async function requireCategoryFor(
	ctx: MutationCtx,
	categoryId: Id<'categories'>,
	accountId: Id<'accounts'>
) {
	const category = await ctx.db.get('categories', categoryId);
	if (category === null) throw publicError('NOT_FOUND');
	// Only a card's starting debt sits in its Payment Category, where the card's move cancels it.
	if (category.kind === 'creditCardPayment' && category.accountId !== accountId) {
		throw publicError('INVALID_INPUT', "A Payment Category takes only its card's starting debt.");
	}
}

/**
 * Checks a split's lines: two or more, each with a Category it may take, summing to the
 * Transaction's amount. No lines means the Transaction isn't split.
 */
async function splitLines(
	ctx: MutationCtx,
	input: Omit<TransactionInput, 'transferAccountId'>
): Promise<SplitLine[]> {
	if (input.splits === undefined || input.splits.length === 0) return [];
	if (input.categoryId !== undefined) {
		throw publicError('INVALID_INPUT', 'A split Transaction takes its Categories on its lines.');
	}
	if (input.splits.length < 2 || input.splits.length > SPLIT_LINE_LIMIT) {
		throw publicError('INVALID_INPUT', `A split takes 2 to ${String(SPLIT_LINE_LIMIT)} lines.`);
	}
	const lines: SplitLine[] = [];
	let sum = 0;
	for (const split of input.splits) {
		await requireCategoryFor(ctx, split.categoryId, input.accountId);
		const amount = requireCents(split.amount);
		sum += amount;
		const memo = split.memo.trim();
		lines.push({ categoryId: split.categoryId, amount, ...(memo === '' ? {} : { memo }) });
	}
	if (sum !== requireCents(input.amount)) {
		throw publicError('INVALID_INPUT', "The split lines must add up to the Transaction's amount.");
	}
	return lines;
}

/** The Payee with this exact trimmed name, created on first use; none for a blank name. */
export async function payeeNamed(
	ctx: MutationCtx,
	name: string
): Promise<Id<'payees'> | undefined> {
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
 * is Cleared. Saving approves it. With `transferAccountId` it saves both sides of a Transfer,
 * creating the other side uncleared and approved if there is none yet; an existing other side keeps
 * whether it is Cleared and approved. With `transferTransactionId` as well, that imported
 * Transaction becomes the other side, approved, in place of any other side there was. Without
 * `transferAccountId`, an existing Transfer's other side is deleted. With `splits` it saves the
 * lines in place of any it had; without them, an existing split's lines are deleted.
 */
export async function saveTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'> | null,
	{ transferAccountId, transferTransactionId, ...input }: TransactionInput
): Promise<Id<'transactions'>> {
	const lines = await splitLines(ctx, input);
	const fields: TransactionFields = {
		...(await transactionFields(ctx, input)),
		...(lines.length === 0 ? {} : { split: true }),
		cleared: existing?.cleared ?? 'uncleared',
		approved: true
	};
	const counterpart =
		existing?.transferTransactionId === undefined
			? null
			: await ctx.db.get('transactions', existing.transferTransactionId);
	if (transferAccountId === undefined) {
		if (transferTransactionId !== undefined) {
			throw publicError('INVALID_INPUT', 'Pick the Account to transfer with.');
		}
		if (counterpart !== null) await deleteOne(ctx, counterpart);
		if (existing === null) return await insertTransaction(ctx, fields, lines);
		await replaceTransaction(ctx, existing, fields, lines);
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
	if (fields.categoryId !== undefined || fields.payeeId !== undefined || lines.length > 0) {
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
		if (side.existing !== null) await takeOut(ctx, side.existing);
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

// Every Transaction write goes through these three, so the monthly totals and split lines stay in
// step. `lines` are a split's, given with `split: true` in `fields`.

export async function insertTransaction(
	ctx: MutationCtx,
	fields: TransactionFields,
	lines: readonly SplitLine[] = []
) {
	const id = await ctx.db.insert('transactions', fields);
	await putIn(ctx, id, fields, lines);
	return id;
}

/** Writes `fields` over `existing`, with `lines` in place of the lines it had. */
export async function replaceTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'>,
	fields: TransactionFields,
	lines: readonly SplitLine[] = []
) {
	await takeOut(ctx, existing);
	await ctx.db.replace('transactions', existing._id, fields);
	await putIn(ctx, existing._id, fields, lines);
}

/** Counts a written Transaction, and writes its split lines with its date and counts them. */
async function putIn(
	ctx: MutationCtx,
	transactionId: Id<'transactions'>,
	fields: TransactionFields,
	lines: readonly SplitLine[]
) {
	await countTransaction(ctx, fields, 1);
	for (const line of lines) {
		const written = { ...line, transactionId, date: fields.date };
		await ctx.db.insert('transactionSplits', written);
		await countTransaction(ctx, lineCounted(fields, written), 1);
	}
}

/** Takes a Transaction out of the monthly totals, and deletes its split lines. */
async function takeOut(ctx: MutationCtx, existing: Doc<'transactions'>) {
	await countTransaction(ctx, existing, -1);
	for (const line of await splitLinesOf(ctx, existing._id)) {
		await countTransaction(ctx, lineCounted(existing, line), -1);
		await ctx.db.delete('transactionSplits', line._id);
	}
}

/** A split Transaction's lines, in the order they were entered. */
export async function splitLinesOf(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	return await ctx.db
		.query('transactionSplits')
		.withIndex('by_transaction', (q) => q.eq('transactionId', transactionId))
		.take(SPLIT_LINE_LIMIT);
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
	await takeOut(ctx, existing);
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
