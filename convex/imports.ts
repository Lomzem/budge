import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { applyBankRows, fileRow, fileSource, insertImported, planImport } from './lib/imports';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { ImportedPayees } from './lib/payees';
import { bankRowsOf, refreshSearchText, requireUnlocked } from './lib/transactions';

const candidate = v.object({
	_id: v.id('transactions'),
	date: v.string(),
	amount: v.number(),
	payeeName: v.union(v.string(), v.null()),
	memo: v.union(v.string(), v.null())
});

const previewRow = v.union(
	v.object({ kind: v.literal('new'), candidates: v.optional(v.array(candidate)) }),
	v.object({ kind: v.literal('skip') }),
	v.object({
		kind: v.literal('match'),
		transaction: candidate,
		candidates: v.optional(v.array(candidate))
	}),
	v.object({ kind: v.literal('ask'), candidates: v.array(candidate) })
);

const fileArgs = { accountId: v.id('accounts'), source: fileSource, rows: v.array(fileRow) };

export const preview = query({
	args: fileArgs,
	returns: v.array(previewRow),
	handler: async (ctx, { accountId, source, rows }) => {
		await requireOwner(ctx);
		const plan = await planImport(ctx, accountId, source, rows);
		const describe = async (transactionId: Id<'transactions'>) => {
			const transaction = plan.candidates.get(transactionId);
			if (transaction === undefined) throw publicError('NOT_FOUND');
			return await describeCandidate(ctx, transaction);
		};
		const describeAll = async (candidates: Id<'transactions'>[] | undefined) =>
			candidates === undefined ? {} : { candidates: await Promise.all(candidates.map(describe)) };
		return await Promise.all(
			plan.decisions.map(async (decision) => {
				switch (decision.kind) {
					case 'match':
						return {
							kind: decision.kind,
							transaction: await describe(decision.transactionId),
							...(await describeAll(decision.candidates))
						};
					case 'ask':
						return {
							kind: decision.kind,
							candidates: await Promise.all(decision.candidates.map(describe))
						};
					case 'new':
						return { kind: decision.kind, ...(await describeAll(decision.candidates)) };
					default:
						return { kind: decision.kind };
				}
			})
		);
	}
});

export const commit = mutation({
	args: fileArgs,
	returns: v.object({ added: v.number(), matched: v.number(), skipped: v.number() }),
	handler: async (ctx, { accountId, source, rows: input }) => {
		await requireOwner(ctx);
		const { rows, decisions, candidates } = await planImport(ctx, accountId, source, input);
		if (decisions.some((decision) => decision.kind === 'ask')) {
			throw publicError('INVALID_INPUT', 'Pick a Match for every row that has more than one.');
		}
		return await applyBankRows(
			ctx,
			accountId,
			source,
			{ rows, decisions, candidates },
			new ImportedPayees()
		);
	}
});

export const unmatch = mutation({
	args: { importId: v.id('imports') },
	returns: v.id('transactions'),
	handler: async (ctx, { importId }) => {
		await requireOwner(ctx);
		const bankRow = await ctx.db.get('imports', importId);
		if (bankRow === null) throw publicError('NOT_FOUND');
		const matchedId = bankRow.transactionId;
		if (!bankRow.matched || matchedId === undefined) {
			throw publicError('INVALID_INPUT', 'This bank row is not Matched.');
		}
		const matchedTransaction = await ctx.db.get('transactions', matchedId);
		if (matchedTransaction !== null) requireUnlocked(matchedTransaction, 'to unmatch it');
		const transactionId = await insertImported(ctx, bankRow.accountId, bankRow);
		await ctx.db.patch('imports', importId, { transactionId, matched: false });
		await refreshSearchText(ctx, transactionId);
		await refreshSearchText(ctx, matchedId);
		const stillLinked = await bankRowsOf(ctx, matchedId);
		if (stillLinked.length === 0) {
			await ctx.db.patch('transactions', matchedId, { cleared: 'uncleared', approved: true });
		}
		return transactionId;
	}
});

async function describeCandidate(ctx: QueryCtx, transaction: Doc<'transactions'>) {
	const payee =
		transaction.payeeId === undefined ? null : await ctx.db.get('payees', transaction.payeeId);
	return {
		_id: transaction._id,
		date: transaction.date,
		amount: transaction.amount,
		payeeName: payee?.name ?? null,
		memo: transaction.memo ?? null
	};
}
