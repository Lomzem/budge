import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { insertAccount, saveStartingBalance } from './lib/accounts';
import { requireName } from './lib/input';
import { readPaymentCategory } from './lib/categories';
import { accountBalances } from './lib/monthlyTotals';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';

const accountKind = v.union(v.literal('cash'), v.literal('creditCard'));

/** Every Account in sidebar order, with its balance and when it was last Reconciled. */
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

/**
 * Creates an Account at the end of the sidebar. Its starting balance is an ordinary Cleared
 * Transaction dated on the cutover date; a card's debt is negative.
 */
export const create = mutation({
	args: { name: v.string(), kind: accountKind, startingBalance: v.number() },
	returns: v.id('accounts'),
	handler: async (ctx, args) => {
		await requireOwner(ctx);
		return await insertAccount(ctx, args);
	}
});

/**
 * Confirms or corrects an Account's starting balance, saved as its Starting Balance Transaction on
 * the cutover date; a card's debt is negative.
 */
export const setStartingBalance = mutation({
	args: { accountId: v.id('accounts'), startingBalance: v.number() },
	returns: v.null(),
	handler: async (ctx, { accountId, startingBalance }) => {
		await requireOwner(ctx);
		await saveStartingBalance(ctx, accountId, startingBalance);
		return null;
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
		// A card's Payment Category goes by the card's name.
		const payment = await readPaymentCategory(ctx, args.accountId);
		if (payment !== null) await ctx.db.patch('categories', payment._id, { name });
		return null;
	}
});

/** Puts the Accounts in the given order, which must name every Account exactly once. */
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
