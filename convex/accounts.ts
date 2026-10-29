import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireCents, requireName } from './lib/input';
import { ensureReadyToAssign } from './lib/categories';
import { accountBalances } from './lib/monthlyTotals';
import { requireOwner } from './lib/owner';
import { publicError } from './lib/publicError';
import { requireCutoverDate } from './lib/settings';
import { insertTransaction, transactionFields } from './lib/transactions';

const accountKind = v.union(v.literal('cash'), v.literal('creditCard'));

/** Every Account in sidebar order, with its balance. */
export const list = query({
	args: {},
	returns: v.array(
		v.object({ _id: v.id('accounts'), name: v.string(), kind: accountKind, balance: v.number() })
	),
	handler: async (ctx) => {
		await requireOwner(ctx);
		const balances = await accountBalances(ctx);
		const accounts = [];
		for await (const account of ctx.db.query('accounts')) accounts.push(account);
		return accounts
			.sort((a, b) => a.position - b.position)
			.map(({ _id, name, kind }) => ({ _id, name, kind, balance: balances.get(_id) ?? 0 }));
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
		const name = requireName(args.name);
		const amount = requireCents(args.startingBalance);
		const cutoverDate = await requireCutoverDate(ctx);
		let position = 0;
		for await (const account of ctx.db.query('accounts')) {
			position = Math.max(position, account.position + 1);
		}
		const accountId = await ctx.db.insert('accounts', { name, kind: args.kind, position });
		const fields = await transactionFields(ctx, {
			accountId,
			date: cutoverDate,
			amount,
			payee: 'Starting Balance',
			// A Cash Account's starting balance is money to budget. A card's debt touches no
			// Category (Credit Card Accounts arrive in full later), so it stays Uncategorized.
			...(args.kind === 'cash' ? { categoryId: await ensureReadyToAssign(ctx) } : {}),
			memo: ''
		});
		await insertTransaction(ctx, { ...fields, cleared: 'cleared', approved: true });
		return accountId;
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
