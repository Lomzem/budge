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
		diverse: v.optional(v.boolean()),
		perMonth: v.number()
	},
	handler: async (ctx, args) => {
		for (let i = args.start; i < args.start + args.count; i++) {
			const month = Math.floor(i / args.perMonth);
			let date = '2024-06-15';
			if (args.history)
				date = `${2020 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}-15`;
			else if (args.diverse)
				date = `${2020 + Math.floor((i % 60) / 12)}-${String((i % 12) + 1).padStart(2, '0')}-15`;
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

const CUTOVER_FROM = '2020-01-01';
const CUTOVER_TO = '2024-01-01';
const wide = (label, i) =>
	`Invented Cutover ${label} ${String(i).padStart(6, '0')} `.padEnd(500, 'x');
const earlierDate = (i) =>
	`${2020 + Math.floor((i % 48) / 12)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;

export const cutoverBase = mutation({
	args: { accounts: v.number() },
	handler: async (ctx, { accounts }) => {
		await ctx.db.insert('settings', { cutoverDate: CUTOVER_FROM });
		const groupIds = [];
		for (let g = 0; g < 20; g++) {
			groupIds.push(
				await ctx.db.insert('categoryGroups', {
					name: wide('Group', g).slice(0, 100),
					kind: 'normal',
					position: g
				})
			);
		}
		const readyGroup = await ctx.db.insert('categoryGroups', {
			name: 'Invented Ready',
			kind: 'readyToAssign',
			position: 20
		});
		const readyToAssign = await ctx.db.insert('categories', {
			groupId: readyGroup,
			name: 'Ready to Assign',
			kind: 'readyToAssign',
			position: 0
		});
		for (let c = 0; c < 999; c++) {
			await ctx.db.insert('categories', {
				groupId: groupIds[c % 20],
				name: wide('Category', c).slice(0, 100),
				kind: 'normal',
				position: c
			});
		}
		for (let a = 0; a < accounts; a++) {
			const accountId = await ctx.db.insert('accounts', {
				name: wide('Account', a).slice(0, 100),
				kind: 'cash',
				position: a
			});
			await ctx.db.insert('transactions', {
				accountId,
				date: CUTOVER_FROM,
				amount: 1_000_000,
				categoryId: readyToAssign,
				memo: wide('Opening', a),
				cleared: a % 2 === 0 ? 'reconciled' : 'cleared',
				approved: true,
				kind: 'startingBalance'
			});
		}
		return null;
	}
});

export const cutoverAssignments = mutation({
	args: { start: v.number(), count: v.number() },
	handler: async (ctx, { start, count }) => {
		const categories = (await ctx.db.query('categories').take(1000)).filter(
			(c) => c.kind === 'normal'
		);
		for (let i = start; i < start + count; i++) {
			const month = Math.floor(i / categories.length);
			await ctx.db.insert('assignments', {
				month: `${2020 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}`,
				categoryId: categories[i % categories.length]._id,
				amount: 100
			});
		}
		return count;
	}
});

export const cutoverHistory = mutation({
	args: {
		start: v.number(),
		count: v.number(),
		transferPairs: v.number(),
		lines: v.number(),
		bankRows: v.number(),
		others: v.number()
	},
	handler: async (ctx, { start, count, transferPairs, lines, bankRows, others }) => {
		const share = (total, k) => Math.floor(total / others) + (k < total % others ? 1 : 0);
		const accounts = await ctx.db.query('accounts').take(200);
		const categories = (await ctx.db.query('categories').take(1000)).filter(
			(c) => c.kind === 'normal'
		);
		for (let i = start; i < start + count; i++) {
			const date = earlierDate(i);
			const accountId = accounts[i % accounts.length]._id;
			const cleared = i % 2 === 0 ? 'reconciled' : 'uncleared';
			if (i < transferPairs) {
				const otherId = accounts[(i + 1) % accounts.length]._id;
				const first = await ctx.db.insert('transactions', {
					accountId,
					date,
					amount: -2_500,
					memo: wide('Transfer', i),
					cleared,
					approved: true
				});
				const second = await ctx.db.insert('transactions', {
					accountId: otherId,
					date,
					amount: 2_500,
					memo: wide('Transfer back', i),
					cleared,
					approved: true,
					transferTransactionId: first
				});
				await ctx.db.patch('transactions', first, { transferTransactionId: second });
				continue;
			}
			const linesPer = share(lines, i - transferPairs);
			const bankRowsPer = share(bankRows, i - transferPairs);
			const bankText = wide('Payee', i);
			const payeeId = await ctx.db.insert('payees', { name: bankText });
			const transactionId = await ctx.db.insert('transactions', {
				accountId,
				date,
				amount: -1_000 * Math.max(1, linesPer),
				payeeId,
				...(linesPer > 0 ? { split: true } : { categoryId: categories[i % categories.length]._id }),
				memo: wide('Memo', i),
				cleared,
				approved: true
			});
			for (let line = 0; line < linesPer; line++) {
				await ctx.db.insert('transactionSplits', {
					transactionId,
					categoryId: categories[(i * linesPer + line) % categories.length]._id,
					date,
					amount: -1_000,
					memo: wide('Line', i * linesPer + line)
				});
			}
			for (let row = 0; row < bankRowsPer; row++) {
				await ctx.db.insert('imports', {
					source: 'qfx',
					sourceId: `invented-cutover-${i}-${row}`,
					accountId,
					date,
					amount: -1_000 * Math.max(1, linesPer),
					bankText,
					transactionId,
					matched: row === 0,
					state: 'linked'
				});
			}
		}
		return count;
	}
});

export const cutoverTotalsFill = mutation({
	args: { start: v.number(), count: v.number() },
	handler: async (ctx, { start, count }) => {
		const accounts = await ctx.db.query('accounts').take(200);
		const categories = (await ctx.db.query('categories').take(1000)).filter(
			(c) => c.kind === 'normal'
		);
		for (let i = start; i < start + count; i++) {
			const month = 48 + (i % 34);
			const combo = Math.floor(i / 34);
			await ctx.db.insert('monthlyTotals', {
				month: `${2020 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}`,
				accountId: accounts[combo % accounts.length]._id,
				bucket: categories[Math.floor(combo / accounts.length)]._id,
				amount: 0,
				count: 0
			});
		}
		return count;
	}
});

export const cutoverPreview = query({
	args: { today: v.string() },
	handler: async (ctx, { today }) => {
		const result = await ctx.runQuery(api.settings.previewLaterCutover, {
			cutoverDate: CUTOVER_TO,
			today
		});
		return { result, metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const cutoverApply = mutation({
	args: { today: v.string(), fingerprint: v.string() },
	handler: async (ctx, { today, fingerprint }) => {
		const result = await ctx.runMutation(api.settings.applyLaterCutover, {
			cutoverDate: CUTOVER_TO,
			today,
			fingerprint,
			unlockReconciled: true
		});
		return { result, metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const cutoverUndo = mutation({
	args: { moveId: v.string() },
	handler: async (ctx, { moveId }) => {
		const result = await ctx.runMutation(api.settings.undoLaterCutover, { moveId });
		return { result, metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const cutoverState = query({
	args: {},
	handler: async (ctx) => ({
		cutoverDate: (await ctx.db.query('settings').first())?.cutoverDate,
		transactions: (await ctx.db.query('transactions').collect()).length,
		splitLines: (await ctx.db.query('transactionSplits').collect()).length,
		linkedBankRows: (await ctx.db.query('imports').collect()).filter(
			(row) => row.transactionId !== undefined
		).length,
		assignments: (await ctx.db.query('assignments').collect()).length,
		totals: (await ctx.db.query('monthlyTotals').collect()).length
	})
});

const bulkWide = (label, i) =>
	`Invented Bulk ${label} ${String(i).padStart(6, '0')} `.padEnd(500, 'x');

export const bulkBase = mutation({
	args: { categoryId: v.id('categories') },
	handler: async (ctx, { categoryId }) => {
		const category = await ctx.db.get('categories', categoryId);
		return await ctx.db.insert('categories', {
			groupId: category.groupId,
			name: 'Invented Bulk',
			kind: 'normal',
			position: 1
		});
	}
});

export const bulkRows = mutation({
	args: {
		accountId: v.id('accounts'),
		categoryId: v.id('categories'),
		start: v.number(),
		count: v.number()
	},
	handler: async (ctx, { accountId, categoryId, start, count }) => {
		for (let i = start; i < start + count; i++) {
			const date = diverseBulkDate(i);
			const bankText = bulkWide('Payee', i);
			const payeeId = await ctx.db.insert('payees', { name: bankText, lastCategoryId: categoryId });
			await ctx.db.insert('payeeRenames', { bankText, payeeId });
			const transactionId = await ctx.db.insert('transactions', {
				accountId,
				categoryId,
				date,
				amount: -100,
				payeeId,
				memo: bulkWide('Memo', i),
				cleared: 'uncleared',
				approved: false
			});
			await ctx.db.insert('imports', {
				source: 'qfx',
				sourceId: `invented-bulk-${i}`,
				accountId,
				date,
				amount: -100,
				bankText,
				transactionId,
				matched: true,
				state: 'linked'
			});
		}
		return count;
	}
});

function diverseBulkDate(i) {
	return `${2020 + Math.floor((i % 60) / 12)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
}

export const bulkIds = query({
	args: {},
	handler: async (ctx) => (await ctx.db.query('transactions').collect()).map((row) => row._id)
});

export const bulkCategorize = mutation({
	args: { transactionIds: v.array(v.id('transactions')), categoryId: v.id('categories') },
	handler: async (ctx, { transactionIds, categoryId }) => {
		const result = await ctx.runMutation(api.transactions.categorizeMany, {
			transactionIds,
			categoryId,
			approve: true
		});
		return { result, metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const bulkUndo = mutation({
	args: { record: v.any() },
	handler: async (ctx, { record }) => {
		const result = await ctx.runMutation(api.transactions.undoCategorizeMany, record);
		return { result, metrics: await ctx.meta.getTransactionMetrics() };
	}
});

export const bulkState = query({
	args: { categoryId: v.id('categories') },
	handler: async (ctx, { categoryId }) => {
		const rows = await ctx.db.query('transactions').collect();
		const totals = await ctx.db.query('monthlyTotals').collect();
		return {
			inCategory: rows.filter((row) => row.categoryId === categoryId).length,
			unapproved: rows.filter((row) => row.approved === false).length,
			totalsInCategory: totals
				.filter((row) => row.bucket === categoryId)
				.reduce((sum, row) => sum + row.count, 0)
		};
	}
});
