import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { deleteTransaction, saveTransaction } from './lib/transactions';

const transactionRow = v.object({
	_id: v.id('transactions'),
	accountId: v.id('accounts'),
	accountName: v.string(),
	date: v.string(),
	amount: v.number(),
	payeeName: v.union(v.string(), v.null()),
	categoryId: v.union(v.id('categories'), v.null()),
	/** `null` while Uncategorized. */
	categoryName: v.union(v.string(), v.null()),
	memo: v.union(v.string(), v.null()),
	cleared: v.boolean(),
	/** The other side's Account, for a Transfer. */
	transfer: v.union(v.object({ accountId: v.id('accounts'), accountName: v.string() }), v.null())
});

/**
 * One page of an Account's Transactions, or of All Accounts' when `accountId` is left out,
 * newest first.
 */
export const list = query({
	args: { accountId: v.optional(v.id('accounts')), paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(transactionRow),
	handler: async (ctx, { accountId, paginationOpts }) => {
		await requireOwner(ctx);
		if (accountId !== undefined && (await ctx.db.get('accounts', accountId)) === null) {
			throw publicError('NOT_FOUND');
		}
		const transactions =
			accountId === undefined
				? ctx.db.query('transactions').withIndex('by_date')
				: ctx.db
						.query('transactions')
						.withIndex('by_account_date', (q) => q.eq('accountId', accountId));
		const result = await transactions.order('desc').paginate(paginationOpts);
		return {
			...result,
			page: await Promise.all(result.page.map((transaction) => toRow(ctx, transaction)))
		};
	}
});

const transactionInput = {
	accountId: v.id('accounts'),
	date: v.string(),
	amount: v.number(),
	payee: v.string(),
	// Left out for Uncategorized.
	categoryId: v.optional(v.id('categories')),
	memo: v.string(),
	// The other Account of a Transfer, which then takes no Category and no Payee.
	transferAccountId: v.optional(v.id('accounts'))
};

/**
 * Enters a Transaction by hand, or both sides of a Transfer. It starts uncleared; a new Payee name
 * creates the Payee. Returns the Transaction in `accountId`.
 */
export const create = mutation({
	args: transactionInput,
	returns: v.id('transactions'),
	handler: async (ctx, input) => {
		await requireOwner(ctx);
		return await saveTransaction(ctx, null, input);
	}
});

/**
 * Changes everything the owner entered on a Transaction, keeping whether it is Cleared. Editing
 * either side of a Transfer changes the other side to match; leaving out `transferAccountId`
 * deletes the other side.
 */
export const update = mutation({
	args: { transactionId: v.id('transactions'), ...transactionInput },
	returns: v.null(),
	handler: async (ctx, { transactionId, ...input }) => {
		await requireOwner(ctx);
		await saveTransaction(ctx, await requireTransaction(ctx, transactionId), input);
		return null;
	}
});

/** Deletes a Transaction, and both sides of a Transfer. */
export const remove = mutation({
	args: { transactionId: v.id('transactions') },
	returns: v.null(),
	handler: async (ctx, { transactionId }) => {
		await requireOwner(ctx);
		await deleteTransaction(ctx, await requireTransaction(ctx, transactionId));
		return null;
	}
});

export const setCleared = mutation({
	args: { transactionId: v.id('transactions'), cleared: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { transactionId, cleared }) => {
		await requireOwner(ctx);
		await requireTransaction(ctx, transactionId);
		await ctx.db.patch('transactions', transactionId, {
			cleared: cleared ? 'cleared' : 'uncleared'
		});
		return null;
	}
});

async function requireTransaction(ctx: MutationCtx, transactionId: Id<'transactions'>) {
	const transaction = await ctx.db.get('transactions', transactionId);
	if (transaction === null) throw publicError('NOT_FOUND');
	return transaction;
}

async function toRow(ctx: QueryCtx, transaction: Doc<'transactions'>) {
	const account = await ctx.db.get('accounts', transaction.accountId);
	const payee =
		transaction.payeeId === undefined ? null : await ctx.db.get('payees', transaction.payeeId);
	const category =
		transaction.categoryId === undefined
			? null
			: await ctx.db.get('categories', transaction.categoryId);
	return {
		_id: transaction._id,
		accountId: transaction.accountId,
		accountName: account?.name ?? '',
		date: transaction.date,
		amount: transaction.amount,
		payeeName: payee?.name ?? null,
		categoryId: transaction.categoryId ?? null,
		categoryName: category?.name ?? null,
		memo: transaction.memo ?? null,
		cleared: transaction.cleared === 'cleared',
		transfer: await transferOf(ctx, transaction)
	};
}

async function transferOf(ctx: QueryCtx, transaction: Doc<'transactions'>) {
	if (transaction.transferTransactionId === undefined) return null;
	const counterpart = await ctx.db.get('transactions', transaction.transferTransactionId);
	if (counterpart === null) return null;
	const account = await ctx.db.get('accounts', counterpart.accountId);
	return { accountId: counterpart.accountId, accountName: account?.name ?? '' };
}
