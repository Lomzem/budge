import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { lastCategoryOf } from './payees';
import { bankRowsIn, payeeNameOf, splitLinesOf } from './transactions';

export async function toRow(ctx: QueryCtx, transaction: Doc<'transactions'>) {
	const { bankRows, moreBankRows } = await bankRowsShown(ctx, transaction._id);
	const account = await ctx.db.get('accounts', transaction.accountId);
	const category =
		transaction.categoryId === undefined
			? null
			: await ctx.db.get('categories', transaction.categoryId);
	const payee =
		transaction.payeeId === undefined ? null : await ctx.db.get('payees', transaction.payeeId);
	return {
		_id: transaction._id,
		accountId: transaction.accountId,
		accountName: account?.name ?? '',
		date: transaction.date,
		amount: transaction.amount,
		payeeName: await payeeNameOf(ctx, transaction, () => Promise.resolve(payee)),
		rememberedCategoryId:
			payee === null || transaction.kind === 'startingBalance'
				? null
				: ((await lastCategoryOf(ctx, payee)) ?? null),
		startingBalance: transaction.kind === 'startingBalance',
		categoryId: transaction.categoryId ?? null,
		categoryName: category?.name ?? null,
		memo: transaction.memo ?? null,
		cleared: transaction.cleared !== 'uncleared',
		reconciled: transaction.cleared === 'reconciled',
		approved: transaction.approved !== false,
		bankRows: bankRows.map((bankRow) => ({
			_id: bankRow._id,
			bankText: bankRow.bankText,
			matched: bankRow.matched,
			state: bankRow.state === 'held' ? ('linked' as const) : bankRow.state,
			date: bankRow.date,
			amount: bankRow.amount
		})),
		moreBankRows,
		transfer: await transferOf(ctx, transaction),
		splits: await splitsOf(ctx, transaction)
	};
}

async function splitsOf(ctx: QueryCtx, transaction: Doc<'transactions'>) {
	if (transaction.split !== true) return null;
	return await Promise.all(
		(await splitLinesOf(ctx, transaction._id)).map(async (line) => ({
			categoryId: line.categoryId,
			categoryName: (await ctx.db.get('categories', line.categoryId))?.name ?? '',
			amount: line.amount,
			memo: line.memo ?? null
		}))
	);
}

async function transferOf(ctx: QueryCtx, transaction: Doc<'transactions'>) {
	if (transaction.transferTransactionId === undefined) return null;
	const counterpart = await ctx.db.get('transactions', transaction.transferTransactionId);
	if (counterpart === null) return null;
	const account = await ctx.db.get('accounts', counterpart.accountId);
	return { accountId: counterpart.accountId, accountName: account?.name ?? '' };
}

const BANK_ROWS_SHOWN = 10;

async function bankRowsShown(ctx: QueryCtx, transactionId: Id<'transactions'>) {
	const read: Doc<'imports'>[] = [];
	for (const state of ['changed', 'removed', 'linked'] as const) {
		if (read.length > BANK_ROWS_SHOWN) break;
		read.push(
			...(await bankRowsIn(ctx, transactionId, state).take(BANK_ROWS_SHOWN + 1 - read.length))
		);
	}
	return {
		bankRows: read.slice(0, BANK_ROWS_SHOWN),
		moreBankRows: read.length > BANK_ROWS_SHOWN
	};
}
