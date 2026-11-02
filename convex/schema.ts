import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { targetValidator } from './lib/targets';

export default defineSchema({
	settings: defineTable({
		cutoverDate: v.string()
	}),

	accounts: defineTable({
		name: v.string(),
		kind: v.union(v.literal('cash'), v.literal('creditCard')),
		position: v.number(),

		lastReconciledOn: v.optional(v.string())
	}),

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

		accountId: v.optional(v.id('accounts'))
	})
		.index('by_group_position', ['groupId', 'position'])
		.index('by_account', ['accountId']),

	assignments: defineTable({
		month: v.string(),
		categoryId: v.id('categories'),
		amount: v.number()
	})
		.index('by_month_category', ['month', 'categoryId'])
		.index('by_category_month', ['categoryId', 'month']),

	payees: defineTable({
		name: v.string(),
		lastCategoryId: v.optional(v.id('categories'))
	}).index('by_name', ['name']),

	payeeRenames: defineTable({
		bankText: v.string(),
		payeeId: v.id('payees')
	}).index('by_bankText', ['bankText']),

	transactions: defineTable({
		accountId: v.id('accounts'),
		date: v.string(),
		amount: v.number(),
		payeeId: v.optional(v.id('payees')),

		categoryId: v.optional(v.id('categories')),

		split: v.optional(v.literal(true)),
		memo: v.optional(v.string()),

		cleared: v.union(v.literal('uncleared'), v.literal('cleared'), v.literal('reconciled')),

		approved: v.optional(v.boolean()),

		transferTransactionId: v.optional(v.id('transactions')),

		searchText: v.optional(v.string())
	})
		.index('by_account_date', ['accountId', 'date'])

		.index('by_account_cleared_date', ['accountId', 'cleared', 'date'])
		.index('by_date', ['date'])
		.index('by_category_date', ['categoryId', 'date'])
		.index('by_payee_date', ['payeeId', 'date'])

		.index('by_approved_date', ['approved', 'date'])
		.index('by_account_approved_date', ['accountId', 'approved', 'date'])

		.searchIndex('search_text', {
			searchField: 'searchText',
			filterFields: ['accountId', 'categoryId', 'payeeId', 'split']
		}),

	transactionSplits: defineTable({
		transactionId: v.id('transactions'),
		categoryId: v.id('categories'),
		amount: v.number(),
		memo: v.optional(v.string()),
		date: v.string()
	})
		.index('by_category_date', ['categoryId', 'date'])
		.index('by_transaction', ['transactionId']),

	imports: defineTable({
		source: v.union(v.literal('plaid'), v.literal('qfx'), v.literal('csv')),

		sourceId: v.optional(v.string()),
		accountId: v.id('accounts'),

		connectionAccountId: v.optional(v.id('connectionAccounts')),
		date: v.string(),
		amount: v.number(),
		bankText: v.string(),

		transactionId: v.optional(v.id('transactions')),

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

	bankConnections: defineTable({
		name: v.string(),
		status: v.union(v.literal('ok'), v.literal('needsAttention')),
		lastSyncedAt: v.optional(v.number()),

		lastError: v.optional(v.object({ at: v.number(), message: v.string() })),

		syncLeaseUntil: v.optional(v.number()),
		consentExpiresAt: v.optional(v.number()),
		provider: v.union(
			v.object({
				kind: v.literal('plaid'),
				itemId: v.string(),
				encryptedToken: v.string(),

				cursor: v.optional(v.string()),

				updateStart: v.optional(v.union(v.string(), v.null()))
			}),
			v.object({ kind: v.literal('sandbox') })
		)
	}).index('by_itemId', ['provider.itemId']),

	connectionAccounts: defineTable(
		v.union(
			v.object({
				connectionId: v.id('bankConnections'),
				externalId: v.string(),
				state: v.literal('mapped'),
				accountId: v.id('accounts')
			}),
			v.object({
				connectionId: v.id('bankConnections'),
				externalId: v.string(),
				state: v.union(v.literal('held'), v.literal('ignored'))
			})
		)
	).index('by_connection_externalId', ['connectionId', 'externalId']),

	monthlyTotals: defineTable({
		month: v.string(),
		accountId: v.id('accounts'),
		bucket: v.union(v.id('categories'), v.literal('uncategorized'), v.literal('transfer')),
		amount: v.number(),
		count: v.number()
	}).index('by_month_account_bucket', ['month', 'accountId', 'bucket'])
});
