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
		const startingBalance = await ctx.db
			.query('payees')
			.withIndex('by_name', (q) => q.eq('name', 'Starting Balance'))
			.first();
		let repaired = 0;
		const unmatched: Id<'accounts'>[] = [];
		for await (const account of ctx.db.query('accounts')) {
			if (account.kind !== 'creditCard' || (await readPaymentCategory(ctx, account._id)) !== null) {
				continue;
			}
			const categoryId = await createPaymentCategory(ctx, account);
			const onCutover = ctx.db
				.query('transactions')
				.withIndex('by_account_date', (q) =>
					q.eq('accountId', account._id).eq('date', cutoverDate)
				);
			let matched = false;
			for await (const transaction of onCutover) {
				if (
					startingBalance === null ||
					transaction.payeeId !== startingBalance._id ||
					transaction.categoryId !== undefined ||
					transaction.split === true
				) {
					continue;
				}
				await replaceTransaction(ctx, transaction, {
					...transaction,
					categoryId,
					approved: transaction.approved !== false
				});
				matched = true;
				break;
			}
			if (!matched) unmatched.push(account._id);
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
