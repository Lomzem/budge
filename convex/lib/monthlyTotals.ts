import { monthOf } from '../../src/lib/domain/dates';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type Counted = Pick<Doc<'transactions'>, 'accountId' | 'date' | 'amount'>;
type Key = Pick<Doc<'monthlyTotals'>, 'month' | 'accountId' | 'bucket'>;

// Transactions have no Category yet, so every one is Uncategorized.
function keyOf(transaction: Counted): Key {
	return {
		month: monthOf(transaction.date),
		accountId: transaction.accountId,
		bucket: 'uncategorized'
	};
}

/**
 * Adds a Transaction's amount to its monthly total (`sign` 1), or takes it back out (`sign` -1).
 * A total that reaches zero is deleted, as the rebuild never writes one.
 */
export async function countTransaction(ctx: MutationCtx, transaction: Counted, sign: 1 | -1) {
	const key = keyOf(transaction);
	const delta = sign * transaction.amount;
	const row = await ctx.db
		.query('monthlyTotals')
		.withIndex('by_month_account_bucket', (q) =>
			q.eq('month', key.month).eq('accountId', key.accountId).eq('bucket', key.bucket)
		)
		.unique();
	const amount = (row?.amount ?? 0) + delta;
	if (row === null) {
		if (amount !== 0) await ctx.db.insert('monthlyTotals', { ...key, amount });
	} else if (amount === 0) {
		await ctx.db.delete('monthlyTotals', row._id);
	} else {
		await ctx.db.patch('monthlyTotals', row._id, { amount });
	}
}

/** Recreates every monthly total from the Transactions, the source of truth. */
export async function rebuildMonthlyTotals(ctx: MutationCtx) {
	for await (const row of ctx.db.query('monthlyTotals')) {
		await ctx.db.delete('monthlyTotals', row._id);
	}
	const totals = new Map<string, Key & { amount: number }>();
	for await (const transaction of ctx.db.query('transactions')) {
		const key = keyOf(transaction);
		const id = `${key.month}|${key.accountId}|${key.bucket}`;
		const total = totals.get(id) ?? { ...key, amount: 0 };
		total.amount += transaction.amount;
		totals.set(id, total);
	}
	for (const total of totals.values()) {
		if (total.amount !== 0) await ctx.db.insert('monthlyTotals', total);
	}
}

/** Each Account's balance, summed from the monthly totals rather than its Transactions. */
export async function accountBalances(ctx: QueryCtx): Promise<Map<Id<'accounts'>, number>> {
	const balances = new Map<Id<'accounts'>, number>();
	for await (const row of ctx.db.query('monthlyTotals')) {
		balances.set(row.accountId, (balances.get(row.accountId) ?? 0) + row.amount);
	}
	return balances;
}
