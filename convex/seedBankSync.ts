import { v, type Infer } from 'convex/values';

import { addDays, localIsoDate } from '../src/lib/domain/dates';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { env, internalMutation, type MutationCtx } from './_generated/server';
import { publicError } from './lib/publicError';
import type { BankAccountKind } from '../src/lib/domain/plaid';
import type { syncRemoval, syncRow } from './lib/sync';
import { saveTransaction } from './lib/transactions';

const CREDIT_UNION = {
	name: 'Sample Credit Union',
	itemId: 'sample-item-credit-union',
	checking: 'cu-checking'
} as const;

const SAVINGS_BANK = {
	name: 'Sample Savings Bank',
	itemId: 'sample-item-savings-bank'
} as const;

const COMMUNITY_BANK = {
	name: 'Sample Community Bank',
	itemId: 'sample-item-community-bank',
	savings: 'cb-savings'
} as const;

const NOT_A_REAL_TOKEN = 'sample-token-that-never-decrypts';

const HELD_ACCOUNTS = [
	{ externalId: 'cu-savings', name: 'Sample Savings Plus', mask: '4417', kind: 'cash' },
	{ externalId: 'cu-card', name: 'Sample Rewards Card', mask: '9021', kind: 'creditCard' },
	{ externalId: 'cu-holiday', name: 'Sample Holiday Club', mask: '1180', kind: 'cash' }
] as const;

const DAYS_FROM_NOW_UNTIL_CONSENT_ENDS = 5;
const DAYS_SINCE_SAVINGS_BANK_LAST_SYNCED = 1;
const HOURS_SINCE_COMMUNITY_BANK_LAST_SYNCED = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

type SyncRow = Infer<typeof syncRow>;
type SyncRemoval = Infer<typeof syncRemoval>;

export const run = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const checking = await requireSeededAccount(ctx, 'Checking');
		const savings = await requireSeededAccount(ctx, 'Savings');
		const today = localIsoDate(new Date(Date.now()));
		const daysAgo = (days: number) => addDays(today, -days);

		const creditUnion = await ctx.runMutation(internal.bankConnections.save, {
			name: CREDIT_UNION.name,
			itemId: CREDIT_UNION.itemId,
			encryptedToken: NOT_A_REAL_TOKEN,
			accounts: [{ externalId: CREDIT_UNION.checking, accountId: checking }]
		});
		const checkingRow = (sourceId: string, date: string, amount: number, bankText: string) => ({
			externalAccountId: CREDIT_UNION.checking,
			sourceId,
			date,
			amount,
			bankText
		});
		const heldRow = (
			externalAccountId: string,
			sourceId: string,
			days: number,
			amount: number,
			bankText: string
		) => ({ externalAccountId, sourceId, date: daysAgo(days), amount, bankText });

		await sync(ctx, creditUnion, {
			discover: true,
			rows: [
				checkingRow('pet', daysAgo(6), -18_43, 'SAMPLE PET SUPPLY 0311'),
				checkingRow('garden', daysAgo(6), -42_17, 'SAMPLE GARDEN CENTER 7720'),
				checkingRow('streaming', daysAgo(5), -9_91, 'SAMPLE STREAMING 4410'),
				checkingRow('car-wash', daysAgo(5), -27_36, 'SAMPLE CAR WASH 0904'),
				heldRow('cu-savings', 'savings-interest', 4, 3_17, 'SAMPLE INTEREST PAID'),
				heldRow('cu-savings', 'savings-deposit', 3, 250_00, 'SAMPLE TRANSFER IN 5512'),
				heldRow('cu-card', 'card-bistro', 4, -36_29, 'SAMPLE BISTRO 0817'),
				heldRow('cu-card', 'card-bookstore', 2, -21_08, 'SAMPLE BOOK NOOK 3306'),
				heldRow('cu-holiday', 'holiday-deposit', 3, 40_00, 'SAMPLE CLUB DEPOSIT')
			],
			recordAccounts: [
				{
					externalId: CREDIT_UNION.checking,
					name: 'Sample Everyday Checking',
					mask: '2208',
					kind: 'cash'
				},
				...HELD_ACCOUNTS
			]
		});

		await editLikeTheOwner(ctx, checking, 'SAMPLE GARDEN CENTER 7720', (edit) => ({
			...edit,
			amount: -40_00
		}));
		await editLikeTheOwner(ctx, checking, 'SAMPLE STREAMING 4410', (edit) => ({
			...edit,
			memo: 'Shared family plan'
		}));

		const lease = await sync(ctx, creditUnion, {
			discover: false,
			modified: [
				checkingRow('pet', daysAgo(6), -19_02, 'SAMPLE PET SUPPLY 0311'),
				checkingRow('garden', daysAgo(6), -44_75, 'SAMPLE GARDEN CENTER 7720')
			],
			removed: [
				{ externalAccountId: CREDIT_UNION.checking, sourceId: 'streaming' },
				{ externalAccountId: CREDIT_UNION.checking, sourceId: 'car-wash' }
			]
		});
		await ctx.runMutation(internal.bankConnections.recordConsent, {
			connectionId: creditUnion,
			consentExpiresAt: Date.now() + DAYS_FROM_NOW_UNTIL_CONSENT_ENDS * DAY_MS,
			checkedByLease: lease
		});

		const savingsBank = await ctx.runMutation(internal.bankConnections.save, {
			name: SAVINGS_BANK.name,
			itemId: SAVINGS_BANK.itemId,
			encryptedToken: NOT_A_REAL_TOKEN,
			accounts: []
		});
		await sync(ctx, savingsBank, { discover: false });
		await ctx.db.patch('bankConnections', savingsBank, {
			lastSyncedAt: Date.now() - DAYS_SINCE_SAVINGS_BANK_LAST_SYNCED * DAY_MS
		});
		await ctx.runMutation(internal.bankConnections.flagItem, {
			itemId: SAVINGS_BANK.itemId,
			code: 'ITEM_LOGIN_REQUIRED'
		});

		const communityBank = await ctx.runMutation(internal.bankConnections.save, {
			name: COMMUNITY_BANK.name,
			itemId: COMMUNITY_BANK.itemId,
			encryptedToken: NOT_A_REAL_TOKEN,
			accounts: [{ externalId: COMMUNITY_BANK.savings, accountId: savings }]
		});
		await sync(ctx, communityBank, {
			discover: true,
			recordAccounts: [
				{
					externalId: COMMUNITY_BANK.savings,
					name: 'Sample Statement Savings',
					mask: '6604',
					kind: 'cash'
				}
			]
		});
		await ctx.db.patch('bankConnections', communityBank, {
			lastSyncedAt: Date.now() - HOURS_SINCE_COMMUNITY_BANK_LAST_SYNCED * HOUR_MS
		});
		return null;
	}
});

