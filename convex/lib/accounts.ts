import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { createPaymentCategory, ensureReadyToAssign, readPaymentCategory } from './categories';
import { requireCents, requireName } from './input';
import { publicError } from './publicError';
import { requireCutoverDate } from './settings';
import {
	bankRowsOf,
	insertTransaction,
	replaceTransaction,
	requireUnlocked,
	transactionFields
} from './transactions';

const STARTING_BALANCE = 'Starting Balance';

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
	const onCutover = ctx.db
		.query('transactions')
		.withIndex('by_account_date', (q) => q.eq('accountId', accountId).eq('date', cutoverDate));
	for await (const transaction of onCutover) {
		if (transaction.payeeId === undefined || transaction.transferTransactionId !== undefined) {
			continue;
		}
		const payee = await ctx.db.get('payees', transaction.payeeId);
		if (payee?.name !== STARTING_BALANCE) continue;
		if ((await bankRowsOf(ctx, transaction._id)).length > 0) continue;
		requireUnlocked(transaction, 'to change the starting balance');
		await replaceTransaction(ctx, transaction, {
			...transaction,
			amount,
			approved: transaction.approved !== false
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
