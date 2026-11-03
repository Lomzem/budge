import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { api, internal } from './_generated/api';

export const initialize = mutation({
	args: {},
	handler: async (ctx) => {
		await ctx.db.insert('settings', { cutoverDate: '2020-01-01' });
		const accountId = await ctx.db.insert('accounts', {
			name: 'Invented Capacity Account',
			kind: 'cash',
			position: 0
		});
		const groupId = await ctx.db.insert('categoryGroups', {
			name: 'Invented',
			kind: 'normal',
			position: 0
		});
		const categoryId = await ctx.db.insert('categories', {
			groupId,
			name: 'Invented Capacity',
			kind: 'normal',
			position: 0
		});
		return { accountId, categoryId };
	}
});

export const prepare = mutation({
	args: {
		accountId: v.id('accounts'),
		categoryId: v.id('categories'),
		start: v.number(),
		count: v.number(),
		history: v.boolean(),
		perMonth: v.number()
	},
	handler: async (ctx, args) => {
		for (let i = args.start; i < args.start + args.count; i++) {
			const month = Math.floor(i / args.perMonth);
			const date = args.history
				? `${2020 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}-15`
				: '2024-06-15';
			const bankText = `Invented Capacity ${String(i).padStart(6, '0')} `.padEnd(500, 'x');
			const payeeId = await ctx.db.insert('payees', {
				name: bankText,
				lastCategoryId: args.categoryId
			});
			await ctx.db.insert('payeeRenames', { bankText, payeeId });
			const split = args.history && i % 10 === 0;
			const transactionId = await ctx.db.insert('transactions', {
				accountId: args.accountId,
				categoryId: args.categoryId,
				date,
				amount: -100,
				cleared: 'uncleared',
				payeeId,
				...(split ? { split: true } : {})
			});
			if (split) {
				for (const amount of [-40, -60])
					await ctx.db.insert('transactionSplits', {
						transactionId,
						categoryId: args.categoryId,
						date,
						amount
					});
			}
		}
		return args.count;
	}
});

export const preview = query({
	args: { input: v.any() },
	handler: async (ctx, { input }) => {
		const result = await ctx.runQuery(api.imports.preview, input);
		return { result, metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const commit = mutation({
	args: { input: v.any() },
	handler: async (ctx, { input }) => {
		const result = await ctx.runMutation(api.imports.commit, input);
		return { result, metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const rebuild = mutation({
	args: {},
	handler: async (ctx) => {
		await ctx.runMutation(internal.monthlyTotals.rebuild, {});
		return { metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const totals = query({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db.query('monthlyTotals').collect();
		return {
			rows: rows.length,
			amount: rows.reduce((sum, row) => sum + row.amount, 0),
			count: rows.reduce((sum, row) => sum + row.count, 0)
		};
	}
});
