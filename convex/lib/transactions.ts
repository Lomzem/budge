import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { WithoutSystemFields } from 'convex/server';
import { addDays, monthOf } from '../../src/lib/domain/dates';
import { MATCH_WINDOW_DAYS } from '../../src/lib/domain/matcher';
import { SPLIT_LINE_LIMIT } from '../../src/lib/domain/splits';
import { requireCents } from './input';
import {
	countTransaction,
	countTransactions,
	lineCounted,
	rebuildTotals,
	type Counted
} from './monthlyTotals';
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

const STARTING_BALANCE_LABEL = 'Starting Balance';

export async function payeeNameOf(
	ctx: QueryCtx,
	transaction: Pick<Doc<'transactions'>, 'kind' | 'payeeId'>,
	readPayee: (payeeId: Id<'payees'>) => Promise<Doc<'payees'> | null> = (payeeId) =>
		ctx.db.get('payees', payeeId)
): Promise<string | null> {
	if (transaction.kind === 'startingBalance') return STARTING_BALANCE_LABEL;
	if (transaction.payeeId === undefined) return null;
	return (await readPayee(transaction.payeeId))?.name ?? null;
}

function requireStartingBalanceEditable(
	existing: Doc<'transactions'>,
	input: Pick<TransactionInput, 'accountId' | 'payee' | 'splits' | 'transferAccountId'>
) {
	const payee = input.payee.trim();
	const refusals: readonly (readonly [boolean, string])[] = [
		[
			input.accountId !== existing.accountId,
			"A starting balance stays in its Account. Set the other Account's starting balance instead."
		],
		[
			(input.splits ?? []).length > 0,
			'A starting balance takes one Category. Record the rest as its own Transaction.'
		],
		[
			input.transferAccountId !== undefined,
			'A starting balance cannot be a Transfer. Record the Transfer as its own Transaction.'
		],
		[
			payee !== '' && payee !== STARTING_BALANCE_LABEL,
			'A starting balance has no Payee. Record a Transaction with that Payee instead.'
		]
	];
	const refused = refusals.find(([applies]) => applies);
	if (refused !== undefined) throw publicError('INVALID_INPUT', refused[1]);
}

function editableInput(
	existing: Doc<'transactions'> | null,
	given: Omit<TransactionInput, 'transferAccountId' | 'transferTransactionId'>,
	transferAccountId: Id<'accounts'> | undefined
) {
	if (existing?.kind !== 'startingBalance') return given;
	requireStartingBalanceEditable(existing, { ...given, transferAccountId });
	return { ...given, payee: '' };
}

export interface SaveOptions {
	approve?: boolean;

	rememberCategory: boolean;
}

export async function saveTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'> | null,
	{ transferAccountId, transferTransactionId, ...given }: TransactionInput,
	{ approve = true, rememberCategory }: SaveOptions
): Promise<Id<'transactions'>> {
	const input = editableInput(existing, given, transferAccountId);
	const lines = await splitLines(ctx, input);
	const fields: TransactionFields = {
		...(await transactionFields(ctx, input)),
		...(lines.length === 0 ? {} : { split: true }),
		cleared: existing?.cleared ?? 'uncleared',
		approved: approve || existing?.approved !== false
	};
	requireLockKept(existing, fields);
	await rememberPayee(ctx, existing, fields, rememberCategory);
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

export type CategoryChoice =
	| { kind: 'uncategorized' }
	| { kind: 'category'; categoryId: Id<'categories'>; remember?: boolean | undefined }
	| { kind: 'transfer'; accountId: Id<'accounts'> };

export async function categorizeTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'>,
	choice: CategoryChoice
) {
	if (existing.split === true) {
		throw publicError('INVALID_INPUT', 'A split Transaction takes its Categories on its lines.');
	}
	const payee = choice.kind === 'transfer' ? '' : ((await payeeNameOf(ctx, existing)) ?? '');
	await saveTransaction(
		ctx,
		existing,
		{
			accountId: existing.accountId,
			date: existing.date,
			amount: existing.amount,
			payee,
			memo: existing.memo ?? '',
			...(choice.kind === 'category' ? { categoryId: choice.categoryId } : {}),
			...(choice.kind === 'transfer' ? { transferAccountId: choice.accountId } : {})
		},
		{ approve: false, rememberCategory: choice.kind === 'category' && choice.remember === true }
	);
}

