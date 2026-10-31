import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';
import { createPaymentCategory, readPaymentCategory } from './lib/categories';
import { requireCutoverDate } from './lib/settings';
import { replaceTransaction } from './lib/transactions';

/**
 * Gives each Credit Card Account made before Credit Card Accounts arrived what a new card gets: its
 * Payment Category, holding its starting debt. Returns how many cards it repaired, and the cards whose
 * starting debt it couldn't find because the owner has since changed its date or Payee, or split it; the
 * owner moves those into the Payment Category by hand. Running it again repairs none.
 */
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
					// A split's lines hold its Categories, so a split starting debt stays as the owner left it.
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
