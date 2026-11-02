import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { addDays } from '../../src/lib/domain/dates';
import { MATCH_WINDOW_DAYS } from '../../src/lib/domain/matcher';
import { SPLIT_LINE_LIMIT } from '../../src/lib/domain/splits';
import { requireCents } from './input';
import { countTransaction, lineCounted } from './monthlyTotals';
import { payeeNamed, rememberCategory, rememberRename } from './payees';
import { requireCutoverDate, requireIsoDate } from './settings';
import { publicError } from './publicError';

export type TransactionFields = Omit<Doc<'transactions'>, '_id' | '_creationTime' | 'approved'> & {
	approved: boolean;
};

export interface SplitInput {
	categoryId: Id<'categories'>;
	amount: number;
	memo: string;
}

export type SplitLine = Pick<Doc<'transactionSplits'>, 'categoryId' | 'amount' | 'memo'>;

export interface TransactionInput {
	accountId: Id<'accounts'>;
	date: string;
	amount: number;
	payee: string;

	categoryId?: Id<'categories'> | undefined;
	memo: string;

	splits?: readonly SplitInput[] | undefined;

	transferAccountId?: Id<'accounts'> | undefined;

	transferTransactionId?: Id<'transactions'> | undefined;
}

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

async function requireCategoryFor(
	ctx: MutationCtx,
	categoryId: Id<'categories'>,
	accountId: Id<'accounts'>
) {
	const category = await ctx.db.get('categories', categoryId);
	if (category === null) throw publicError('NOT_FOUND');
	if (category.kind === 'creditCardPayment' && category.accountId !== accountId) {
		throw publicError('INVALID_INPUT', "A Payment Category takes only its card's starting debt.");
	}
}

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

export function requireUnlocked(
	transaction: Pick<Doc<'transactions'>, 'cleared'>,
	action: string,
	otherSide = false
) {
	if (transaction.cleared === 'reconciled') {
		throw publicError(
			'INVALID_INPUT',
			otherSide
				? `The other side of this Transfer is Reconciled. Unlock it in its Account ${action}.`
				: `This Transaction is Reconciled. Unlock it ${action}.`
		);
	}
}

function requireLockKept(
	existing: Doc<'transactions'> | null,
	fields: Pick<TransactionFields, 'accountId' | 'date' | 'amount'>,
	otherSide = false
) {
	if (
		existing !== null &&
		(existing.accountId !== fields.accountId ||
			existing.date !== fields.date ||
			existing.amount !== fields.amount)
	) {
		requireUnlocked(
			existing,
			otherSide
				? "to change this Transfer's amount or date"
				: 'to change its amount, date, or Account',
			otherSide
		);
	}
}

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
	requireLockKept(existing, fields);
	await rememberPayee(ctx, existing, fields);
	const counterpart =
		existing?.transferTransactionId === undefined
			? null
			: await ctx.db.get('transactions', existing.transferTransactionId);
	if (transferAccountId === undefined) {
		if (transferTransactionId !== undefined) {
			throw publicError('INVALID_INPUT', 'Pick the Account to transfer with.');
		}
		if (counterpart !== null) await deleteOtherSide(ctx, counterpart);
		if (existing === null) return await insertTransaction(ctx, fields, lines);
		await replaceTransaction(ctx, existing, fields, lines);
		return existing._id;
	}

	await requireTransfer(ctx, transferAccountId, fields, lines);
	const otherSide = await otherSideOf(
		ctx,
		counterpart,
		transferAccountId,
		transferTransactionId,
		fields
	);
	const other = otherSideFields(transferAccountId, fields, otherSide);
	requireLockKept(otherSide.existing, other, true);
	return await writeTransfer(
		ctx,
		{ existing, fields },
		{ existing: otherSide.existing, fields: other }
	);
}

async function rememberPayee(
	ctx: MutationCtx,
	existing: Doc<'transactions'> | null,
	fields: TransactionFields
) {
	const { payeeId, categoryId } = fields;
	if (payeeId === undefined) return;
	if (categoryId !== undefined) await rememberCategory(ctx, payeeId, categoryId);
	if (existing === null || existing.payeeId === payeeId) return;
	for (const bankRow of await bankRowsOf(ctx, existing._id)) {
		await rememberRename(ctx, bankRow.bankText, payeeId);
	}
}

async function requireTransfer(
	ctx: MutationCtx,
	transferAccountId: Id<'accounts'>,
	fields: TransactionFields,
	lines: SplitLine[]
) {
	const target = await ctx.db.get('accounts', transferAccountId);
	if (target === null) throw publicError('NOT_FOUND');
	if (transferAccountId === fields.accountId) {
		throw publicError('INVALID_INPUT', 'Pick another Account to transfer with.');
	}
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
}

interface OtherSide {
	existing: Doc<'transactions'> | null;

