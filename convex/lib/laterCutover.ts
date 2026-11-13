import { v, type Infer } from 'convex/values';

import { computeBudget, type Budget } from '../../src/lib/domain/budget';
import { monthOf } from '../../src/lib/domain/dates';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { startingBalanceOf } from './accounts';
import { accountKind } from './accountKind';
import { readBudgetInput, type BudgetInputs } from './budget';
import { keyOf, lineCounted, type Counted } from './monthlyTotals';
import { publicError } from './publicError';
import { readCutoverDate } from './settings';
import { allBankRowsOf, payeeNameOf, splitLinesOf } from './transactions';

export const LATER_CUTOVER_LIMIT = 500;

const clearedState = v.union(v.literal('uncleared'), v.literal('cleared'), v.literal('reconciled'));

const foldedTransaction = v.object({
	transactionId: v.id('transactions'),
	date: v.string(),
	amount: v.number(),
	payeeName: v.union(v.string(), v.null()),
	categoryName: v.union(v.string(), v.null()),
	transferAccountName: v.union(v.string(), v.null()),
	split: v.boolean(),
	fromBank: v.boolean(),
	cleared: clearedState
});

const accountFields = {
	accountId: v.id('accounts'),
	name: v.string(),
	kind: accountKind,
	startingBalance: v.union(
		v.object({ amount: v.number(), date: v.string(), cleared: clearedState }),
		v.null()
	),
	transactions: v.array(foldedTransaction)
};

const mustResolve = v.union(
	v.object({
		kind: v.literal('bankChange'),
		transactionId: v.id('transactions'),
		accountName: v.string(),
		date: v.string(),
		amount: v.number(),
		payeeName: v.union(v.string(), v.null())
	}),
	v.object({
		kind: v.literal('transferAcrossDate'),
		transactionId: v.id('transactions'),
		accountName: v.string(),
		date: v.string(),
		amount: v.number(),
		otherAccountName: v.union(v.string(), v.null()),
		otherDate: v.union(v.string(), v.null())
	}),
	v.object({
		kind: v.literal('startingBalanceLater'),
		accountName: v.string(),
		date: v.string()
	})
);

const caution = v.union(
	v.object({
		kind: v.union(v.literal('reconciled'), v.literal('uncleared')),
		accountName: v.string(),
		count: v.number(),
		total: v.number()
	}),
	v.object({
		kind: v.literal('remapped'),
		accountName: v.string(),
		count: v.number(),
		total: v.number(),
		nowAccountName: v.string()
	})
);

const budgetEffect = v.object({
	month: v.string(),
	readyToAssign: v.object({ before: v.number(), after: v.number() }),
	categories: v.array(
		v.object({
			categoryId: v.id('categories'),
			name: v.string(),
			before: v.number(),
			after: v.number()
		})
	),
	removedAssignments: v.object({
		count: v.number(),
		total: v.number(),
		months: v.array(v.string())
	})
});

export const laterCutoverPreview = v.union(
	v.object({
		kind: v.literal('unsupported'),
		reason: v.union(
			v.literal('noCutoverDate'),
			v.literal('notLater'),
			v.literal('notYet'),
			v.literal('tooMany')
		),
		message: v.string()
	}),
	v.object({ kind: v.literal('nothingBefore'), from: v.string(), to: v.string() }),
	v.object({
		kind: v.literal('blocked'),
		from: v.string(),
		to: v.string(),
		accounts: v.array(
			v.object({ ...accountFields, proposedStartingBalance: v.union(v.number(), v.null()) })
		),
		mustResolve: v.array(mustResolve),
		cautions: v.array(caution)
	}),
	v.object({
		kind: v.literal('ready'),
		from: v.string(),
		to: v.string(),
		fingerprint: v.string(),
		accounts: v.array(v.object({ ...accountFields, proposedStartingBalance: v.number() })),
		cautions: v.array(caution),
		budget: budgetEffect
	})
);

