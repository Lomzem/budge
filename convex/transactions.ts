import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';

import { UNAPPROVED_COUNT_LIMIT } from '../src/lib/domain/unapproved';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { requireIsoDate } from './lib/settings';
import {
	bankRowsOf,
	deleteTransaction,
	saveTransaction,
	transferCandidatesOf
} from './lib/transactions';

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
	approved: v.boolean(),
	/** What the bank reported for it, read-only. */
	bankRows: v.array(v.object({ _id: v.id('imports'), bankText: v.string(), matched: v.boolean() })),
	/** The other side's Account, for a Transfer. */
	transfer: v.union(v.object({ accountId: v.id('accounts'), accountName: v.string() }), v.null())
});

const approval = v.union(v.literal('unapproved'), v.literal('approved'));

/**
 * One page of an Account's Transactions, or of All Accounts' when `accountId` is left out,
 * newest first. `approval` narrows it to the Unapproved ones or the rest, so the list can show
 * Unapproved first.
 */
export const list = query({
	args: {
		accountId: v.optional(v.id('accounts')),
		approval: v.optional(approval),
		paginationOpts: paginationOptsValidator
	},
	returns: paginationResultValidator(transactionRow),
	handler: async (ctx, { accountId, approval, paginationOpts }) => {
		await requireOwner(ctx);
		if (accountId !== undefined && (await ctx.db.get('accounts', accountId)) === null) {
			throw publicError('NOT_FOUND');
		}
		const result =
			approval === 'unapproved'
				? await unapproved(ctx, accountId).order('desc').paginate(paginationOpts)
				: await (
						accountId === undefined
							? ctx.db.query('transactions').withIndex('by_date')
							: ctx.db
									.query('transactions')
									.withIndex('by_account_date', (q) => q.eq('accountId', accountId))
					)
						.order('desc')
						// Old Transactions leave `approved` out; they count as approved, so no index range
						// covers them. Nearly every row is approved, so this skips only the few Unapproved ones.
						// eslint-disable-next-line @convex-dev/no-filter-in-query
						.filter((q) => (approval === 'approved' ? q.neq(q.field('approved'), false) : true))
						.paginate(paginationOpts);
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
	transferAccountId: v.optional(v.id('accounts')),
	// An imported Transaction in that Account to link as the other side, in place of creating one.
	transferTransactionId: v.optional(v.id('transactions'))
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
 * or categorizing approves it. Editing either side of a Transfer changes the other side to match,
 * leaving whether that side is approved; leaving out `transferAccountId` deletes the other side.
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

/**
 * The imported Transactions in `transferAccountId` that a Transfer of `amount` on `date` could link
 * as its other side, nearest date first: not yet a Transfer side, with the opposite amount, dated
 * within 10 days. There is no automatic Transfer detection; the owner picks one or none.
 */
export const transferCandidates = query({
	args: { transferAccountId: v.id('accounts'), date: v.string(), amount: v.number() },
	returns: v.array(
		v.object({
			_id: v.id('transactions'),
			date: v.string(),
			amount: v.number(),
			payeeName: v.union(v.string(), v.null()),
			memo: v.union(v.string(), v.null())
		})
	),
	handler: async (ctx, { transferAccountId, date, amount }) => {
		await requireOwner(ctx);
		if ((await ctx.db.get('accounts', transferAccountId)) === null) throw publicError('NOT_FOUND');
		requireIsoDate(date);
		const candidates = await transferCandidatesOf(ctx, transferAccountId, date, amount);
		const distance = (other: string) => Math.abs(Date.parse(other) - Date.parse(date));
		candidates.sort((a, b) => distance(a.date) - distance(b.date));
		return await Promise.all(
			candidates.map(async (transaction) => {
				const payee =
					transaction.payeeId === undefined
						? null
						: await ctx.db.get('payees', transaction.payeeId);
				return {
					_id: transaction._id,
					date: transaction.date,
					amount: transaction.amount,
					payeeName: payee?.name ?? null,
					memo: transaction.memo ?? null
				};
			})
		);
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

export const approve = mutation({
	args: { transactionId: v.id('transactions') },
	returns: v.null(),
	handler: async (ctx, { transactionId }) => {
		await requireOwner(ctx);
		await requireTransaction(ctx, transactionId);
		await ctx.db.patch('transactions', transactionId, { approved: true });
		return null;
	}
});

/** Approves an Account's Unapproved Transactions, or All Accounts', and returns how many. */
export const approveAll = mutation({
	args: { accountId: v.optional(v.id('accounts')) },
	returns: v.number(),
	handler: async (ctx, { accountId }) => {
		await requireOwner(ctx);
		// Bounds one call's writes; the rest stay Unapproved for the next "Approve all".
		const transactions = await unapproved(ctx, accountId).take(UNAPPROVED_COUNT_LIMIT);
		for (const transaction of transactions) {
			await ctx.db.patch('transactions', transaction._id, { approved: true });
		}
		return transactions.length;
	}
});

/**
 * How many Transactions are Unapproved, in one Account or all. The count stops one past the limit,
 * so a count past it reads as "at least".
 */
export const unapprovedCount = query({
	args: { accountId: v.optional(v.id('accounts')) },
	returns: v.number(),
	handler: async (ctx, { accountId }) => {
		await requireOwner(ctx);
		return (await unapproved(ctx, accountId).take(UNAPPROVED_COUNT_LIMIT + 1)).length;
	}
});

function unapproved(ctx: QueryCtx, accountId: Id<'accounts'> | undefined) {
	return accountId === undefined
		? ctx.db.query('transactions').withIndex('by_approved_date', (q) => q.eq('approved', false))
		: ctx.db
				.query('transactions')
				.withIndex('by_account_approved_date', (q) =>
					q.eq('accountId', accountId).eq('approved', false)
				);
}

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
		approved: transaction.approved !== false,
		bankRows: (await bankRowsOf(ctx, transaction._id)).map((bankRow) => ({
			_id: bankRow._id,
			bankText: bankRow.bankText,
			matched: bankRow.matched
		})),
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
