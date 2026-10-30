import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { fileRow, fileSource, planImport } from './lib/imports';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { importedPayee } from './lib/payees';
import { bankRowsOf, insertTransaction } from './lib/transactions';

const candidate = v.object({
	_id: v.id('transactions'),
	date: v.string(),
	amount: v.number(),
	payeeName: v.union(v.string(), v.null()),
	memo: v.union(v.string(), v.null())
});

// A Match or new row that a pick resolved keeps its candidates, so the owner can change the pick.
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

/**
 * What saving a decoded bank file would do to each row: add it as a new Transaction, skip it as a
 * duplicate, Match it to a Transaction already there, or ask which of several to Match. Picks apply
 * in row order, as they do on commit, so a pick can change what later rows Match.
 */
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

/**
 * Saves a decoded bank file into an Account in one transaction, checking every row and running the
 * matcher again. New rows become Cleared, Unapproved Transactions, with the Payee and Category
 * that rename and Payee memory give their Bank Text. Matched Transactions keep what the owner entered, become Cleared, and go back to
 * Unapproved. Refused while any row still needs a pick.
 */
export const commit = mutation({
	args: fileArgs,
	returns: v.object({ added: v.number(), matched: v.number(), skipped: v.number() }),
	handler: async (ctx, { accountId, source, rows: input }) => {
		await requireOwner(ctx);
		const { rows, decisions } = await planImport(ctx, accountId, source, input);
		if (decisions.some((decision) => decision.kind === 'ask')) {
			throw publicError('INVALID_INPUT', 'Pick a Match for every row that has more than one.');
		}
		const counts = { added: 0, matched: 0, skipped: 0 };
		for (const [index, decision] of decisions.entries()) {
			const row = rows[index];
			if (row === undefined) continue;
			const bankRow = {
				source,
				...(row.sourceId === undefined ? {} : { sourceId: row.sourceId }),
				accountId,
				date: row.date,
				amount: row.amount,
				bankText: row.bankText,
				state: 'linked' as const
			};
			if (decision.kind === 'match') {
				await ctx.db.patch('transactions', decision.transactionId, {
					cleared: 'cleared',
					approved: false
				});
				await ctx.db.insert('imports', {
					...bankRow,
					transactionId: decision.transactionId,
					matched: true
				});
				counts.matched++;
			} else if (decision.kind === 'new') {
				const transactionId = await insertImported(ctx, accountId, row);
				await ctx.db.insert('imports', { ...bankRow, transactionId, matched: false });
				counts.added++;
			} else {
				counts.skipped++;
			}
		}
		return counts;
	}
});

/**
 * Splits a Matched Bank Row back into its own Cleared, Unapproved Transaction. The Transaction it
 * Matched goes back to uncleared and approved once no other Bank Row is linked to it.
 */
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
		const transactionId = await insertImported(ctx, bankRow.accountId, bankRow);
		await ctx.db.patch('imports', importId, { transactionId, matched: false });
		const stillLinked = await bankRowsOf(ctx, matchedId);
		if (stillLinked.length === 0) {
			await ctx.db.patch('transactions', matchedId, { cleared: 'uncleared', approved: true });
		}
		return transactionId;
	}
});

/**
 * A Transaction for a Bank Row of its own: Cleared and Unapproved, with the Payee and Category that
 * rename and Payee memory give its Bank Text.
 */
async function insertImported(
	ctx: MutationCtx,
	accountId: Id<'accounts'>,
	row: { date: string; amount: number; bankText: string }
) {
	return await insertTransaction(ctx, {
		accountId,
		date: row.date,
		amount: row.amount,
		...(await importedPayee(ctx, row)),
		cleared: 'cleared',
		approved: false
	});
}

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