export type LaterCutoverPreview = Infer<typeof laterCutoverPreview>;
type MustResolve = Infer<typeof mustResolve>;
type Caution = Infer<typeof caution>;
type FoldedTransaction = Infer<typeof foldedTransaction>;
type Unsupported = Extract<LaterCutoverPreview, { kind: 'unsupported' }>;

interface Fold {
	account: Doc<'accounts'>;
	startingBalance: Doc<'transactions'> | null;
	rows: FoldedTransaction[];
	blocked: boolean;
	remapped: Map<Id<'accounts'>, { count: number; total: number }>;
}

interface Lookups {
	accountOf: (accountId: Id<'accounts'>) => Doc<'accounts'>;
	payeeOf: (payeeId: Id<'payees'>) => Promise<Doc<'payees'> | null>;
	feedOf: (feedId: Id<'connectionAccounts'>) => Promise<Doc<'connectionAccounts'> | null>;
	categoryNameOf: (categoryId: Id<'categories'> | undefined) => string | null;
}

interface Earlier {
	ordered: Fold[];
	blockers: MustResolve[];
	splitLines: Map<Id<'transactions'>, Doc<'transactionSplits'>[]>;
	accountOf: Lookups['accountOf'];
}

interface ProposedStartingBalance {
	fold: Fold;
	amount: number;
	category: Pick<Counted, 'categoryId'> | null;
}

export async function previewLaterCutover(
	ctx: QueryCtx,
	to: string,
	today: string
): Promise<LaterCutoverPreview> {
	const checked = await readEarlier(ctx, to, today);
	if (!('earlier' in checked)) return checked;
	const { from, earlier } = checked;

	const month = monthOf(to);
	const budgetInput = await readBudgetInput(ctx, month, today);
	const { ordered, blockers, splitLines, accountOf } = await foldEarlier(
		ctx,
		earlier,
		await lookupsOf(ctx, budgetInput.categories)
	);
	const cautions = ordered.flatMap((fold) => cautionsOf(fold, accountOf));

	if (blockers.length > 0) {
		return {
			kind: 'blocked',
			from,
			to,
			accounts: ordered.map((fold) => ({
				...accountView(fold),
				proposedStartingBalance: fold.blocked ? null : proposedAmountOf(fold)
			})),
			mustResolve: blockers,
			cautions
		};
	}

	const proposed = ordered.map((fold) => ({
		fold,
		amount: proposedAmountOf(fold),
		category: startingBalanceCategory(fold, budgetInput.categories)
	}));
	const removed = budgetInput.assignments.filter((row) => row.month < month && row.amount !== 0);
	const before = computeBudget(budgetInput);
	const after = computeBudget({
		...budgetInput,
		cutoverDate: to,
		monthlyTotals: projectedTotals(budgetInput.monthlyTotals, {
			earlier,
			splitLines,
			proposed,
			to
		}),
		assignments: budgetInput.assignments.filter((row) => row.month >= month)
	});

	return {
		kind: 'ready',
		from,
		to,
		fingerprint: fingerprintOf([
			from,
			to,
			earlier.map((transaction) => transactionFingerprint(transaction, splitLines)),
			proposed.map(({ fold, amount, category }) => [
				fold.account._id,
				fold.startingBalance?._id ?? null,
				amount,
				category?.categoryId ?? null
			]),
			removed.map((row) => [row._id, row.month, row.categoryId, row.amount])
		]),
		accounts: proposed.map(({ fold, amount }) => ({
			...accountView(fold),
			proposedStartingBalance: amount
		})),
		cautions,
		budget: {
			month,
			readyToAssign: { before: before.readyToAssign.amount, after: after.readyToAssign.amount },
			categories: changedCategories(before, after),
			removedAssignments: {
				count: removed.length,
				total: removed.reduce((sum, row) => sum + row.amount, 0),
				months: [...new Set(removed.map((row) => row.month))].toSorted()
			}
		}
	};
}

