import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import {
	deleteTransaction,
	insertTransaction,
	replaceTransaction,
	transactionFields
} from './lib/transactions';

const transactionRow = v.object({
	_id: v.id('transactions'),
	accountId: v.id('accounts'),
	accountName: v.string(),
	date: v.string(),
	amount: v.number(),
	payeeName: v.union(v.string(), v.null()),
	memo: v.union(v.string(), v.null()),
	cleared: v.boolean()
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
	memo: v.string()
};

/** Enters a Transaction by hand. It starts uncleared; a new Payee name creates the Payee. */
export const create = mutation({
	args: transactionInput,
	returns: v.id('transactions'),
	handler: async (ctx, input) => {
		await requireOwner(ctx);
		const fields = await transactionFields(ctx, input);
		return await insertTransaction(ctx, { ...fields, cleared: 'uncleared' });
	}
});

/** Changes everything the owner entered on a Transaction, keeping whether it is Cleared. */
export const update = mutation({
	args: { transactionId: v.id('transactions'), ...transactionInput },
	returns: v.null(),
	handler: async (ctx, { transactionId, ...input }) => {
		await requireOwner(ctx);
		const existing = await requireTransaction(ctx, transactionId);
		const fields = await transactionFields(ctx, input);
		await replaceTransaction(ctx, existing, { ...fields, cleared: existing.cleared });
		return null;
	}
});

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
	return {
		_id: transaction._id,
		accountId: transaction.accountId,
		accountName: account?.name ?? '',
		date: transaction.date,
		amount: transaction.amount,
		payeeName: payee?.name ?? null,
		memo: transaction.memo ?? null,
		cleared: transaction.cleared === 'cleared'
	};
}
