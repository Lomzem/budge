import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Each deployment is one owner's budget, so no table has an owner column. Amounts are whole
// cents as safe integers; dates are `YYYY-MM-DD` and months `YYYY-MM`.
export default defineSchema({
	// One row.
	settings: defineTable({
		cutoverDate: v.string()
	}),

	accounts: defineTable({
		name: v.string(),
		kind: v.union(v.literal('cash'), v.literal('creditCard')),
		position: v.number()
	}),

	payees: defineTable({
		name: v.string()
	}).index('by_name', ['name']),

	transactions: defineTable({
		accountId: v.id('accounts'),
		date: v.string(),
		amount: v.number(),
		payeeId: v.optional(v.id('payees')),
		memo: v.optional(v.string()),
		cleared: v.union(v.literal('uncleared'), v.literal('cleared'))
	})
		.index('by_account_date', ['accountId', 'date'])
		.index('by_date', ['date']),

	// A rebuildable cache of summed Transactions per month, Account, and bucket (ADR 0002). Every
	// Transaction write keeps it in the same mutation; no rule reads it as a source of truth.
	monthlyTotals: defineTable({
		month: v.string(),
		accountId: v.id('accounts'),
		bucket: v.literal('uncategorized'),
		amount: v.number()
	}).index('by_month_account_bucket', ['month', 'accountId', 'bucket'])
});
