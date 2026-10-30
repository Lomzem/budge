import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import { createPaymentCategory, readPaymentCategory } from './lib/categories';
import { requireCutoverDate } from './lib/settings';
import { replaceTransaction } from './lib/transactions';

/**
 * Gives each Credit Card Account made before Credit Card Accounts arrived what a new card gets: its
 * Payment Category, holding its starting debt. Returns how many cards it repaired; running it again
 * repairs none.
 */
export const backfillPaymentCategories = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const cutoverDate = await requireCutoverDate(ctx);
		const startingBalance = await ctx.db
			.query('payees')
			.withIndex('by_name', (q) => q.eq('name', 'Starting Balance'))
			.first();
		let repaired = 0;
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
			for await (const transaction of onCutover) {
				if (
					startingBalance === null ||
					transaction.payeeId !== startingBalance._id ||
					transaction.categoryId !== undefined
				) {
					continue;
				}
				await replaceTransaction(ctx, transaction, {
					...transaction,
					categoryId,
					approved: transaction.approved !== false
				});
				break;
			}
			repaired++;
		}
		return repaired;
	}
});