async function readEarlier(
	ctx: QueryCtx,
	to: string,
	today: string
): Promise<
	| Unsupported
	| { kind: 'nothingBefore'; from: string; to: string }
	| { from: string; earlier: Doc<'transactions'>[] }
> {
	const from = await readCutoverDate(ctx);
	if (from === null) return unsupported('noCutoverDate', 'Set the cutover date first.');
	if (to <= from) return unsupported('notLater', 'Pick a date after the current cutover date.');
	const earlier = await ctx.db
		.query('transactions')
		.withIndex('by_date', (q) => q.lt('date', to))
		.take(LATER_CUTOVER_LIMIT + 1);
	if (earlier.length > LATER_CUTOVER_LIMIT) {
		return unsupported(
			'tooMany',
			`More than ${String(LATER_CUTOVER_LIMIT)} Transactions are dated before that day, more than Budge can preview at once. Pick a date closer to the current cutover date.`
		);
	}
	if (earlier.length === 0) return { kind: 'nothingBefore', from, to };
	if (to > today) {
		return unsupported(
			'notYet',
			'Pick today or an earlier date. Budge can only work out a Starting Balance for a day that has come.'
		);
	}
	return { from, earlier };
}

function unsupported(reason: Unsupported['reason'], message: string): Unsupported {
	return { kind: 'unsupported', reason, message };
}

async function lookupsOf(
	ctx: QueryCtx,
	categories: readonly { id: Id<'categories'>; name: string }[]
): Promise<Lookups> {
	const accounts = new Map<Id<'accounts'>, Doc<'accounts'>>();
	for await (const account of ctx.db.query('accounts')) accounts.set(account._id, account);
	const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
	const payees = new Map<Id<'payees'>, Promise<Doc<'payees'> | null>>();
	const feeds = new Map<Id<'connectionAccounts'>, Promise<Doc<'connectionAccounts'> | null>>();
	return {
		accountOf: (accountId) => {
			const account = accounts.get(accountId);
			if (account === undefined) throw publicError('NOT_FOUND');
			return account;
		},
		payeeOf: (payeeId) => {
			const known = payees.get(payeeId) ?? ctx.db.get('payees', payeeId);
			payees.set(payeeId, known);
			return known;
		},
		feedOf: (feedId) => {
			const known = feeds.get(feedId) ?? ctx.db.get('connectionAccounts', feedId);
			feeds.set(feedId, known);
			return known;
		},
		categoryNameOf: (categoryId) =>
			categoryId === undefined ? null : (categoryNames.get(categoryId) ?? null)
	};
}

async function foldEarlier(
	ctx: QueryCtx,
	earlier: readonly Doc<'transactions'>[],
	lookups: Lookups
): Promise<Earlier> {
	const folded = new Map(earlier.map((transaction) => [transaction._id, transaction]));
	const folds = new Map<Id<'accounts'>, Fold>();
	const splitLines = new Map<Id<'transactions'>, Doc<'transactionSplits'>[]>();
	const blockers: MustResolve[] = [];

	for (const transaction of earlier) {
		const fold =
			folds.get(transaction.accountId) ?? emptyFold(lookups.accountOf(transaction.accountId));
		folds.set(transaction.accountId, fold);
		if (transaction.kind === 'startingBalance') {
			fold.startingBalance = transaction;
			continue;
		}
		if (transaction.split === true) {
			splitLines.set(transaction._id, await splitLinesOf(ctx, transaction._id));
		}
		const found = await foldTransaction(ctx, lookups, { fold, transaction, folded });
		if (found.length > 0) {
			fold.blocked = true;
			blockers.push(...found);
		}
	}

	const ordered = [...folds.values()].toSorted((a, b) => a.account.position - b.account.position);
	for (const fold of ordered) {
		if (fold.startingBalance !== null) continue;
		const later = await startingBalanceOf(ctx, fold.account._id);
		if (later === null) continue;
		fold.blocked = true;
		blockers.push({
			kind: 'startingBalanceLater',
			accountName: fold.account.name,
			date: later.date
		});
	}
	return { ordered, blockers, splitLines, accountOf: lookups.accountOf };
}

