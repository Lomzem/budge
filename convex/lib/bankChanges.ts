import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { IncomingRow } from './imports';
import { importedPayee, type ImportedPayees } from './payees';
import { publicError } from './publicError';
import {
	allBankRowsOf,
	deleteTransaction,
	payeeNameOf,
	refreshSearchText,
	replaceTransaction,
	saveTransaction,
	splitLinesOf
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
		await ctx.db.patch('imports', bankRow._id, values);
		return;
	}
	if (await changesQuietly(ctx, bankRow, transaction)) {
		await followBank(ctx, transaction, row, bankTextChanged, payees);
		await ctx.db.patch('imports', bankRow._id, values);
	} else {
		const differs = row.date !== transaction.date || row.amount !== transaction.amount;
		const state = differs ? ('changed' as const) : ('linked' as const);
		await ctx.db.patch('imports', bankRow._id, {
			...values,
			...(datedOrAmountChanged ? { state } : {})
		});
	}
	if (bankTextChanged) await refreshSearchText(ctx, transaction._id);
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
	await ctx.db.patch('imports', bankRow._id, { state: 'removed' });
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
			await requireNoOtherBacking(ctx, transaction, bankRow);
			await deleteTransaction(ctx, transaction);
		} else {
			await ctx.db.patch('imports', bankRow._id, { transactionId: undefined, matched: false });
			await ctx.db.patch('transactions', transaction._id, { approved: true });
			await refreshSearchText(ctx, transaction._id);
		}
		return;
	}
	if (keep === 'bank') await takeBankValues(ctx, transaction, bankRow);
	else await ctx.db.patch('transactions', transaction._id, { approved: true });
	await ctx.db.patch('imports', bankRow._id, { state: 'linked' });
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
	await saveTransaction(ctx, transaction, {
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
	});
	if (counterpart !== null) await flagDisagreeingRows(ctx, counterpart._id);
}

async function requireNoOtherBacking(
	ctx: MutationCtx,
	transaction: Doc<'transactions'>,
	removed: Doc<'imports'>
) {
	const sides = [transaction._id];
	if (transaction.transferTransactionId !== undefined)
		sides.push(transaction.transferTransactionId);
	for (const side of sides) {
		for await (const other of allBankRowsOf(ctx, side)) {
			if (other._id === removed._id || other.state === 'removed') continue;
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
			await ctx.db.patch('imports', bankRow._id, { state: 'changed' });
		}
	}
}
