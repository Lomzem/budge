import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { resolveBankChange as resolve } from './lib/bankChanges';
import { applyBankRows, fileRow, fileSource, insertImported, planImport } from './lib/imports';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { ImportedPayees } from './lib/payees';
import { hasBankRow, payeeNameOf, refreshSearchText, requireUnlocked } from './lib/transactions';

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
		const payees = new Map<Id<'payees'>, Promise<Doc<'payees'> | null>>();
		const payeeOf = (payeeId: Id<'payees'>) => {
			const known = payees.get(payeeId);
			if (known !== undefined) return known;
			const loading = ctx.db.get('payees', payeeId);
			payees.set(payeeId, loading);
			return loading;
		};
		const describe = async (transactionId: Id<'transactions'>) => {
			const transaction = plan.candidates.get(transactionId);
			if (transaction === undefined) throw publicError('NOT_FOUND');
			return {
				_id: transaction._id,
				date: transaction.date,
				amount: transaction.amount,
				payeeName: await payeeNameOf(ctx, transaction, payeeOf),
				memo: transaction.memo ?? null
			};
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
		if (!bankRow.matched || matchedId === undefined || bankRow.accountId === undefined) {
			throw publicError('INVALID_INPUT', 'This bank row is not Matched.');
		}
		if (bankRow.state === 'removed') {
			throw publicError('INVALID_INPUT', 'The bank removed this row. Resolve that instead.');
		}
		const matchedTransaction = await ctx.db.get('transactions', matchedId);
		if (matchedTransaction !== null) requireUnlocked(matchedTransaction, 'to unmatch it');
		const transactionId = await insertImported(ctx, bankRow.accountId, bankRow);
		await ctx.db.patch('imports', importId, { transactionId, matched: false, state: 'linked' });
		await refreshSearchText(ctx, transactionId);
		await refreshSearchText(ctx, matchedId);
		if (!(await hasBankRow(ctx, matchedId))) {
			await ctx.db.patch('transactions', matchedId, { cleared: 'uncleared', approved: true });
		}
		return transactionId;
	}
});

export const resolveBankChange = mutation({
	args: { importId: v.id('imports'), keep: v.union(v.literal('bank'), v.literal('mine')) },
	returns: v.null(),
	handler: async (ctx, { importId, keep }) => {
		await requireOwner(ctx);
		await resolve(ctx, importId, keep);
		return null;
	}
});
