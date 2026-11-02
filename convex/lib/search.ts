import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { refreshSearchText } from './transactions';

export const PAYEE_RENAME_BATCH = 50;

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
