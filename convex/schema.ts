import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { targetValidator } from './lib/targets';

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

	// Ready to Assign is a system Category in a hidden system group, and each Credit Card Account
	// has a Payment Category in the system Credit Card Payments group. Budge manages the system
	// ones, so the owner can't change them. `position` orders siblings: groups among the normal
	// groups, Categories within a group.
	// `hidden` takes a group or Category out of the budget table; it still counts in every total.
	categoryGroups: defineTable({
		name: v.string(),
		position: v.number(),
		kind: v.union(v.literal('normal'), v.literal('readyToAssign'), v.literal('creditCardPayments')),
		hidden: v.optional(v.boolean())
	}),

	categories: defineTable({
		groupId: v.id('categoryGroups'),
		name: v.string(),
		position: v.number(),
		kind: v.union(v.literal('normal'), v.literal('readyToAssign'), v.literal('creditCardPayment')),
		hidden: v.optional(v.boolean()),
		target: v.optional(targetValidator),
		// A Payment Category's Credit Card Account.
		accountId: v.optional(v.id('accounts'))
	})
		.index('by_group_position', ['groupId', 'position'])
		.index('by_account', ['accountId']),

	// Assigned per month and Category. Setting Assigned to 0 deletes the row.
	assignments: defineTable({
		month: v.string(),
		categoryId: v.id('categories'),
		amount: v.number()
	})
		.index('by_month_category', ['month', 'categoryId'])
		.index('by_category_month', ['categoryId', 'month']),

	// Payee memory: `lastCategoryId` is the Category the Payee's latest categorized Transaction
	// was given. It may point at a deleted Category, which reads as none.
	payees: defineTable({
		name: v.string(),
		lastCategoryId: v.optional(v.id('categories'))
	}).index('by_name', ['name']),

	// Rename memory: renaming the Payee on an imported Transaction maps its exact Bank Text to that
	// Payee, so later imports with the same Bank Text arrive under it.
	payeeRenames: defineTable({
		bankText: v.string(),
		payeeId: v.id('payees')
	}).index('by_bankText', ['bankText']),

	transactions: defineTable({
		accountId: v.id('accounts'),
		date: v.string(),
		amount: v.number(),
		payeeId: v.optional(v.id('payees')),
		// No Category means Uncategorized.
		categoryId: v.optional(v.id('categories')),
		memo: v.optional(v.string()),
		cleared: v.union(v.literal('uncleared'), v.literal('cleared')),
		// Imported Transactions arrive Unapproved (`false`). Left out on Transactions written before
		// imports existed, which read as approved.
		approved: v.optional(v.boolean()),
		// Set on each side of a Transfer, pointing at the other side. The two sides have opposite
		// amounts, the same date, and no Category; there is no Transfer table.
		transferTransactionId: v.optional(v.id('transactions'))
	})
		.index('by_account_date', ['accountId', 'date'])
		.index('by_date', ['date'])
		.index('by_category_date', ['categoryId', 'date'])
		// Unapproved first: `approved: false` ranges for the review list.
		.index('by_approved_date', ['approved', 'date'])
		.index('by_account_approved_date', ['accountId', 'approved', 'date']),

	// Bank Rows: what a bank reported, kept apart from what the owner entered. A Bank Row links to
	// the Transaction it created or Matched. Rows are never deleted, so a known import ID (or, for
	// CSV rows without one, an identical row) is skipped when the same file comes back.
	imports: defineTable({
		source: v.union(v.literal('plaid'), v.literal('qfx'), v.literal('csv')),
		// The bank's import ID, unique within the Account and source. CSV rows have none.
		sourceId: v.optional(v.string()),
		accountId: v.id('accounts'),
		// Bank sync's Plaid Account the row arrived through; ticket 17 narrows it to an ID.
		connectionAccountId: v.optional(v.string()),
		date: v.string(),
		amount: v.number(),
		bankText: v.string(),
		// Left out once the Transaction is deleted, so the row still blocks a re-import.
		transactionId: v.optional(v.id('transactions')),
		// Whether the row Matched a Transaction already there, rather than creating its own.
		matched: v.boolean(),
		state: v.union(
			v.literal('linked'),
			v.literal('held'),
			v.literal('changed'),
			v.literal('removed')
		)
	})
		.index('by_account_source_sourceId_date', ['accountId', 'source', 'sourceId', 'date'])
		.index('by_transactionId', ['transactionId'])
		.index('by_connectionAccountId_state', ['connectionAccountId', 'state']),

	// A rebuildable cache of summed Transactions per month, Account, and bucket (ADR 0002). Every
	// Transaction write keeps it in the same mutation; no rule reads it as a source of truth.
	// `count` is how many Transactions it sums, so the budget can count Uncategorized ones.
	monthlyTotals: defineTable({
		month: v.string(),
		accountId: v.id('accounts'),
		bucket: v.union(v.id('categories'), v.literal('uncategorized'), v.literal('transfer')),
		amount: v.number(),
		count: v.number()
	}).index('by_month_account_bucket', ['month', 'accountId', 'bucket'])
});
