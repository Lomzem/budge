import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { confirmStartingBalance, insertAccount, startingBalanceOf } from './lib/accounts';
import { requireName } from './lib/input';
import { readPaymentCategory } from './lib/categories';
import { accountBalances } from './lib/monthlyTotals';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';

const accountKind = v.union(v.literal('cash'), v.literal('creditCard'));

export const list = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id('accounts'),
			name: v.string(),
			kind: accountKind,
			balance: v.number(),
			lastReconciledOn: v.union(v.string(), v.null())
		})
	),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const balances = await accountBalances(ctx);
		const accounts = [];
		for await (const account of ctx.db.query('accounts')) accounts.push(account);
		return accounts
			.sort((a, b) => a.position - b.position)
			.map(({ _id, name, kind, lastReconciledOn }) => ({
				_id,
				name,
				kind,
				balance: balances.get(_id) ?? 0,
				lastReconciledOn: lastReconciledOn ?? null
			}));
	}
});

export const create = mutation({
	args: { name: v.string(), kind: accountKind, startingBalance: v.number() },
	returns: v.id('accounts'),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		return await insertAccount(ctx, args);
	}
});

export const setStartingBalance = mutation({
	args: { accountId: v.id('accounts'), startingBalance: v.number() },
	returns: v.null(),
	handler: async (ctx, { accountId, startingBalance }) => {
		await requireOwner(ctx);
		await confirmStartingBalance(ctx, accountId, startingBalance);
		return null;
	}
});

export const startingBalance = query({
	args: { accountId: v.id('accounts') },
	returns: v.union(v.number(), v.null()),
	handler: async (ctx, { accountId }) => {
		await requireOwner(ctx);
		return (await startingBalanceOf(ctx, accountId))?.amount ?? null;
	}
});

export const rename = mutation({
	args: { accountId: v.id('accounts'), name: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		const name = requireName(args.name);
		if ((await ctx.db.get('accounts', args.accountId)) === null) throw publicError('NOT_FOUND');
		await ctx.db.patch('accounts', args.accountId, { name });
		const cardPaymentCategory = await readPaymentCategory(ctx, args.accountId);
		if (cardPaymentCategory !== null) {
			await ctx.db.patch('categories', cardPaymentCategory._id, { name });
		}
		return null;
	}
});

export const reorder = mutation({
	args: { accountIds: v.array(v.id('accounts')) },
	returns: v.null(),
	handler: async (ctx, { accountIds }) => {
		await requireOwner(ctx);
		const existing = new Set<string>();
		for await (const account of ctx.db.query('accounts')) existing.add(account._id);
		const named = new Set<string>(accountIds);
		if (
			named.size !== accountIds.length ||
			named.size !== existing.size ||
			accountIds.some((id) => !existing.has(id))
		) {
			throw publicError('INVALID_INPUT', 'List every Account once.');
		}
		for (const [position, accountId] of accountIds.entries()) {
			await ctx.db.patch('accounts', accountId, { position });
		}
		return null;
	}
});
