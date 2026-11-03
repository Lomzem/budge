import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { createPaymentCategory, ensureReadyToAssign, readPaymentCategory } from './categories';
import { requireCents, requireName } from './input';
import { publicError } from './publicError';
import { requireCutoverDate } from './settings';
import {
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
	const existing = await ctx.db
		.query('transactions')
		.withIndex('by_accountId_and_kind', (q) =>
			q.eq('accountId', accountId).eq('kind', 'startingBalance')
		)
		.unique();
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
		return;
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
	await insertTransaction(ctx, {
		...fields,
		kind: 'startingBalance',
		cleared: 'cleared',
		approved: true
	});
}
