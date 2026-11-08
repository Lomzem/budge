import {
	paginationOptsValidator,
	paginationResultValidator,
	type PaginationOptions,
	type PaginationResult
} from 'convex/server';
import { v, type Infer } from 'convex/values';

import { UNAPPROVED_COUNT_LIMIT } from '../src/lib/domain/unapproved';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { requireIsoDate } from './lib/settings';
import { toRow } from './lib/transactionRows';
import {
	deleteTransaction,
	payeeNameOf,
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
	startingBalance: v.boolean(),
	categoryId: v.union(v.id('categories'), v.null()),

	categoryName: v.union(v.string(), v.null()),
	memo: v.union(v.string(), v.null()),

	cleared: v.boolean(),
	reconciled: v.boolean(),
	approved: v.boolean(),
	bankRows: v.array(
		v.object({
			_id: v.id('imports'),
			bankText: v.string(),
			matched: v.boolean(),
			state: v.union(v.literal('linked'), v.literal('changed'), v.literal('removed')),
			date: v.string(),
			amount: v.number()
		})
	),
	moreBankRows: v.boolean(),
	transfer: v.union(v.object({ accountId: v.id('accounts'), accountName: v.string() }), v.null()),

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
		const filters = requireFilters(args, searching, approval);

		const searchOfOnlyPunctuation = searching && filters.search === '';
		if (searchOfOnlyPunctuation) return { page: [], isDone: true, continueCursor: '' };

		const result = await pageOf(ctx, filters, searching, approval, paginationOpts);
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

type Approval = Infer<typeof approval>;

function requireFilters(
	args: Omit<Filters, 'search' | 'splitLines'> & { search?: string; splitLines?: boolean },
	searching: boolean,
	approval: Approval | undefined
): Filters {
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
	return filters;
}

async function pageOf(
	ctx: QueryCtx,
	filters: Filters,
	searching: boolean,
	approval: Approval | undefined,
	paginationOpts: PaginationOptions
): Promise<PaginationResult<Doc<'transactions'>>> {
	if (searching) return await searched(ctx, filters, paginationOpts);
	if (filters.splitLines) return await withLinesIn(ctx, filters, paginationOpts);
	if (approval === 'unapproved') {
		return await unapproved(ctx, filters.accountId).order('desc').paginate(paginationOpts);
	}
	return await filtered(ctx, filters, approval === 'approved', paginationOpts);
}

const MAX_SEARCH_TERMS = 16;

function searchTerms(search: string) {
	return search
		.split(/[^\p{Alphabetic}\p{N}]+/u)
		.filter((term) => term !== '')
		.slice(0, MAX_SEARCH_TERMS)
		.join(' ');
}

const FIRST_DATE = '0000-01-01';
const LAST_DATE = '9999-12-31';

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
		const firstLineInTheCategory = (await splitLinesOf(ctx, line.transactionId)).find(
			(other) => other.categoryId === categoryId
		);
		if (firstLineInTheCategory?._id !== line._id) continue;
		const transaction = await ctx.db.get('transactions', line.transactionId);
		if (transaction === null) continue;
		if (accountId !== undefined && transaction.accountId !== accountId) continue;
		if (payeeId !== undefined && transaction.payeeId !== payeeId) continue;
		page.push(transaction);
	}
	return { ...lines, page };
}

async function filtered(
	ctx: QueryCtx,
	{ accountId, categoryId, payeeId, from, to }: Filters,
	approvedOnly: boolean,
	paginationOpts: PaginationOptions
) {
	return await narrowestIndex(ctx, { accountId, categoryId, payeeId, from, to })
		.order('desc')
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

function narrowestIndex(
	ctx: QueryCtx,
	{ accountId, categoryId, payeeId, from, to }: Omit<Filters, 'search' | 'splitLines'>
) {
	const first = from ?? FIRST_DATE;
	const last = to ?? LAST_DATE;
	const transactions = ctx.db.query('transactions');
	if (payeeId !== undefined) {
		return transactions.withIndex('by_payee_date', (q) =>
			q.eq('payeeId', payeeId).gte('date', first).lte('date', last)
		);
	}
	if (categoryId !== undefined) {
		return transactions.withIndex('by_category_date', (q) =>
			q.eq('categoryId', categoryId).gte('date', first).lte('date', last)
		);
	}
	if (accountId !== undefined) {
		return transactions.withIndex('by_account_date', (q) =>
			q.eq('accountId', accountId).gte('date', first).lte('date', last)
		);
	}
	return transactions.withIndex('by_date', (q) => q.gte('date', first).lte('date', last));
}

const transactionInput = {
	accountId: v.id('accounts'),
	date: v.string(),
	amount: v.number(),
	payee: v.string(),

	categoryId: v.optional(v.id('categories')),
	memo: v.string(),

	splits: v.optional(
		v.array(v.object({ categoryId: v.id('categories'), amount: v.number(), memo: v.string() }))
	),

	transferAccountId: v.optional(v.id('accounts')),

	transferTransactionId: v.optional(v.id('transactions'))
};

export const create = mutation({
	args: transactionInput,
	returns: v.id('transactions'),
	handler: async (ctx, input) => {
		await requireOwner(ctx);
		return await saveTransaction(ctx, null, input);
	}
});

export const update = mutation({
	args: { transactionId: v.id('transactions'), ...transactionInput },
	returns: v.null(),
	handler: async (ctx, { transactionId, ...input }) => {
		await requireOwner(ctx);
		await saveTransaction(ctx, await requireTransaction(ctx, transactionId), input);
		return null;
	}
});

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
			candidates.map(async (transaction) => ({
				_id: transaction._id,
				date: transaction.date,
				amount: transaction.amount,
				payeeName: await payeeNameOf(ctx, transaction),
				memo: transaction.memo ?? null
			}))
		);
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

export const approveAll = mutation({
	args: { accountId: v.optional(v.id('accounts')) },
	returns: v.number(),
	handler: async (ctx, { accountId }) => {
		await requireOwner(ctx);
		const boundedBatch = await unapproved(ctx, accountId).take(UNAPPROVED_COUNT_LIMIT);
		for (const transaction of boundedBatch) {
			await ctx.db.patch('transactions', transaction._id, { approved: true });
		}
		return boundedBatch.length;
	}
});

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
