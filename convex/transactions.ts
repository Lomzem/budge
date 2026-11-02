import {
	paginationOptsValidator,
	paginationResultValidator,
	type PaginationOptions,
	type PaginationResult
} from 'convex/server';
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
	requireUnlocked,
	saveTransaction,
	splitLinesOf,
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
	/** `null` while Uncategorized, and for a split or a Transfer. */
	categoryName: v.union(v.string(), v.null()),
	memo: v.union(v.string(), v.null()),
	/** Cleared, or Reconciled, which is Cleared and locked. */
	cleared: v.boolean(),
	reconciled: v.boolean(),
	approved: v.boolean(),
	/** What the bank reported for it, read-only. */
	bankRows: v.array(v.object({ _id: v.id('imports'), bankText: v.string(), matched: v.boolean() })),
	/** The other side's Account, for a Transfer. */
	transfer: v.union(v.object({ accountId: v.id('accounts'), accountName: v.string() }), v.null()),
	/** A split's lines, in the order entered; `null` when it isn't split. */
	splits: v.union(
		v.array(
			v.object({
				categoryId: v.id('categories'),
				categoryName: v.string(),
				amount: v.number(),
				memo: v.union(v.string(), v.null())
			})
		),
		v.null()
	)
});

const approval = v.union(v.literal('unapproved'), v.literal('approved'));

/**
 * One page of an Account's Transactions, or of All Accounts' when `accountId` is left out,
 * newest first. `approval` narrows it to the Unapproved ones or the rest, so the list can show
 * Unapproved first; it takes no other filter.
 *
 * `search` finds Transactions whose Payee, memo, split memos, or Bank Text has any of its words,
 * those with more of them first. Only its last word matches by prefix; the others match whole
 * words. `categoryId`, `payeeId`, and the inclusive `from` and `to` dates narrow the list, with or
 * without `search`; the dates apply after the search.
 *
 * A split has no Category of its own, so `categoryId` takes whole Transactions in that Category.
 * With `splitLines` as well, it takes instead the split Transactions with a line in it, so the list
 * shows those after the whole ones.
 */
export const list = query({
	args: {
		accountId: v.optional(v.id('accounts')),
		approval: v.optional(approval),
		search: v.optional(v.string()),
		categoryId: v.optional(v.id('categories')),
		payeeId: v.optional(v.id('payees')),
		from: v.optional(v.string()),
		to: v.optional(v.string()),
		splitLines: v.optional(v.boolean()),
		paginationOpts: paginationOptsValidator
	},
	returns: paginationResultValidator(transactionRow),
	handler: async (ctx, { approval, paginationOpts, ...args }) => {
		await requireOwner(ctx);
		if (args.accountId !== undefined && (await ctx.db.get('accounts', args.accountId)) === null) {
			throw publicError('NOT_FOUND');
		}
		const searching = (args.search ?? '').trim() !== '';
		const filters: Filters = {
			...args,
			search: searchTerms(args.search ?? ''),
			splitLines: args.splitLines === true
		};
		const filtering =
			searching ||
			filters.categoryId !== undefined ||
			filters.payeeId !== undefined ||
			filters.from !== undefined ||
			filters.to !== undefined;
		if (approval !== undefined && filtering) {
			throw publicError('INVALID_INPUT', 'Unapproved first takes no filter.');
		}
		if (filters.splitLines && filters.categoryId === undefined) {
			throw publicError('INVALID_INPUT', 'Pick the Category the split lines are in.');
		}
		if (filters.from !== undefined) requireIsoDate(filters.from);
		if (filters.to !== undefined) requireIsoDate(filters.to);

		// A search of only punctuation has no words to find, so it finds nothing.
		if (searching && filters.search === '') return { page: [], isDone: true, continueCursor: '' };

		let result: PaginationResult<Doc<'transactions'>>;
		if (searching) {
			result = await searched(ctx, filters, paginationOpts);
		} else if (filters.splitLines) {
			result = await withLinesIn(ctx, filters, paginationOpts);
		} else if (approval === 'unapproved') {
			result = await unapproved(ctx, filters.accountId).order('desc').paginate(paginationOpts);
		} else {
			result = await filtered(ctx, filters, approval === 'approved', paginationOpts);
		}
		return {
			...result,
			page: await Promise.all(result.page.map((transaction) => toRow(ctx, transaction)))
		};
	}
});