async function requireSeededAccount(ctx: MutationCtx, name: string): Promise<Id<'accounts'>> {
	if (env.BUDGE_PRODUCTION !== undefined) {
		throw publicError('FORBIDDEN', 'The seed never runs on production.');
	}
	for await (const account of ctx.db.query('accounts')) {
		if (account.name === name) return account._id;
	}
	throw publicError('INVALID_INPUT', 'Run seed:run before seedBankSync:run.');
}

async function sync(
	ctx: MutationCtx,
	connectionId: Id<'bankConnections'>,
	page: {
		discover: boolean;
		rows?: SyncRow[];
		modified?: SyncRow[];
		removed?: SyncRemoval[];
		recordAccounts?: { externalId: string; name: string; mask: string; kind: BankAccountKind }[];
	}
): Promise<number> {
	const taken = await ctx.runMutation(internal.bankConnections.takeLease, {
		connectionId,
		resume: false,
		discover: page.discover
	});
	if (taken.kind !== 'taken') throw publicError('INVALID_INPUT', `The sync was ${taken.kind}.`);
	if (page.recordAccounts !== undefined) {
		await ctx.runMutation(internal.heldAccounts.recordAccounts, {
			connectionId,
			answersRequestAt: taken.accountsCheckRequestedAt,
			accounts: page.recordAccounts
		});
	}
	const applied = await ctx.runMutation(internal.bankConnections.apply, {
		connectionId,
		lease: taken.lease,
		fromCursor: taken.cursor,
		nextCursor: `${taken.cursor ?? 'sample-cursor'}+1`,
		hasMore: false,
		rows: page.rows ?? [],
		modified: page.modified ?? [],
		removed: page.removed ?? [],
		release: true,
		attentionNotices: taken.attentionNotices
	});
	if (applied.kind !== 'applied') throw publicError('INVALID_INPUT', 'The sync went stale.');
	return taken.lease;
}

async function editLikeTheOwner(
	ctx: MutationCtx,
	accountId: Id<'accounts'>,
	bankText: string,
	change: (edit: Parameters<typeof saveTransaction>[2]) => Parameters<typeof saveTransaction>[2]
) {
	const transaction = await importedTransaction(ctx, accountId, bankText);
	const payee =
		transaction.payeeId === undefined ? null : await ctx.db.get('payees', transaction.payeeId);
	await saveTransaction(
		ctx,
		transaction,
		change({
			accountId,
			date: transaction.date,
			amount: transaction.amount,
			payee: payee?.name ?? '',
			categoryId: transaction.categoryId,
			memo: transaction.memo ?? ''
		})
	);
}

async function importedTransaction(
	ctx: MutationCtx,
	accountId: Id<'accounts'>,
	bankText: string
): Promise<Doc<'transactions'>> {
	const rows = ctx.db
		.query('imports')
		.withIndex('by_account_source_sourceId_date', (q) =>
			q.eq('accountId', accountId).eq('source', 'plaid')
		);
	for await (const row of rows) {
		if (row.bankText !== bankText || row.transactionId === undefined) continue;
		const transaction = await ctx.db.get('transactions', row.transactionId);
		if (transaction !== null) return transaction;
	}
	throw publicError('NOT_FOUND');
}