	linking: boolean;
}

async function otherSideOf(
	ctx: MutationCtx,
	counterpart: Doc<'transactions'> | null,
	transferAccountId: Id<'accounts'>,
	transferTransactionId: Id<'transactions'> | undefined,
	fields: TransactionFields
): Promise<OtherSide> {
	if (transferTransactionId === undefined || transferTransactionId === counterpart?._id) {
		return { existing: counterpart, linking: false };
	}
	const candidates = await transferCandidatesOf(ctx, transferAccountId, fields.date, fields.amount);
	const linked = candidates.find((candidate) => candidate._id === transferTransactionId);
	if (linked === undefined) {
		throw publicError(
			'INVALID_INPUT',
			'Link an imported Transaction with the opposite amount, within 10 days.'
		);
	}
	if (counterpart !== null) await deleteOtherSide(ctx, counterpart);
	return { existing: linked, linking: true };
}

function otherSideFields(
	transferAccountId: Id<'accounts'>,
	fields: TransactionFields,
	{ existing, linking }: OtherSide
): TransactionFields {
	return {
		accountId: transferAccountId,
		date: fields.date,
		amount: -fields.amount,
		...(fields.memo === undefined ? {} : { memo: fields.memo }),
		cleared: existing?.cleared ?? 'uncleared',
		approved: linking || existing?.approved !== false
	};
}

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
	await refreshSearchText(ctx, firstId);
	await refreshSearchText(ctx, secondId);
	return firstId;
}

export async function insertTransaction(
	ctx: MutationCtx,
	fields: TransactionFields,
	lines: readonly SplitLine[] = [],
	{ deferSearchText = false }: { deferSearchText?: boolean } = {}
) {
	const id = await ctx.db.insert('transactions', fields);
	await putIn(ctx, id, fields, lines);
	if (!deferSearchText) await refreshSearchText(ctx, id);
	return id;
}

export async function replaceTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'>,
	fields: TransactionFields,
	lines: readonly SplitLine[] = []
) {
	await takeOut(ctx, existing);
	await ctx.db.replace('transactions', existing._id, fields);
	await putIn(ctx, existing._id, fields, lines);
	await refreshSearchText(ctx, existing._id);
}

export async function refreshSearchText(ctx: MutationCtx, transactionId: Id<'transactions'>) {
	const transaction = await ctx.db.get('transactions', transactionId);
	if (transaction === null) return;
	const payee =
		transaction.payeeId === undefined ? null : await ctx.db.get('payees', transaction.payeeId);
	const lines = transaction.split === true ? await splitLinesOf(ctx, transactionId) : [];
	const searchText = [
		payee?.name,
		transaction.memo,
		...lines.map((line) => line.memo),
		...(await bankRowsOf(ctx, transactionId)).map((bankRow) => bankRow.bankText)
	]
		.filter((part) => part !== undefined && part !== '')
		.join(' ');
	if (transaction.searchText !== searchText) {
		await ctx.db.patch('transactions', transactionId, { searchText });
	}
}

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

async function takeOut(ctx: MutationCtx, existing: Doc<'transactions'>) {
	await countTransaction(ctx, existing, -1);
	for (const line of await splitLinesOf(ctx, existing._id)) {
		await countTransaction(ctx, lineCounted(existing, line), -1);
		await ctx.db.delete('transactionSplits', line._id);
	}
}

export async function splitLinesOf(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	return await ctx.db
		.query('transactionSplits')
		.withIndex('by_transaction', (q) => q.eq('transactionId', transactionId))
		.take(SPLIT_LINE_LIMIT);
}

export async function deleteTransaction(ctx: MutationCtx, existing: Doc<'transactions'>) {
	requireUnlocked(existing, 'to delete it');
	if (existing.transferTransactionId !== undefined) {
		const counterpart = await ctx.db.get('transactions', existing.transferTransactionId);
		if (counterpart !== null) {
			requireUnlocked(counterpart, 'to delete this Transfer', true);
			await deleteOne(ctx, counterpart);
		}
	}
	await deleteOne(ctx, existing);
}

async function deleteOtherSide(ctx: MutationCtx, counterpart: Doc<'transactions'>) {
	requireUnlocked(counterpart, 'to change this Transfer', true);
	await deleteOne(ctx, counterpart);
}

async function deleteOne(ctx: MutationCtx, existing: Doc<'transactions'>) {
	await takeOut(ctx, existing);
	await ctx.db.delete('transactions', existing._id);
	for (const bankRow of await bankRowsOf(ctx, existing._id)) {
		await ctx.db.patch('imports', bankRow._id, { transactionId: undefined, matched: false });
	}
}

export async function bankRowsOf(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	return await ctx.db
		.query('imports')
		.withIndex('by_transactionId', (q) => q.eq('transactionId', transactionId))
		.take(10);
}