interface Filters {
	accountId?: Id<'accounts'> | undefined;
	search: string;
	categoryId?: Id<'categories'> | undefined;
	payeeId?: Id<'payees'> | undefined;
	from?: string | undefined;
	to?: string | undefined;
	splitLines: boolean;
}

// Convex rejects a search of more than 16 terms.
const MAX_SEARCH_TERMS = 16;

/** The words of a search as Convex splits them, keeping the first `MAX_SEARCH_TERMS`. */
function searchTerms(search: string) {
	return search
		.split(/[^\p{Alphabetic}\p{N}]+/u)
		.filter((term) => term !== '')
		.slice(0, MAX_SEARCH_TERMS)
		.join(' ');
}

// Bounds that every `YYYY-MM-DD` date falls between, for a range left open.
const FIRST_DATE = '0000-01-01';
const LAST_DATE = '9999-12-31';

/**
 * The search, with the Account, Payee, and Category as filter fields. The dates, and a Category's
 * split lines, apply to each page after the search, so a page may come back short; filtering
 * inside the query instead could scan past the search index's 1,024-row limit and fail.
 */
async function searched(ctx: QueryCtx, filters: Filters, paginationOpts: PaginationOptions) {
	const { accountId, payeeId, categoryId, from, to } = filters;
	const result = await ctx.db
		.query('transactions')
		.withSearchIndex('search_text', (q) => {
			let search = q.search('searchText', filters.search);
			if (accountId !== undefined) search = search.eq('accountId', accountId);
			if (payeeId !== undefined) search = search.eq('payeeId', payeeId);
			if (filters.splitLines) search = search.eq('split', true);
			else if (categoryId !== undefined) search = search.eq('categoryId', categoryId);
			return search;
		})
		.paginate(paginationOpts);
	const page = [];
	for (const transaction of result.page) {
		if (transaction.date < (from ?? FIRST_DATE) || transaction.date > (to ?? LAST_DATE)) continue;
		if (filters.splitLines) {
			const lines = await splitLinesOf(ctx, transaction._id);
			if (!lines.some((line) => line.categoryId === categoryId)) continue;
		}
		page.push(transaction);
	}
	return { ...result, page };
}

/**
 * The split Transactions with a line in the Category, through the lines' Category-by-date index.
 * The Account and Payee apply to each page, so a page may come back short.
 */
async function withLinesIn(ctx: QueryCtx, filters: Filters, paginationOpts: PaginationOptions) {
	const { categoryId, accountId, payeeId, from, to } = filters;
	if (categoryId === undefined) throw publicError('INVALID_INPUT');
	const lines = await ctx.db
		.query('transactionSplits')
		.withIndex('by_category_date', (q) =>
			q
				.eq('categoryId', categoryId)
				.gte('date', from ?? FIRST_DATE)
				.lte('date', to ?? LAST_DATE)
		)
		.order('desc')
		.paginate(paginationOpts);
	const page: Doc<'transactions'>[] = [];
	for (const line of lines.page) {
		// Two lines in the same Category list their Transaction once, at its first such line, even
		// when the lines fall on different pages.
		const first = (await splitLinesOf(ctx, line.transactionId)).find(
			(other) => other.categoryId === categoryId
		);
		if (first?._id !== line._id) continue;
		const transaction = await ctx.db.get('transactions', line.transactionId);
		if (transaction === null) continue;
		if (accountId !== undefined && transaction.accountId !== accountId) continue;
		if (payeeId !== undefined && transaction.payeeId !== payeeId) continue;
		page.push(transaction);
	}
	return { ...lines, page };
}

