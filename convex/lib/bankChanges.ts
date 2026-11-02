// Bank changes: what Budge does when the bank changes or removes a Transaction it already reported.
// Applying the same change twice changes nothing the second time, because a restarted sync update
// applies again every batch it had already committed.

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { IncomingRow } from './imports';
import { importedPayee, type ImportedPayees } from './payees';
import { publicError } from './publicError';
import {
	bankRowsOf,
	deleteTransaction,
	refreshSearchText,
	replaceTransaction,
	saveTransaction,
	splitLinesOf
} from './transactions';

/** A synced Bank Row already in `accountId`, by its import ID. */
export async function syncedBankRow(ctx: MutationCtx, accountId: Id<'accounts'>, sourceId: string) {
	return await ctx.db
		.query('imports')
		.withIndex('by_account_source_sourceId_date', (q) =>
			q.eq('accountId', accountId).eq('source', 'plaid').eq('sourceId', sourceId)
		)
		.first();
}

/**
 * Whether the bank may change or delete the Transaction without asking: the Bank Row created it,
 * it is its only Bank Row, and the owner hasn't touched it. Editing approves a Transaction, so an
 * Unapproved one is unedited unless it is a split, a Transfer, or Reconciled.
 */
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
		(await bankRowsOf(ctx, transaction._id)).length === 1
	);
}

/**
 * Takes the bank's newest values for a Bank Row. An Unapproved, unedited Transaction follows them,
 * with its Payee named again from a new Bank Text. Otherwise the Transaction keeps the owner's
 * version, and the Bank Row is flagged `changed` while its date or amount differs from the
 * Transaction's. A change the Bank Row already holds does nothing.
 */
export async function applyBankChange(
	ctx: MutationCtx,
	bankRow: Doc<'imports'>,
	row: IncomingRow,
	payees: ImportedPayees
) {
	if (
		bankRow.date === row.date &&
		bankRow.amount === row.amount &&
		bankRow.bankText === row.bankText
	) {
		return;
	}
	const values = { date: row.date, amount: row.amount, bankText: row.bankText };
	const transaction =
		bankRow.transactionId === undefined
			? null
			: await ctx.db.get('transactions', bankRow.transactionId);
	if (transaction === null) {
		await ctx.db.patch('imports', bankRow._id, values);
		return;
	}
	if (await changesQuietly(ctx, bankRow, transaction)) {
		const { payeeId, categoryId } = transaction;
		const named =
			bankRow.bankText === row.bankText
				? {
						...(payeeId === undefined ? {} : { payeeId }),
						...(categoryId === undefined ? {} : { categoryId })
					}
				: await importedPayee(ctx, row, payees);
		await replaceTransaction(ctx, transaction, {
			accountId: transaction.accountId,
			...named,
			cleared: transaction.cleared,
			date: row.date,
			amount: row.amount,
			approved: false
		});
		await ctx.db.patch('imports', bankRow._id, values);
		if (bankRow.bankText !== row.bankText) await refreshSearchText(ctx, transaction._id);
		return;
	}
	const differs = row.date !== transaction.date || row.amount !== transaction.amount;
	const datedOrAmountChanged = row.date !== bankRow.date || row.amount !== bankRow.amount;
	await ctx.db.patch('imports', bankRow._id, {
		...values,
		...(datedOrAmountChanged ? { state: differs ? ('changed' as const) : ('linked' as const) } : {})
	});
	if (bankRow.bankText !== row.bankText) await refreshSearchText(ctx, transaction._id);
}

/**
 * Marks a Bank Row `removed`. An Unapproved, unedited Transaction is deleted with it; any other
 * stays, flagged. A Bank Row already removed is left as it is.
 */
export async function applyBankRemoval(ctx: MutationCtx, bankRow: Doc<'imports'>) {
	if (bankRow.state === 'removed') return;
	const transaction =
		bankRow.transactionId === undefined
			? null
			: await ctx.db.get('transactions', bankRow.transactionId);
	if (transaction !== null && (await changesQuietly(ctx, bankRow, transaction))) {
		await deleteTransaction(ctx, transaction);
	}
	await ctx.db.patch('imports', bankRow._id, { state: 'removed' });
}

/**
 * Resolves "bank changed this" or "bank removed this". Keeping the bank's version gives the
 * Transaction the Bank Row's date and amount, as an edit would, or deletes it. Keeping the owner's
 * leaves the Transaction as it is; a removed Bank Row is unlinked from it, so the bank's removal
 * no longer touches it. Either way the Transaction is reviewed and approved.
 */
export async function resolveBankChange(
	ctx: MutationCtx,
	importId: Id<'imports'>,
	keep: 'bank' | 'mine'
) {
	const bankRow = await ctx.db.get('imports', importId);
	if (bankRow === null) throw publicError('NOT_FOUND');
	const transaction =
		bankRow.transactionId === undefined
			? null
			: await ctx.db.get('transactions', bankRow.transactionId);
	if (transaction === null || (bankRow.state !== 'changed' && bankRow.state !== 'removed')) {
		throw publicError('INVALID_INPUT', 'The bank has no change here to resolve.');
	}
	if (bankRow.state === 'removed') {
		if (keep === 'bank') {
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

/** Saves the Transaction again with the Bank Row's date and amount, keeping everything else. */
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
	const payee =
		transaction.payeeId === undefined ? null : await ctx.db.get('payees', transaction.payeeId);
	const counterpart =
		transaction.transferTransactionId === undefined
			? null
			: await ctx.db.get('transactions', transaction.transferTransactionId);
	await saveTransaction(ctx, transaction, {
		accountId: transaction.accountId,
		date: bankRow.date,
		amount: bankRow.amount,
		payee: payee?.name ?? '',
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
}
