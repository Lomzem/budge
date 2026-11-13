import { v, type Infer } from 'convex/values';

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { createPaymentCategory, ensureReadyToAssign, readPaymentCategory } from './categories';
import { requireCents, requireName } from './input';
import { publicError } from './publicError';
import { requireCutoverDate } from './settings';
import {
	allBankRowsOf,
	insertTransaction,
	replaceTransaction,
	requireUnlocked,
	transactionFields
} from './transactions';

export async function insertAccount(
	ctx: MutationCtx,
	args: { name: string; kind: 'cash' | 'creditCard'; startingBalance: number }
) {
	const name = requireName(args.name);
	let position = 0;
	for await (const account of ctx.db.query('accounts')) {
		position = Math.max(position, account.position + 1);
	}
	const accountId = await ctx.db.insert('accounts', { name, kind: args.kind, position });
	await saveStartingBalance(ctx, accountId, args.startingBalance);
	return accountId;
}

export async function saveStartingBalance(
	ctx: MutationCtx,
	accountId: Id<'accounts'>,
	startingBalance: number
) {
	const account = await ctx.db.get('accounts', accountId);
	if (account === null) throw publicError('NOT_FOUND');
	const amount = requireCents(startingBalance);
	const cutoverDate = await requireCutoverDate(ctx);
	const existing = await startingBalanceOf(ctx, accountId);
	if (existing !== null) {
		requireUnlocked(existing, 'to change the starting balance');
		await replaceTransaction(
			ctx,
			existing,
			{
				accountId,
				date: cutoverDate,
				amount,
				...(existing.categoryId === undefined ? {} : { categoryId: existing.categoryId }),
				...(existing.memo === undefined ? {} : { memo: existing.memo }),
				cleared: existing.cleared,
				approved: existing.approved !== false
			},
			[]
		);
		return existing._id;
	}
	const fields = await transactionFields(ctx, {
		accountId,
		date: cutoverDate,
		amount,
		payee: '',
		categoryId:
			account.kind === 'cash'
				? await ensureReadyToAssign(ctx)
				: ((await readPaymentCategory(ctx, accountId))?._id ??
					(await createPaymentCategory(ctx, account))),
		memo: ''
	});
	return await insertTransaction(ctx, {
		...fields,
		kind: 'startingBalance',
		cleared: 'cleared',
		approved: true
	});
}

export async function confirmStartingBalance(
	ctx: MutationCtx,
	accountId: Id<'accounts'>,
	startingBalance: number
) {
	await saveStartingBalance(ctx, accountId, startingBalance);
	const cutoverDate = await requireCutoverDate(ctx);
	const feeds = ctx.db
		.query('connectionAccounts')
		.withIndex('by_accountId', (q) => q.eq('accountId', accountId));
	for await (const feed of feeds) {
		if (feed.state === 'mapped' && feed.startingBalanceConfirmedFor !== cutoverDate) {
			await ctx.db.patch('connectionAccounts', feed._id, {
				startingBalanceConfirmedFor: cutoverDate
			});
		}
	}
}

type MappedBankAccount = Extract<Doc<'connectionAccounts'>, { state: 'mapped' }>;

export function isStartingBalanceConfirmed(feed: MappedBankAccount, cutoverDate: string | null) {
	return cutoverDate !== null && feed.startingBalanceConfirmedFor === cutoverDate;
}

const MAX_HISTORY_CHECKED = 100;

export async function historyElsewhere(
	ctx: QueryCtx,
	feed: MappedBankAccount
): Promise<{ accountId: Id<'accounts'>; name: string } | null> {
	const landed = (range: 'before' | 'after') =>
		ctx.db
			.query('imports')
			.withIndex('by_connectionAccountId_accountId', (q) => {
				const ours = q.eq('connectionAccountId', feed._id);
				return range === 'before'
					? ours.lt('accountId', feed.accountId)
					: ours.gt('accountId', feed.accountId);
			})
			.take(MAX_HISTORY_CHECKED);
	const rows = [...(await landed('before')), ...(await landed('after'))];
	for (const row of rows.slice(0, MAX_HISTORY_CHECKED)) {
		if (row.transactionId === undefined) continue;
		const transaction = await ctx.db.get('transactions', row.transactionId);
		if (transaction === null || transaction.accountId === feed.accountId) continue;
		const account = await ctx.db.get('accounts', transaction.accountId);
		if (account !== null) return { accountId: account._id, name: account.name };
	}
	return null;
}

export function startingBalanceOf(ctx: QueryCtx, accountId: Id<'accounts'>) {
	return ctx.db
		.query('transactions')
		.withIndex('by_accountId_and_kind', (q) =>
			q.eq('accountId', accountId).eq('kind', 'startingBalance')
		)
		.unique();
}

export const bankImports = v.object({
	count: v.number(),
	total: v.number(),
	first: v.union(v.string(), v.null()),
	last: v.union(v.string(), v.null())
});
export type BankImports = Infer<typeof bankImports>;

export async function bankImportsSince(
	ctx: QueryCtx,
	accountId: Id<'accounts'>,
	since: string
): Promise<BankImports> {
	const imported: BankImports = { count: 0, total: 0, first: null, last: null };
	const dated = ctx.db
		.query('transactions')
		.withIndex('by_account_date', (q) => q.eq('accountId', accountId).gte('date', since));
	for await (const transaction of dated) {
		for await (const row of allBankRowsOf(ctx, transaction._id)) {
			if (row.state === 'removed') continue;
			imported.count += 1;
			imported.total += transaction.amount;
			imported.first ??= transaction.date;
			imported.last = transaction.date;
			break;
		}
	}
	return imported;
}

export const bankSource = v.object({
	bankName: v.union(v.string(), v.null()),
	mask: v.union(v.string(), v.null()),
	connectionName: v.string()
});
export type BankSource = Infer<typeof bankSource>;

export interface StartingBalanceSource {
	bankAccount: Doc<'connectionAccounts'>;
	connection: Doc<'bankConnections'>;
	identity: BankSource;
}

export async function startingBalanceSource(
	ctx: QueryCtx,
	accountId: Id<'accounts'>
): Promise<StartingBalanceSource | null> {
	const bankAccount = await ctx.db
		.query('connectionAccounts')
		.withIndex('by_accountId', (q) => q.eq('accountId', accountId))
		.order('desc')
		.first();
	if (bankAccount === null) return null;
	const connection = await ctx.db.get('bankConnections', bankAccount.connectionId);
	if (connection === null) return null;
	return {
		bankAccount,
		connection,
		identity: {
			bankName: bankAccount.name ?? null,
			mask: bankAccount.mask ?? null,
			connectionName: connection.name
		}
	};
}
