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
		const legacy = await legacyStartingBalances(ctx);
		let repaired = 0;
		const unmatched: Id<'accounts'>[] = [];
		for await (const account of ctx.db.query('accounts')) {
			if (account.kind !== 'creditCard' || (await readPaymentCategory(ctx, account._id)) !== null) {
				continue;
			}
			const categoryId = await createPaymentCategory(ctx, account);
			const startingBalance =
				(await startingBalanceOf(ctx, account._id)) ??
				genuineLegacyRow(account, legacy.get(account._id));
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
		for (const [accountId, rows] of await legacyStartingBalances(ctx)) {
			const account = await ctx.db.get('accounts', accountId);
			const genuine = account === null ? null : genuineLegacyRow(account, rows);
			if (genuine === null || (await startingBalanceOf(ctx, accountId)) !== null) {
				unresolved.push(accountId);
				continue;
			}
			await ctx.db.patch('transactions', genuine._id, {
				kind: 'startingBalance',
				payeeId: undefined
			});
			await refreshSearchText(ctx, genuine._id);
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

async function startingBalanceOf(ctx: MutationCtx, accountId: Id<'accounts'>) {
	return await ctx.db
		.query('transactions')
		.withIndex('by_accountId_and_kind', (q) =>
			q.eq('accountId', accountId).eq('kind', 'startingBalance')
		)
		.first();
}

const MUTATION_TIME_LIMIT_MS = 1_000;

function genuineLegacyRow(account: Doc<'accounts'>, rows: readonly Doc<'transactions'>[] = []) {
	const [only, ...others] = rows;
	if (only === undefined || others.length > 0 || only.split === true) return null;
	const sinceAccount = only._creationTime - account._creationTime;
	const madeWithItsAccount = sinceAccount >= 0 && sinceAccount < MUTATION_TIME_LIMIT_MS;
	return madeWithItsAccount ? only : null;
}