function emptyFold(account: Doc<'accounts'>): Fold {
	return { account, startingBalance: null, rows: [], blocked: false, remapped: new Map() };
}

async function foldTransaction(
	ctx: QueryCtx,
	lookups: Lookups,
	{
		fold,
		transaction,
		folded
	}: {
		fold: Fold;
		transaction: Doc<'transactions'>;
		folded: ReadonlyMap<Id<'transactions'>, Doc<'transactions'>>;
	}
): Promise<MustResolve[]> {
	const { fromBank, feedsElsewhere } = await bankOriginOf(ctx, lookups, transaction);
	if (feedsElsewhere !== null) {
		const moved = fold.remapped.get(feedsElsewhere) ?? { count: 0, total: 0 };
		fold.remapped.set(feedsElsewhere, {
			count: moved.count + 1,
			total: moved.total + transaction.amount
		});
	}
	const payeeName = await payeeNameOf(ctx, transaction, lookups.payeeOf);
	const transfer = await transferOf(ctx, lookups, transaction, folded);
	fold.rows.push({
		transactionId: transaction._id,
		date: transaction.date,
		amount: transaction.amount,
		payeeName,
		categoryName: lookups.categoryNameOf(transaction.categoryId),
		transferAccountName: transfer?.accountName ?? null,
		split: transaction.split === true,
		fromBank,
		cleared: transaction.cleared
	});

	const where = {
		transactionId: transaction._id,
		accountName: fold.account.name,
		date: transaction.date,
		amount: transaction.amount
	};
	const found: MustResolve[] = [];
	if (transfer?.acrossDate === true) {
		found.push({
			kind: 'transferAcrossDate',
			...where,
			otherAccountName: transfer.accountName,
			otherDate: transfer.date
		});
	}
	if (transaction.bankChange === true) found.push({ kind: 'bankChange', ...where, payeeName });
	return found;
}

async function bankOriginOf(ctx: QueryCtx, lookups: Lookups, transaction: Doc<'transactions'>) {
	let fromBank = false;
	let feedsElsewhere: Id<'accounts'> | null = null;
	for await (const bankRow of allBankRowsOf(ctx, transaction._id)) {
		if (bankRow.state !== 'linked' && bankRow.state !== 'changed') continue;
		fromBank = true;
		if (bankRow.connectionAccountId === undefined) continue;
		const feed = await lookups.feedOf(bankRow.connectionAccountId);
		if (feed?.state === 'mapped' && feed.accountId !== transaction.accountId) {
			feedsElsewhere = feed.accountId;
		}
	}
	return { fromBank, feedsElsewhere };
}

async function transferOf(
	ctx: QueryCtx,
	lookups: Lookups,
	transaction: Doc<'transactions'>,
	folded: ReadonlyMap<Id<'transactions'>, Doc<'transactions'>>
) {
	const otherId = transaction.transferTransactionId;
	if (otherId === undefined) return null;
	const other = folded.get(otherId) ?? (await ctx.db.get('transactions', otherId));
	if (other === null) return { accountName: null, date: null, acrossDate: true };
	return {
		accountName: lookups.accountOf(other.accountId).name,
		date: other.date,
		acrossDate: !folded.has(otherId)
	};
}

function proposedAmountOf(fold: Fold) {
	return (fold.startingBalance?.amount ?? 0) + fold.rows.reduce((sum, row) => sum + row.amount, 0);
}

function accountView(fold: Fold) {
	const existing = fold.startingBalance;
	return {
		accountId: fold.account._id,
		name: fold.account.name,
		kind: fold.account.kind,
		startingBalance:
			existing === null
				? null
				: { amount: existing.amount, date: existing.date, cleared: existing.cleared },
		transactions: fold.rows
	};
}