async function rememberPayee(
	ctx: MutationCtx,
	existing: Doc<'transactions'> | null,
	fields: TransactionFields,
	rememberItsCategory: boolean
) {
	const { payeeId, categoryId } = fields;
	if (rememberItsCategory) {
		if (payeeId === undefined || categoryId === undefined) {
			throw publicError('INVALID_INPUT', 'Only a Category given to a Payee can be remembered.');
		}
		await rememberCategory(ctx, payeeId, categoryId);
	}
	if (payeeId === undefined) return;
	if (existing === null || existing.payeeId === payeeId) return;
	for await (const bankRow of allBankRowsOf(ctx, existing._id)) {
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
		if (
			transaction.amount !== -amount ||
			transaction.transferTransactionId !== undefined ||
			transaction.kind !== undefined
		) {
			continue;
		}
		if (!(await hasBankRow(ctx, transaction._id))) continue;
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
	await refreshDerivedFields(ctx, firstId);
	await refreshDerivedFields(ctx, secondId);
	return firstId;
}

export async function insertTransaction(
	ctx: MutationCtx,
	fields: TransactionFields,
	lines: readonly SplitLine[] = []
) {
	const id = await insertCounted(ctx, fields, lines);
	await refreshDerivedFields(ctx, id);
	return id;
}

async function insertCounted(
	ctx: MutationCtx,
	fields: TransactionFields,
	lines: readonly SplitLine[]
) {
	const id = await ctx.db.insert('transactions', fields);
	await putIn(ctx, id, fields, lines);
	return id;
}

export async function replaceTransaction(
	ctx: MutationCtx,
	existing: Doc<'transactions'>,
	fields: TransactionFields,
	lines: readonly SplitLine[]
) {
	await takeOut(ctx, existing);
	await ctx.db.replace(
		'transactions',
		existing._id,
		existing.kind === undefined ? fields : { ...fields, kind: existing.kind }
	);
	await putIn(ctx, existing._id, fields, lines);
	await refreshDerivedFields(ctx, existing._id);
}

export type ImportedFields = Omit<TransactionFields, 'cleared' | 'approved'>;

export type IncomingBankRow = Omit<
	Doc<'imports'>,
	'_id' | '_creationTime' | 'accountId' | 'transactionId' | 'matched' | 'state' | 'merchantName'
> & { accountId: Id<'accounts'>; heldId?: Id<'imports'> | undefined };

export async function addImportedTransaction(
	ctx: MutationCtx,
	fields: ImportedFields,
	bankRow: IncomingBankRow
) {
	const transactionId = await insertCounted(
		ctx,
		{ ...fields, cleared: 'cleared', approved: false },
		[]
	);
	await attachBankRow(ctx, transactionId, false, bankRow);
	return transactionId;
}

export async function matchBankRow(
	ctx: MutationCtx,
	transactionId: Id<'transactions'>,
	bankRow: IncomingBankRow
) {
	const matched = await ctx.db.get('transactions', transactionId);
	await ctx.db.patch('transactions', transactionId, {
		cleared: matched?.cleared === 'reconciled' ? 'reconciled' : 'cleared',
		approved: false
	});
	await attachBankRow(ctx, transactionId, true, bankRow);
}

async function attachBankRow(
	ctx: MutationCtx,
	transactionId: Id<'transactions'>,
	matched: boolean,
	{ heldId, ...bankRow }: IncomingBankRow
) {
	if (heldId === undefined) {
		await ctx.db.insert('imports', { ...bankRow, transactionId, matched, state: 'linked' });
	} else {
		await ctx.db.patch('imports', heldId, {
			accountId: bankRow.accountId,
			transactionId,
			matched,
			state: 'linked',
			merchantName: undefined
		});
	}
	await refreshDerivedFields(ctx, transactionId);
}

export async function unmatchBankRow(
	ctx: MutationCtx,
	bankRowId: Id<'imports'>,
	matchedId: Id<'transactions'>,
	fields: ImportedFields
) {
	const matched = await ctx.db.get('transactions', matchedId);
	if (matched !== null) requireUnlocked(matched, 'to unmatch it');
	const transactionId = await insertCounted(
		ctx,
		{ ...fields, cleared: 'cleared', approved: false },
		[]
	);
	await ctx.db.patch('imports', bankRowId, { transactionId, matched: false, state: 'linked' });
	await refreshDerivedFields(ctx, transactionId);
	await refreshDerivedFields(ctx, matchedId);
	if (!(await hasBankRow(ctx, matchedId))) {
		await ctx.db.patch('transactions', matchedId, { cleared: 'uncleared', approved: true });
	}
	return transactionId;
}

export async function keepAfterBankRemoval(
	ctx: MutationCtx,
	bankRowId: Id<'imports'>,
	transactionId: Id<'transactions'>
) {
	await ctx.db.patch('imports', bankRowId, { transactionId: undefined, matched: false });
	await ctx.db.patch('transactions', transactionId, { approved: true });
	await refreshDerivedFields(ctx, transactionId);
}

export interface BankRowChange {
	date?: string;
	amount?: number;
	bankText?: string;
	merchantName?: string | undefined;
	state?: Doc<'imports'>['state'];
}

export async function updateBankRow(
	ctx: MutationCtx,
	bankRow: Pick<Doc<'imports'>, '_id' | 'bankText' | 'transactionId'>,
	change: BankRowChange
) {
	await ctx.db.patch('imports', bankRow._id, change);
	const bankTextChanged = change.bankText !== undefined && change.bankText !== bankRow.bankText;
	const derivedChanged = bankTextChanged || change.state !== undefined;
	if (derivedChanged && bankRow.transactionId !== undefined) {
		await refreshDerivedFields(ctx, bankRow.transactionId);
	}
}

export async function holdBankRow(
	ctx: MutationCtx,
	bankRow: Omit<Doc<'imports'>, '_id' | '_creationTime' | 'transactionId' | 'matched' | 'state'>
) {
	await ctx.db.insert('imports', { ...bankRow, matched: false, state: 'held' });
}

export async function dropHeldBankRow(ctx: MutationCtx, heldId: Id<'imports'>) {
	await ctx.db.delete('imports', heldId);
}

export async function markCleared(
	ctx: MutationCtx,
	transactionId: Id<'transactions'>,
	cleared: Doc<'transactions'>['cleared']
) {
	await ctx.db.patch('transactions', transactionId, { cleared });
}

export async function markApproved(ctx: MutationCtx, transactionId: Id<'transactions'>) {
	await ctx.db.patch('transactions', transactionId, { approved: true });
}

export async function markUnapproved(ctx: MutationCtx, transactionId: Id<'transactions'>) {
	await ctx.db.patch('transactions', transactionId, { approved: false });
}

export async function moveCategoryHistory(
	ctx: MutationCtx,
	from: Id<'categories'>,
	to: Id<'categories'>
) {
	const monthAccountKeysMoved = new Map<string, { month: string; accountId: Id<'accounts'> }>();
	const transactions = ctx.db
		.query('transactions')
		.withIndex('by_category_date', (q) => q.eq('categoryId', from));
	for await (const transaction of transactions) {
		const key = { month: monthOf(transaction.date), accountId: transaction.accountId };
		monthAccountKeysMoved.set(`${key.month}|${key.accountId}`, key);
		await ctx.db.patch('transactions', transaction._id, { categoryId: to });
	}
	const lines = ctx.db
		.query('transactionSplits')
		.withIndex('by_category_date', (q) => q.eq('categoryId', from));
	for await (const line of lines) {
		const parent = await ctx.db.get('transactions', line.transactionId);
		if (parent === null) continue;
		const key = { month: monthOf(line.date), accountId: parent.accountId };
		monthAccountKeysMoved.set(`${key.month}|${key.accountId}`, key);
		await ctx.db.patch('transactionSplits', line._id, { categoryId: to });
	}
	await rebuildTotals(ctx, [from, to], monthAccountKeysMoved.values());
}

export const PAYEE_RENAME_BATCH = 50;

export async function refreshPayeeSearchText(
	ctx: MutationCtx,
	payeeId: Id<'payees'>,
	cursor: string | null
) {
	const { page, isDone, continueCursor } = await ctx.db
		.query('transactions')
		.withIndex('by_payee_date', (q) => q.eq('payeeId', payeeId))
		.paginate({ numItems: PAYEE_RENAME_BATCH, cursor });
	for (const transaction of page) await refreshDerivedFields(ctx, transaction._id);
	if (!isDone) {
		await ctx.scheduler.runAfter(0, internal.payees.refreshSearchText, {
			payeeId,
			cursor: continueCursor
		});
	}
}

export async function refreshDerivedFields(ctx: MutationCtx, transactionId: Id<'transactions'>) {
	const transaction = await ctx.db.get('transactions', transactionId);
	if (transaction === null) return;
	const lines = transaction.split === true ? await splitLinesOf(ctx, transactionId) : [];
	const bankRows = await bankRowsOf(ctx, transactionId);
	const searchText = [
		await payeeNameOf(ctx, transaction),
		transaction.memo,
		...lines.map((line) => line.memo),
		...bankRows.map((bankRow) => bankRow.bankText)
	]
		.filter((part) => part !== undefined && part !== null && part !== '')
		.join(' ');
	const bankChange = bankRows.some(
		(bankRow) => bankRow.state === 'changed' || bankRow.state === 'removed'
	)
		? (true as const)
		: undefined;
	if (transaction.searchText !== searchText || transaction.bankChange !== bankChange) {
		await ctx.db.patch('transactions', transactionId, { searchText, bankChange });
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
	return await splitLineRows(ctx, transactionId).take(SPLIT_LINE_LIMIT);
}

export function splitLineRows(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	return ctx.db
		.query('transactionSplits')
		.withIndex('by_transaction', (q) => q.eq('transactionId', transactionId));
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
	const detached: Id<'imports'>[] = [];
	for await (const bankRow of allBankRowsOf(ctx, existing._id)) detached.push(bankRow._id);
	await keepAsBankMemory(ctx, detached);
}

async function keepAsBankMemory(ctx: MutationCtx, bankRowIds: readonly Id<'imports'>[]) {
	for (const bankRowId of bankRowIds) {
		await ctx.db.patch('imports', bankRowId, { transactionId: undefined, matched: false });
	}
}

export interface EarlierTransaction {
	transaction: Doc<'transactions'>;
	lines: readonly Doc<'transactionSplits'>[];
	bankRows: readonly Doc<'imports'>[];
}

export async function removeEarlierHistory(
	ctx: MutationCtx,
	history: readonly EarlierTransaction[]
) {
	const removed = new Set(history.map(({ transaction }) => transaction._id));
	const oneSided = history.some(
		({ transaction: { transferTransactionId } }) =>
			transferTransactionId !== undefined && !removed.has(transferTransactionId)
	);
	if (oneSided) {
		throw publicError('INVALID_INPUT', 'Both sides of a Transfer must fold in together.');
	}
	await countTransactions(
		ctx,
		history.flatMap(({ transaction, lines }) =>
			transaction.split === true
				? lines.map((line) => lineCounted(transaction, line))
				: [transaction]
		),
		-1
	);
	for (const { transaction, lines, bankRows } of history) {
		for (const line of lines) await ctx.db.delete('transactionSplits', line._id);
		await ctx.db.delete('transactions', transaction._id);
		await keepAsBankMemory(
			ctx,
			bankRows.map(({ _id }) => _id)
		);
	}
}

export interface RestoredTransaction {
	transactionId: Id<'transactions'>;
	transaction: WithoutSystemFields<Doc<'transactions'>>;
	lines: readonly SplitLine[];
	bankRows: readonly { bankRowId: Id<'imports'>; matched: boolean }[];
}

export async function restoreEarlierHistory(
	ctx: MutationCtx,
	history: readonly RestoredTransaction[]
) {
	const restored = new Set(history.map(({ transactionId }) => transactionId));
	const oneSided = history.some(
		({ transaction: { transferTransactionId } }) =>
			transferTransactionId !== undefined && !restored.has(transferTransactionId)
	);
	if (oneSided) {
		throw publicError('INVALID_INPUT', 'Both sides of a Transfer must come back together.');
	}
	const newIdOf = new Map<Id<'transactions'>, Id<'transactions'>>();
	for (const { transactionId, transaction } of history) {
		const fields: WithoutSystemFields<Doc<'transactions'>> = { ...transaction };
		delete fields.transferTransactionId;
		newIdOf.set(transactionId, await ctx.db.insert('transactions', fields));
	}
	const counted: Counted[] = [];
	for (const { transactionId, transaction, lines, bankRows } of history) {
		const id = newIdOf.get(transactionId);
		if (id === undefined) continue;
		const otherId = transaction.transferTransactionId;
		if (otherId !== undefined) {
			await ctx.db.patch('transactions', id, { transferTransactionId: newIdOf.get(otherId) });
		}
		for (const line of lines) {
			const written = { ...line, transactionId: id, date: transaction.date };
			await ctx.db.insert('transactionSplits', written);
			counted.push(lineCounted(transaction, written));
		}
		counted.push(transaction);
		for (const { bankRowId, matched } of bankRows) {
			await ctx.db.patch('imports', bankRowId, { transactionId: id, matched });
		}
	}
	await countTransactions(ctx, counted, 1);
	for (const id of newIdOf.values()) await refreshDerivedFields(ctx, id);
}

export function allBankRowsOf(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	return ctx.db
		.query('imports')
		.withIndex('by_transactionId_state', (q) => q.eq('transactionId', transactionId));
}

export function bankRowsIn(
	ctx: QueryCtx,
	transactionId: Id<'transactions'>,
	state: Doc<'imports'>['state']
) {
	return ctx.db
		.query('imports')
		.withIndex('by_transactionId_state', (q) =>
			q.eq('transactionId', transactionId).eq('state', state)
		);
}

const BACKING_STATES = ['linked', 'changed'] as const;

export async function hasBankRow(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	for (const state of BACKING_STATES) {
		if ((await bankRowsIn(ctx, transactionId, state).first()) !== null) return true;
	}
	return false;
}

async function bankRowsOf(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	const bankRows: Doc<'imports'>[] = [];
	for await (const bankRow of allBankRowsOf(ctx, transactionId)) bankRows.push(bankRow);
	return bankRows;
}
