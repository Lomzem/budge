import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { refreshSearchText } from './transactions';

/**
 * How many Transactions one mutation rewrites when a Payee is renamed. Each reads its Payee, up to
 * 50 split lines, and its Bank Rows, so a batch stays well inside Convex's read limits.
 */
export const PAYEE_RENAME_BATCH = 50;

/**
 * Rewrites the `searchText` of one batch of a Payee's Transactions, from `cursor`, and schedules
 * the next batch until none are left. Rewriting is idempotent, so a second rename while batches are
 * still running only repeats work.
 */
export async function refreshPayeeSearchText(
	ctx: MutationCtx,
	payeeId: Id<'payees'>,
	cursor: string | null
) {
	const { page, isDone, continueCursor } = await ctx.db
		.query('transactions')
		.withIndex('by_payee_date', (q) => q.eq('payeeId', payeeId))
		.paginate({ numItems: PAYEE_RENAME_BATCH, cursor });
	for (const transaction of page) await refreshSearchText(ctx, transaction._id);
	if (!isDone) {
		await ctx.scheduler.runAfter(0, internal.payees.refreshSearchText, {
			payeeId,
			cursor: continueCursor
		});
	}
}