function cautionsOf(fold: Fold, accountOf: Lookups['accountOf']) {
	const cautions: Caution[] = [];
	const accountName = fold.account.name;
	for (const kind of ['reconciled', 'uncleared'] as const) {
		const rows = fold.rows.filter((row) => row.cleared === kind);
		if (rows.length === 0) continue;
		cautions.push({
			kind,
			accountName,
			count: rows.length,
			total: rows.reduce((sum, row) => sum + row.amount, 0)
		});
	}
	for (const [accountId, { count, total }] of fold.remapped) {
		cautions.push({
			kind: 'remapped',
			accountName,
			count,
			total,
			nowAccountName: accountOf(accountId).name
		});
	}
	return cautions;
}

function startingBalanceCategory(
	fold: Fold,
	categories: readonly {
		id: Id<'categories'>;
		kind: string;
		accountId?: Id<'accounts'> | undefined;
	}[]
): Pick<Counted, 'categoryId'> | null {
	const existing = fold.startingBalance;
	if (existing !== null) {
		return existing.categoryId === undefined ? {} : { categoryId: existing.categoryId };
	}
	const category =
		fold.account.kind === 'cash'
			? categories.find((c) => c.kind === 'readyToAssign')
			: categories.find((c) => c.kind === 'creditCardPayment' && c.accountId === fold.account._id);
	return category === undefined ? null : { categoryId: category.id };
}

function projectedTotals(
	current: BudgetInputs['monthlyTotals'],
	{
		earlier,
		splitLines,
		proposed,
		to
	}: {
		earlier: readonly Doc<'transactions'>[];
		splitLines: Earlier['splitLines'];
		proposed: readonly ProposedStartingBalance[];
		to: string;
	}
) {
	const totals = new Map(
		current.map(({ month, accountId, bucket, amount, count }) => [
			totalId({ month, accountId, bucket }),
			{ month, accountId, bucket, amount, count }
		])
	);
	const count = (counted: Counted, sign: 1 | -1) => {
		const key = keyOf(counted);
		const id = totalId(key);
		const total = totals.get(id) ?? { ...key, amount: 0, count: 0 };
		total.amount += sign * counted.amount;
		total.count += sign;
		totals.set(id, total);
	};
	for (const transaction of earlier) {
		const lines = splitLines.get(transaction._id);
		if (lines === undefined) count(transaction, -1);
		else for (const line of lines) count(lineCounted(transaction, line), -1);
	}
	for (const { fold, amount, category } of proposed) {
		if (category !== null) count({ accountId: fold.account._id, date: to, amount, ...category }, 1);
	}
	return [...totals.values()].filter((row) => row.count > 0);
}

function totalId(key: { month: string; accountId: Id<'accounts'>; bucket: string }) {
	return `${key.month}|${key.accountId}|${key.bucket}`;
}

function changedCategories<G extends string>(
	before: Budget<Id<'categories'>, G>,
	after: Budget<Id<'categories'>, G>
) {
	const availableAfter = new Map(categoriesOf(after).map((c) => [c.id, c.available]));
	return categoriesOf(before).flatMap((c) => {
		const changed = availableAfter.get(c.id) ?? 0;
		return changed === c.available
			? []
			: [{ categoryId: c.id, name: c.name, before: c.available, after: changed }];
	});
}

function categoriesOf<C extends string, G extends string>(budget: Budget<C, G>) {
	return [...budget.groups.flatMap((group) => group.categories), ...budget.hidden];
}

function transactionFingerprint(
	transaction: Doc<'transactions'>,
	splitLines: Earlier['splitLines']
) {
	return [
		transaction._id,
		transaction.date,
		transaction.amount,
		transaction.categoryId ?? null,
		transaction.transferTransactionId ?? null,
		transaction.cleared,
		transaction.bankChange === true,
		(splitLines.get(transaction._id) ?? []).map((line) => [line._id, line.categoryId, line.amount])
	];
}

function fingerprintOf(value: unknown): string {
	const text = JSON.stringify(value);
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
	return `${hex(h2)}${hex(h1)}`;
}
