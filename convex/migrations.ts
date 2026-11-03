import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';
import { createPaymentCategory, readPaymentCategory } from './lib/categories';
import { requireCutoverDate } from './lib/settings';
import { refreshSearchText, replaceTransaction } from './lib/transactions';

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
