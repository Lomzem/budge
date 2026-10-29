import { addMonths, monthOf } from '../../src/lib/domain/dates';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type Counted = Pick<
	Doc<'transactions'>,
	'accountId' | 'date' | 'amount' | 'categoryId' | 'transferTransactionId'
>;
type Key = Pick<Doc<'monthlyTotals'>, 'month' | 'accountId' | 'bucket'>;

function keyOf(transaction: Counted): Key {
	return {
		month: monthOf(transaction.date),
		accountId: transaction.accountId,
		// A Transfer side is never Uncategorized.
		bucket:
			transaction.transferTransactionId === undefined
				? (transaction.categoryId ?? 'uncategorized')
				: 'transfer'
	};
}

/**
 * Adds a Transaction to its monthly total (`sign` 1), or takes it back out (`sign` -1). A total
 * left summing no Transactions is deleted, as the rebuild never writes one.
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
	const count = (row?.count ?? 0) + sign;
	if (row === null) {
		if (count > 0) await ctx.db.insert('monthlyTotals', { ...key, amount, count });
	} else if (count <= 0) {
		await ctx.db.delete('monthlyTotals', row._id);
	} else {
		await ctx.db.patch('monthlyTotals', row._id, { amount, count });
	}
}

/** Recreates every monthly total from the Transactions, the source of truth. */
export async function rebuildMonthlyTotals(ctx: MutationCtx) {
	for await (const row of ctx.db.query('monthlyTotals')) {
		await ctx.db.delete('monthlyTotals', row._id);
	}
	const totals = new Map<string, Key & { amount: number; count: number }>();
	for await (const transaction of ctx.db.query('transactions')) {
		const key = keyOf(transaction);
		const id = `${key.month}|${key.accountId}|${key.bucket}`;
		const total = totals.get(id) ?? { ...key, amount: 0, count: 0 };
		total.amount += transaction.amount;
		total.count += 1;
		totals.set(id, total);
	}
	for (const total of totals.values()) await ctx.db.insert('monthlyTotals', total);
}

/** Each Account's balance, summed from the monthly totals rather than its Transactions. */
export async function accountBalances(ctx: QueryCtx): Promise<Map<Id<'accounts'>, number>> {
	const balances = new Map<Id<'accounts'>, number>();
	for await (const row of ctx.db.query('monthlyTotals')) {
		balances.set(row.accountId, (balances.get(row.accountId) ?? 0) + row.amount);
	}
	return balances;
}

/**
 * Rebuilds, from the Transactions, the totals of each Category in `buckets` for each (month,
 * Account) in `keys`. For a change that touches a few Categories, it writes what the full
 * rebuild would for them, without reading the whole history.
 */
export async function rebuildTotals(
	ctx: MutationCtx,
	buckets: Iterable<Id<'categories'>>,
	keys: Iterable<Pick<Key, 'month' | 'accountId'>>
) {
	const categories = [...buckets];
	for (const { month, accountId } of keys) {
		for (const bucket of categories) {
			const key = { month, accountId, bucket };
			const row = await ctx.db
				.query('monthlyTotals')
				.withIndex('by_month_account_bucket', (q) =>
					q.eq('month', month).eq('accountId', accountId).eq('bucket', bucket)
				)
				.unique();
			if (row !== null) await ctx.db.delete('monthlyTotals', row._id);
			let amount = 0;
			let count = 0;
			const transactions = ctx.db.query('transactions').withIndex('by_category_date', (q) =>
				q
					.eq('categoryId', bucket)
					.gte('date', `${month}-01`)
					.lt('date', `${addMonths(month, 1)}-01`)
			);
			for await (const transaction of transactions) {
				if (transaction.accountId !== accountId) continue;
				amount += transaction.amount;
				count += 1;
			}
			if (count > 0) await ctx.db.insert('monthlyTotals', { ...key, amount, count });
		}
	}
}
