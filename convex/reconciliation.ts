import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { ensureReadyToAssign } from './lib/categories';
import { requireCents } from './lib/input';
import { accountBalances } from './lib/monthlyTotals';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { insertTransaction, markCleared, transactionFields } from './lib/transactions';

export const clearedBalance = query({
	args: { accountId: v.id('accounts') },
	returns: v.number(),
	handler: async (ctx, { accountId }) => {
		await requireOwner(ctx);
		await requireAccount(ctx, accountId);
		return await clearedBalanceOf(ctx, accountId);
	}
});

export const reconcile = mutation({
	args: { accountId: v.id('accounts'), balance: v.number(), date: v.string() },
	returns: v.number(),
	handler: async (ctx, { accountId, balance, date }) => {
		await requireOwner(ctx);
		await requireAccount(ctx, accountId);
		const adjustment = requireCents(balance) - (await clearedBalanceOf(ctx, accountId));
		const fields = await transactionFields(ctx, {
			accountId,
			date,
			amount: adjustment,
			payee: 'Reconciliation Adjustment',
			categoryId: await ensureReadyToAssign(ctx),
			memo: ''
		});
		if (adjustment !== 0) {
			await insertTransaction(ctx, { ...fields, cleared: 'cleared', approved: true });
		}
		const cleared: Doc<'transactions'>[] = [];
		for await (const transaction of byCleared(ctx, accountId, 'cleared')) {
			cleared.push(transaction);
		}
		for (const transaction of cleared) {
			await markCleared(ctx, transaction._id, 'reconciled');
		}
		await ctx.db.patch('accounts', accountId, { lastReconciledOn: date });
		return adjustment;
	}
});

async function requireAccount(ctx: QueryCtx, accountId: Id<'accounts'>) {
	const account = await ctx.db.get('accounts', accountId);
	if (account === null) throw publicError('NOT_FOUND');
	return account;
}

async function clearedBalanceOf(ctx: QueryCtx, accountId: Id<'accounts'>) {
	let balance = (await accountBalances(ctx)).get(accountId) ?? 0;
	for await (const transaction of byCleared(ctx, accountId, 'uncleared')) {
		balance -= transaction.amount;
	}
	return balance;
}

function byCleared(
	ctx: QueryCtx,
	accountId: Id<'accounts'>,
	cleared: Doc<'transactions'>['cleared']
) {
	return ctx.db
		.query('transactions')
		.withIndex('by_account_cleared_date', (q) =>
			q.eq('accountId', accountId).eq('cleared', cleared)
		);
}
