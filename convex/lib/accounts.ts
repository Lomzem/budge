import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { createPaymentCategory, ensureReadyToAssign, readPaymentCategory } from './categories';
import { requireCents, requireName } from './input';
import { findPayeeNamed, STARTING_BALANCE } from './payees';
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
		payee: STARTING_BALANCE,
		categoryId:
			args.kind === 'cash'
				? await ensureReadyToAssign(ctx)
				: await createPaymentCategory(ctx, { _id: accountId, name }),
		memo: ''
	});
	await insertTransaction(ctx, { ...fields, cleared: 'cleared', approved: true });
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
		await replaceTransaction(ctx, existing, {
			...existing,
			date: cutoverDate,
			amount,
			approved: existing.approved !== false
		});
		return;
	}
	const fields = await transactionFields(ctx, {
		accountId,
		date: cutoverDate,
		amount,
		payee: STARTING_BALANCE,
		categoryId:
			account.kind === 'cash'
				? await ensureReadyToAssign(ctx)
				: ((await readPaymentCategory(ctx, accountId))?._id ??
					(await createPaymentCategory(ctx, account))),
		memo: ''
	});
	await insertTransaction(ctx, { ...fields, cleared: 'cleared', approved: true });
}

async function startingBalanceOf(ctx: MutationCtx, accountId: Id<'accounts'>) {
	const payee = await findPayeeNamed(ctx, STARTING_BALANCE);
	if (payee === null) return null;
	const named = ctx.db
		.query('transactions')
		.withIndex('by_payee_date', (q) => q.eq('payeeId', payee._id));
	for await (const transaction of named) {
		if (transaction.accountId === accountId && transaction.transferTransactionId === undefined) {
			return transaction;
		}
	}
	return null;
}