/**
 * The list without search, newest first, through the narrowest index the filters allow: by Payee,
 * by Category, by Account, or by date, each with the date range. The other filters apply as rows
 * are read.
 */
async function filtered(
	ctx: QueryCtx,
	{ accountId, categoryId, payeeId, from, to }: Filters,
	approvedOnly: boolean,
	paginationOpts: PaginationOptions
) {
	const first = from ?? FIRST_DATE;
	const last = to ?? LAST_DATE;
	const transactions = ctx.db.query('transactions');
	const indexed =
		payeeId !== undefined
			? transactions.withIndex('by_payee_date', (q) =>
					q.eq('payeeId', payeeId).gte('date', first).lte('date', last)
				)
			: categoryId !== undefined
				? transactions.withIndex('by_category_date', (q) =>
						q.eq('categoryId', categoryId).gte('date', first).lte('date', last)
					)
				: accountId !== undefined
					? transactions.withIndex('by_account_date', (q) =>
							q.eq('accountId', accountId).gte('date', first).lte('date', last)
						)
					: transactions.withIndex('by_date', (q) => q.gte('date', first).lte('date', last));
	return await indexed
		.order('desc')
		// Old Transactions leave `approved` out; they count as approved, so no index range covers
		// them. Nearly every row is approved, so this skips only the few Unapproved ones.
		// eslint-disable-next-line @convex-dev/no-filter-in-query
		.filter((q) =>
			q.and(
				approvedOnly ? q.neq(q.field('approved'), false) : true,
				accountId === undefined ? true : q.eq(q.field('accountId'), accountId),
				categoryId === undefined ? true : q.eq(q.field('categoryId'), categoryId)
			)
		)
		.paginate(paginationOpts);
}

const transactionInput = {
	accountId: v.id('accounts'),
	date: v.string(),
	amount: v.number(),
	payee: v.string(),
	// Left out for Uncategorized.
	categoryId: v.optional(v.id('categories')),
	memo: v.string(),
	// Two or more lines summing to `amount`, each with its own Category; the Transaction then takes
	// no `categoryId`.
	splits: v.optional(
		v.array(v.object({ categoryId: v.id('categories'), amount: v.number(), memo: v.string() }))
	),
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

/** Deletes a Transaction, and both sides of a Transfer. Neither side may be Reconciled. */
export const remove = mutation({
	args: { transactionId: v.id('transactions') },
	returns: v.null(),
	handler: async (ctx, { transactionId }) => {
		await requireOwner(ctx);
		await deleteTransaction(ctx, await requireTransaction(ctx, transactionId));
		return null;
	}
});

/** Marks a Transaction Cleared or uncleared; a Reconciled one is unlocked first. */
export const setCleared = mutation({
	args: { transactionId: v.id('transactions'), cleared: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { transactionId, cleared }) => {
		await requireOwner(ctx);
		requireUnlocked(
			await requireTransaction(ctx, transactionId),
			'to change whether it is Cleared'
		);
		await ctx.db.patch('transactions', transactionId, {
			cleared: cleared ? 'cleared' : 'uncleared'
		});
		return null;
	}
});

/** Unlocks a Reconciled Transaction back to Cleared, so it can be changed or deleted. */
export const unlock = mutation({
	args: { transactionId: v.id('transactions') },
	returns: v.null(),
	handler: async (ctx, { transactionId }) => {
		await requireOwner(ctx);
		const transaction = await requireTransaction(ctx, transactionId);
		if (transaction.cleared !== 'reconciled') {
			throw publicError('INVALID_INPUT', 'This Transaction is not Reconciled.');
		}
		await ctx.db.patch('transactions', transactionId, { cleared: 'cleared' });
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
		cleared: transaction.cleared !== 'uncleared',
		reconciled: transaction.cleared === 'reconciled',
		approved: transaction.approved !== false,
		bankRows: (await bankRowsOf(ctx, transaction._id)).map((bankRow) => ({
			_id: bankRow._id,
			bankText: bankRow.bankText,
			matched: bankRow.matched
		})),
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
