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

/**
 * Creates an Account at the end of the sidebar. Its starting balance is an ordinary Cleared
 * Transaction dated on the cutover date; a card's debt is negative.
 */
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
		// A Cash Account's starting balance is money to budget. A card's debt sits in its own
		// Payment Category, where the card's move cancels it, so it touches no Category.
		categoryId:
			args.kind === 'cash'
				? await ensureReadyToAssign(ctx)
				: await createPaymentCategory(ctx, { _id: accountId, name }),
		memo: ''
	});
	await insertTransaction(ctx, { ...fields, cleared: 'cleared', approved: true });
	return accountId;
}

/**
 * Sets an Account's starting balance: the amount of its Starting Balance Transaction on the cutover
 * date, which keeps its Category. A Reconciled one must be unlocked first.
 */
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
	// Left out, or deleted by the owner: a new one, as when the Account was created.
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
