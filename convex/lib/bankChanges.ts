import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { IncomingRow } from './imports';
import { importedPayee, type ImportedPayees } from './payees';
import { publicError } from './publicError';
import {
	allBankRowsOf,
	deleteTransaction,
	hasBankRow,
	keepAfterBankRemoval,
	markApproved,
	payeeNameOf,
	replaceTransaction,
	saveTransaction,
	splitLinesOf,
	updateBankRow
} from './transactions';

export async function syncedBankRow(ctx: MutationCtx, accountId: Id<'accounts'>, sourceId: string) {
	return await ctx.db
		.query('imports')
		.withIndex('by_account_source_sourceId_date', (q) =>
			q.eq('accountId', accountId).eq('source', 'plaid').eq('sourceId', sourceId)
		)
		.first();
}

async function changesQuietly(
	ctx: MutationCtx,
	bankRow: Doc<'imports'>,
	transaction: Doc<'transactions'>
) {
	return (
		bankRow.state === 'linked' &&
		!bankRow.matched &&
		transaction.approved === false &&
		transaction.split !== true &&
		transaction.transferTransactionId === undefined &&
		transaction.cleared !== 'reconciled' &&
		(await allBankRowsOf(ctx, transaction._id).take(2)).length === 1
	);
}

export async function applyBankChange(
	ctx: MutationCtx,
	bankRow: Doc<'imports'>,
	row: IncomingRow,
	payees: ImportedPayees
) {
	const bankTextChanged = bankRow.bankText !== row.bankText;
	const datedOrAmountChanged = row.date !== bankRow.date || row.amount !== bankRow.amount;
	if (!bankTextChanged && !datedOrAmountChanged) return;
	const values = { date: row.date, amount: row.amount, bankText: row.bankText };
	const transaction = await linkedTransaction(ctx, bankRow);
	if (transaction === null) {
		const flagged = datedOrAmountChanged && bankRow.state === 'linked';
		await updateBankRow(ctx, bankRow, { ...values, ...(flagged ? { state: 'changed' } : {}) });
		return;
	}
	if (await changesQuietly(ctx, bankRow, transaction)) {
		await followBank(ctx, transaction, row, bankTextChanged, payees);
		await updateBankRow(ctx, bankRow, values);
	} else {
		const differs = row.date !== transaction.date || row.amount !== transaction.amount;
		const state = differs ? ('changed' as const) : ('linked' as const);
		await updateBankRow(ctx, bankRow, { ...values, ...(datedOrAmountChanged ? { state } : {}) });
	}
}

async function followBank(
	ctx: MutationCtx,
	transaction: Doc<'transactions'>,
	row: IncomingRow,
	bankTextChanged: boolean,
	payees: ImportedPayees
) {
	const { payeeId, categoryId } = transaction;
	const named = bankTextChanged
		? await importedPayee(ctx, row, payees)
		: {
				...(payeeId === undefined ? {} : { payeeId }),
				...(categoryId === undefined ? {} : { categoryId })
			};
	await replaceTransaction(
		ctx,
		transaction,
		{
			accountId: transaction.accountId,
			...named,
			cleared: transaction.cleared,
			date: row.date,
			amount: row.amount,
			approved: false
		},
		[]
	);
}

async function linkedTransaction(ctx: MutationCtx, bankRow: Doc<'imports'>) {
	return bankRow.transactionId === undefined
		? null
		: await ctx.db.get('transactions', bankRow.transactionId);
}

export async function applyBankRemoval(ctx: MutationCtx, bankRow: Doc<'imports'>) {
	if (bankRow.state === 'removed') return;
	const transaction = await linkedTransaction(ctx, bankRow);
	if (transaction !== null && (await changesQuietly(ctx, bankRow, transaction))) {
		await deleteTransaction(ctx, transaction);
	}
	await updateBankRow(ctx, bankRow, { state: 'removed' });
}

export async function resolveBankChange(
	ctx: MutationCtx,
	importId: Id<'imports'>,
	keep: 'bank' | 'mine'
) {
	const bankRow = await ctx.db.get('imports', importId);
	if (bankRow === null) throw publicError('NOT_FOUND');
	const transaction = await linkedTransaction(ctx, bankRow);
	if (transaction === null || (bankRow.state !== 'changed' && bankRow.state !== 'removed')) {
		throw publicError('INVALID_INPUT', 'The bank has no change here to resolve.');
	}
	if (bankRow.state === 'removed') {
		if (keep === 'bank') {
			await requireNoOtherBacking(ctx, transaction);
			await deleteTransaction(ctx, transaction);
		} else {
			await keepAfterBankRemoval(ctx, bankRow._id, transaction._id);
		}
		return;
	}
	if (keep === 'bank') await takeBankValues(ctx, transaction, bankRow);
	else await markApproved(ctx, transaction._id);
	await updateBankRow(ctx, bankRow, { state: 'linked' });
}

async function takeBankValues(
	ctx: MutationCtx,
	transaction: Doc<'transactions'>,
	bankRow: Doc<'imports'>
) {
	const lines = transaction.split === true ? await splitLinesOf(ctx, transaction._id) : [];
	if (lines.length > 0 && bankRow.amount !== transaction.amount) {
		throw publicError(
			'INVALID_INPUT',
			"This split's lines add up to your amount. Edit the split to the bank's amount, then keep your version."
		);
	}
	const counterpart =
		transaction.transferTransactionId === undefined
			? null
			: await ctx.db.get('transactions', transaction.transferTransactionId);
	await saveTransaction(
		ctx,
		transaction,
		{
			accountId: transaction.accountId,
			date: bankRow.date,
			amount: bankRow.amount,
			payee: (await payeeNameOf(ctx, transaction)) ?? '',
			categoryId: transaction.categoryId,
			memo: transaction.memo ?? '',
			splits: lines.map((line) => ({
				categoryId: line.categoryId,
				amount: line.amount,
				memo: line.memo ?? ''
			})),
			transferAccountId: counterpart?.accountId,
			transferTransactionId: counterpart?._id
		},
		{ rememberCategory: false }
	);
	if (counterpart !== null) await flagDisagreeingRows(ctx, counterpart._id);
}

async function requireNoOtherBacking(ctx: MutationCtx, transaction: Doc<'transactions'>) {
	const sides = [transaction._id];
	if (transaction.transferTransactionId !== undefined)
		sides.push(transaction.transferTransactionId);
	for (const side of sides) {
		if (await hasBankRow(ctx, side)) {
			throw publicError(
				'INVALID_INPUT',
				'Another bank row still shows this Transaction, so keep your version instead.'
			);
		}
	}
}

async function flagDisagreeingRows(ctx: MutationCtx, transactionId: Id<'transactions'>) {
	const transaction = await ctx.db.get('transactions', transactionId);
	if (transaction === null) return;
	for await (const bankRow of allBankRowsOf(ctx, transactionId)) {
		const disagrees = bankRow.date !== transaction.date || bankRow.amount !== transaction.amount;
		if (bankRow.state === 'linked' && disagrees) {
			await updateBankRow(ctx, bankRow, { state: 'changed' });
		}
	}
}
