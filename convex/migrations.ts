import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { createPaymentCategory, readPaymentCategory } from './lib/categories';
import { requireCutoverDate } from './lib/settings';
import { allBankRowsOf, refreshSearchText, replaceTransaction } from './lib/transactions';

export const backfillPaymentCategories = internalMutation({
	args: {},
	returns: v.object({ repaired: v.number(), unmatched: v.array(v.id('accounts')) }),
	handler: async (ctx) => {
		const cutoverDate = await requireCutoverDate(ctx);
		let repaired = 0;
		const unmatched: Id<'accounts'>[] = [];
		for await (const account of ctx.db.query('accounts')) {
			if (account.kind !== 'creditCard' || (await readPaymentCategory(ctx, account._id)) !== null) {
				continue;
			}
			const categoryId = await createPaymentCategory(ctx, account);
			const startingBalance = await ctx.db
				.query('transactions')
				.withIndex('by_accountId_and_kind', (q) =>
					q.eq('accountId', account._id).eq('kind', 'startingBalance')
				)
				.unique();
			if (
				startingBalance?.date === cutoverDate &&
				startingBalance.categoryId === undefined &&
				startingBalance.split !== true
			) {
				await replaceTransaction(
					ctx,
					startingBalance,
					{ ...startingBalance, categoryId, approved: startingBalance.approved !== false },
					[]
				);
			} else {
				unmatched.push(account._id);
			}
			repaired++;
		}
		return { repaired, unmatched };
	}
});

const SEARCH_BACKFILL_BATCH = 50;

export const backfillSearchText = internalMutation({
	args: { cursor: v.union(v.string(), v.null()) },
	returns: v.null(),
	handler: async (ctx, { cursor }) => {
		const { page, isDone, continueCursor } = await ctx.db
			.query('transactions')
			.paginate({ numItems: SEARCH_BACKFILL_BATCH, cursor });
		for (const transaction of page) await refreshSearchText(ctx, transaction._id);
		if (!isDone) {
			await ctx.scheduler.runAfter(0, internal.migrations.backfillSearchText, {
				cursor: continueCursor
			});
		}
		return null;
	}
});

export const backfillStartingBalanceKind = internalMutation({
	args: {},
	returns: v.object({ converted: v.number(), unresolved: v.array(v.id('accounts')) }),
	handler: async (ctx) => {
		let converted = 0;
		const unresolved: Id<'accounts'>[] = [];
		for (const [accountId, [only, ...others]] of await legacyStartingBalances(ctx)) {
			if (
				only === undefined ||
				others.length > 0 ||
				only.split === true ||
				(await hasStartingBalance(ctx, accountId))
			) {
				unresolved.push(accountId);
				continue;
			}
			await ctx.db.patch('transactions', only._id, { kind: 'startingBalance', payeeId: undefined });
			await refreshSearchText(ctx, only._id);
			converted++;
		}
		return { converted, unresolved };
	}
});

async function legacyStartingBalances(ctx: MutationCtx) {
	const byAccount = new Map<Id<'accounts'>, Doc<'transactions'>[]>();
	const payee = await ctx.db
		.query('payees')
		.withIndex('by_name', (q) => q.eq('name', 'Starting Balance'))
		.unique();
	if (payee === null) return byAccount;
	const named = ctx.db
		.query('transactions')
		.withIndex('by_payee_date', (q) => q.eq('payeeId', payee._id));
	for await (const transaction of named) {
		if (transaction.transferTransactionId !== undefined) continue;
		if (await hasUnmatchedBankRow(ctx, transaction._id)) continue;
		byAccount.set(transaction.accountId, [
			...(byAccount.get(transaction.accountId) ?? []),
			transaction
		]);
	}
	return byAccount;
}

async function hasUnmatchedBankRow(ctx: MutationCtx, transactionId: Id<'transactions'>) {
	for await (const bankRow of allBankRowsOf(ctx, transactionId)) {
		if (!bankRow.matched) return true;
	}
	return false;
}

async function hasStartingBalance(ctx: MutationCtx, accountId: Id<'accounts'>) {
	const found = await ctx.db
		.query('transactions')
		.withIndex('by_accountId_and_kind', (q) =>
			q.eq('accountId', accountId).eq('kind', 'startingBalance')
		)
		.first();
	return found !== null;
}
