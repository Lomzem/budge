import type { WithoutSystemFields } from 'convex/server';
import { v, type Infer } from 'convex/values';

import { computeBudget, type Budget } from '../../src/lib/domain/budget';
import { monthOf } from '../../src/lib/domain/dates';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { saveStartingBalance, startingBalanceOf } from './accounts';
import { accountKind } from './accountKind';
import { readBudgetInput, type BudgetInputs, type BudgetRead } from './budget';
import { keyOf, lineCounted, type Counted } from './monthlyTotals';
import { publicError } from './publicError';
import { readWithin, type LimitedReads, type ReadRows } from './readLimits';
import { readCutoverDate } from './settings';
import {
	allBankRowsOf,
	deleteTransaction,
	markApproved,
	markCleared,
	payeeNameOf,
	removeEarlierHistory,
	replaceTransaction,
	restoreEarlierHistory,
	splitLineRows,
	type EarlierTransaction
} from './transactions';

type LaterCutoverRead =
	BudgetRead | 'transactions' | 'bankRows' | 'splitLines' | 'accounts' | 'earlierAssignments';

export const LATER_CUTOVER_READS = {
	transactions: 250,
	bankRows: 250,
	splitLines: 250,
	accounts: 200,
	categoryGroups: 200,
	categories: 1_000,
	assignments: 5_000,
	monthlyTotals: 10_000,
	transactionsAfterToday: 1_000,
	earlierAssignments: 500
} as const satisfies Record<LaterCutoverRead, number>;

const closer = 'Pick a date closer to the current cutover date.';
const tooManyOf: Record<LaterCutoverRead, string> = {
	transactions: `Transactions are dated before that day. ${closer}`,
	bankRows: `bank rows lie behind the Transactions dated before that day. ${closer}`,
	splitLines: `split lines are in the Transactions dated before that day. ${closer}`,
	accounts: 'Accounts are in this budget.',
	categoryGroups: 'Category groups are in this budget.',
	categories: 'Categories are in this budget.',
	assignments: 'Assigned amounts are in this budget across its months.',
	monthlyTotals: 'months of Category and Account totals are in this budget.',
	transactionsAfterToday: 'Transactions dated after today count toward Ready to Assign.',
	earlierAssignments: `Assigned amounts are in the months before that date. ${closer}`
};

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
	history: EarlierTransaction[];
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
	replaced: Doc<'transactions'>[];
	splitLines: Map<Id<'transactions'>, Doc<'transactionSplits'>[]>;
	accountOf: Lookups['accountOf'];
}

interface ProposedStartingBalance {
	fold: Fold;
	amount: number;
	category: Pick<Counted, 'categoryId'> | null;
}

export interface LaterCutoverPlan {
	history: EarlierTransaction[];
	startingBalances: {
		account: Doc<'accounts'>;
		existing: Doc<'transactions'> | null;
		amount: number;
	}[];
	earlierAssignments: Doc<'assignments'>[];
}

export async function previewLaterCutover(
	ctx: QueryCtx,
	to: string,
	today: string
): Promise<LaterCutoverPreview> {
	return (await planLaterCutover(ctx, to, today)).preview;
}

const HOUR = 60 * 60 * 1000;

export async function applyLaterCutover(
	ctx: MutationCtx,
	{
		to,
		today,
		fingerprint,
		unlockReconciled
	}: { to: string; today: string; fingerprint: string; unlockReconciled: boolean }
): Promise<Id<'cutoverMoves'>> {
	const last = await lastCutoverMove(ctx);
	if (last !== null && last.to === to && last.fingerprint === fingerprint) return last._id;
	requireTodaySomewhere(today, Date.now());
	const planned = await planLaterCutover(ctx, to, today);
	if (!('plan' in planned)) throw publicError('INVALID_INPUT', refusalOf(planned.preview));
	if (planned.preview.fingerprint !== fingerprint) throw publicError('INVALID_INPUT', changedSince);
	const { history, startingBalances, earlierAssignments } = planned.plan;
	const reconciled =
		history.some(({ transaction }) => transaction.cleared === 'reconciled') ||
		startingBalances.some(({ existing }) => existing?.cleared === 'reconciled');
	if (reconciled && !unlockReconciled) {
		throw publicError(
			'INVALID_INPUT',
			'Some of this history is Reconciled. Confirm that you unlock it to fold it in.'
		);
	}

	const settings = await ctx.db.query('settings').first();
	if (settings === null) throw publicError('INVALID_INPUT', 'Set the cutover date first.');
	await ctx.db.patch('settings', settings._id, { cutoverDate: to });
	await removeEarlierHistory(ctx, history);
	const saved: Doc<'cutoverMoves'>['startingBalances'] = [];
	for (const { account, existing, amount } of startingBalances) {
		if (existing !== null) {
			await markCleared(ctx, existing._id, 'cleared');
			await markApproved(ctx, existing._id);
		}
		saved.push({
			accountId: account._id,
			transactionId: await saveStartingBalance(ctx, account._id, amount),
			amount,
			before: existing === null ? null : storedForm(existing)
		});
	}
	for (const row of earlierAssignments) await ctx.db.delete('assignments', row._id);

	const moveId = await ctx.db.insert('cutoverMoves', {
		from: planned.preview.from,
		to,
		fingerprint,
		state: 'applied',
		startingBalances: saved,
		assignments: earlierAssignments.map(({ month, categoryId, amount }) => ({
			month,
			categoryId,
			amount
		}))
	});
	for (const { transaction, lines, bankRows } of history) {
		await ctx.db.insert('cutoverMoveHistory', {
			moveId,
			transactionId: transaction._id,
			transaction: storedForm(transaction),
			lines: lines.map(({ categoryId, amount, memo }) =>
				memo === undefined ? { categoryId, amount } : { categoryId, amount, memo }
			),
			bankRows: bankRows.map(({ _id, matched }) => ({ bankRowId: _id, matched }))
		});
	}
	return moveId;
}

export async function lastCutoverMove(ctx: QueryCtx) {
	const last = await ctx.db.query('cutoverMoves').order('desc').first();
	if (last?.state !== 'applied') return null;
	return (await readCutoverDate(ctx)) === last.to ? last : null;
}

const cannotUndo = "so the move can't be undone.";

export async function undoLaterCutover(ctx: MutationCtx, moveId: Id<'cutoverMoves'>) {
	const move = await ctx.db.get('cutoverMoves', moveId);
	if (move === null) throw publicError('NOT_FOUND');
	if (move.state === 'undone') return;
	if ((await lastCutoverMove(ctx))?._id !== moveId) {
		throw publicError('INVALID_INPUT', `The cutover date has moved again since, ${cannotUndo}`);
	}
	const history = await ctx.db
		.query('cutoverMoveHistory')
		.withIndex('by_moveId', (q) => q.eq('moveId', moveId))
		.take(LATER_CUTOVER_READS.transactions);
	const startingBalances = await startingBalancesToPutBack(ctx, move);
	await requireStillThere(ctx, move, history);

	const settings = await ctx.db.query('settings').first();
	if (settings === null) throw publicError('INVALID_INPUT', 'Set the cutover date first.');
	await ctx.db.patch('settings', settings._id, { cutoverDate: move.from });
	await restoreEarlierHistory(ctx, history);
	for (const { current, before } of startingBalances) {
		if (before === null) await deleteTransaction(ctx, current);
		else
			await replaceTransaction(
				ctx,
				current,
				{ ...before, approved: before.approved !== false },
				[]
			);
	}
	for (const row of move.assignments) await ctx.db.insert('assignments', row);
	await ctx.db.patch('cutoverMoves', moveId, { state: 'undone' });
}

async function startingBalancesToPutBack(ctx: QueryCtx, move: Doc<'cutoverMoves'>) {
	const found = [];
	for (const { accountId, transactionId, amount, before } of move.startingBalances) {
		const current = await ctx.db.get('transactions', transactionId);
		const name = (await ctx.db.get('accounts', accountId))?.name ?? 'An Account';
		if (
			current?.kind !== 'startingBalance' ||
			current.accountId !== accountId ||
			current.date !== move.to ||
			current.amount !== amount
		) {
			throw publicError('INVALID_INPUT', `${name}'s Starting Balance changed since, ${cannotUndo}`);
		}
		if (current.cleared === 'reconciled') {
			throw publicError(
				'INVALID_INPUT',
				`${name}'s Starting Balance is Reconciled. Unlock it in its Account to undo the move.`
			);
		}
		found.push({ current, before });
	}
	return found;
}

async function requireStillThere(
	ctx: QueryCtx,
	move: Doc<'cutoverMoves'>,
	history: readonly Doc<'cutoverMoveHistory'>[]
) {
	const categoryIds = new Set<Id<'categories'>>();
	for (const { transaction, lines } of history) {
		if (transaction.categoryId !== undefined) categoryIds.add(transaction.categoryId);
		for (const line of lines) categoryIds.add(line.categoryId);
	}
	for (const { categoryId } of move.assignments) categoryIds.add(categoryId);
	for (const { before } of move.startingBalances) {
		if (before?.categoryId !== undefined) categoryIds.add(before.categoryId);
	}
	for (const categoryId of categoryIds) {
		if ((await ctx.db.get('categories', categoryId)) === null) {
			throw publicError(
				'INVALID_INPUT',
				`A Category this history used was deleted since, ${cannotUndo}`
			);
		}
	}
	for (const { bankRows } of history) {
		for (const { bankRowId } of bankRows) {
			const bankRow = await ctx.db.get('imports', bankRowId);
			if (bankRow === null || bankRow.transactionId !== undefined) {
				throw publicError(
					'INVALID_INPUT',
					`A bank row behind this history has been matched again since, ${cannotUndo}`
				);
			}
		}
	}
	const assigned = await ctx.db
		.query('assignments')
		.withIndex('by_month_category', (q) => q.lt('month', monthOf(move.to)))
		.first();
	if (assigned !== null) {
		throw publicError(
			'INVALID_INPUT',
			`Amounts were assigned before ${monthOf(move.to)} since, ${cannotUndo}`
		);
	}
}

function storedForm(transaction: Doc<'transactions'>): WithoutSystemFields<Doc<'transactions'>> {
	const fields: WithoutSystemFields<Doc<'transactions'>> &
		Partial<Pick<Doc<'transactions'>, '_id' | '_creationTime'>> = { ...transaction };
	delete fields._id;
	delete fields._creationTime;
	return fields;
}

const changedSince =
	'What the preview shows has changed since you reviewed it. Look it over again, then confirm.';

function refusalOf(preview: Exclude<LaterCutoverPreview, { kind: 'ready' }>) {
	if (preview.kind === 'unsupported') return preview.message;
	if (preview.kind === 'blocked') return `${changedSince} Some of it must be resolved first.`;
	return changedSince;
}

function requireTodaySomewhere(today: string, now: number) {
	const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10);
	if (today < dateAt(now - 12 * HOUR) || today > dateAt(now + 14 * HOUR)) {
		throw publicError(
			'INVALID_INPUT',
			"Your device's date looks wrong. Set its date and time, then try again."
		);
	}
}

type Planned =
	| { preview: Exclude<LaterCutoverPreview, { kind: 'ready' }> }
	| { preview: Extract<LaterCutoverPreview, { kind: 'ready' }>; plan: LaterCutoverPlan };

async function planLaterCutover(ctx: QueryCtx, to: string, today: string): Promise<Planned> {
	const limits = readWithin(LATER_CUTOVER_READS);
	const checked = await readEarlier(ctx, { to, today, limits });
	if (!('earlier' in checked)) return { preview: checked };
	const { from, earlier } = checked;

	const month = monthOf(to);
	const budgetInput = await readBudgetInput(ctx, month, today, limits.read);
	const lookups = await lookupsOf(ctx, budgetInput.categories, limits.read);
	const tooManyToLookUp = tooManyRead(limits);
	if (tooManyToLookUp !== null) return { preview: tooManyToLookUp };
	const { ordered, blockers, replaced, splitLines, accountOf } = await foldEarlier(ctx, {
		earlier,
		to,
		read: limits.read,
		lookups
	});
	const earlierAssignments = await limits.read(
		'earlierAssignments',
		ctx.db.query('assignments').withIndex('by_month_category', (q) => q.lt('month', month))
	);
	const tooManyToFold = tooManyRead(limits);
	if (tooManyToFold !== null) return { preview: tooManyToFold };
	const cautions = ordered.flatMap((fold) => cautionsOf(fold, accountOf));

	if (blockers.length > 0) {
		return {
			preview: {
				kind: 'blocked',
				from,
				to,
				accounts: ordered.map((fold) => ({
					...accountView(fold),
					proposedStartingBalance: fold.blocked ? null : proposedAmountOf(fold)
				})),
				mustResolve: blockers,
				cautions
			}
		};
	}

	const proposed = ordered.map((fold) => ({
		fold,
		amount: proposedAmountOf(fold),
		category: startingBalanceCategory(fold, budgetInput.categories)
	}));
	const removed = earlierAssignments.filter((row) => row.amount !== 0);
	const before = computeBudget(budgetInput);
	const after = computeBudget({
		...budgetInput,
		cutoverDate: to,
		monthlyTotals: projectedTotals(budgetInput.monthlyTotals, {
			replaced,
			splitLines,
			proposed,
			to
		}),
		assignments: budgetInput.assignments.filter((row) => row.month >= month)
	});

	const reviewed = {
		kind: 'ready' as const,
		from,
		to,
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
	return {
		preview: { ...reviewed, fingerprint: await fingerprintOfWhatItShows(reviewed) },
		plan: {
			history: ordered.flatMap((fold) => fold.history),
			startingBalances: proposed.map(({ fold, amount }) => ({
				account: fold.account,
				existing: fold.startingBalance,
				amount
			})),
			earlierAssignments
		}
	};
}

async function readEarlier(
	ctx: QueryCtx,
	{ to, today, limits }: { to: string; today: string; limits: LimitedReads<LaterCutoverRead> }
): Promise<
	| Unsupported
	| { kind: 'nothingBefore'; from: string; to: string }
	| { from: string; earlier: Doc<'transactions'>[] }
> {
	const from = await readCutoverDate(ctx);
	if (from === null) return unsupported('noCutoverDate', 'Set the cutover date first.');
	if (to <= from) return unsupported('notLater', 'Pick a date after the current cutover date.');
	const earlier = await limits.read(
		'transactions',
		ctx.db.query('transactions').withIndex('by_date', (q) => q.lt('date', to))
	);
	const tooManyEarlier = tooManyRead(limits);
	if (tooManyEarlier !== null) return tooManyEarlier;
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

function tooManyRead(limits: LimitedReads<LaterCutoverRead>): Unsupported | null {
	const reached = limits.reached();
	if (reached === null) return null;
	return unsupported(
		'tooMany',
		`More than ${String(reached.limit)} ${tooManyOf[reached.read]} That is more than Budge can preview at once.`
	);
}

async function lookupsOf(
	ctx: QueryCtx,
	categories: readonly { id: Id<'categories'>; name: string }[],
	read: ReadRows<LaterCutoverRead>
): Promise<Lookups> {
	const accounts = new Map(
		(await read('accounts', ctx.db.query('accounts'))).map((account) => [account._id, account])
	);
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
	{
		earlier,
		to,
		read,
		lookups
	}: {
		earlier: readonly Doc<'transactions'>[];
		to: string;
		read: ReadRows<LaterCutoverRead>;
		lookups: Lookups;
	}
): Promise<Earlier> {
	const folded = new Map(earlier.map((transaction) => [transaction._id, transaction]));
	const folds = new Map<Id<'accounts'>, Fold>();
	const splitLines = new Map<Id<'transactions'>, Doc<'transactionSplits'>[]>();
	const blockers: MustResolve[] = [];
	const replaced = [...earlier];

	for (const transaction of earlier) {
		const fold =
			folds.get(transaction.accountId) ?? emptyFold(lookups.accountOf(transaction.accountId));
		folds.set(transaction.accountId, fold);
		if (transaction.kind === 'startingBalance') {
			fold.startingBalance = transaction;
			continue;
		}
		const lines =
			transaction.split === true
				? await read('splitLines', splitLineRows(ctx, transaction._id))
				: [];
		if (transaction.split === true) splitLines.set(transaction._id, lines);
		const found = await foldTransaction(
			ctx,
			{ lookups, read },
			{ fold, transaction, lines, folded }
		);
		if (found.length > 0) {
			fold.blocked = true;
			blockers.push(...found);
		}
	}

	const ordered = [...folds.values()].toSorted((a, b) => a.account.position - b.account.position);
	for (const fold of ordered) {
		if (fold.startingBalance !== null) continue;
		const existing = await startingBalanceOf(ctx, fold.account._id);
		if (existing === null) continue;
		if (existing.date === to) {
			fold.startingBalance = existing;
			replaced.push(existing);
			continue;
		}
		fold.blocked = true;
		blockers.push({
			kind: 'startingBalanceLater',
			accountName: fold.account.name,
			date: existing.date
		});
	}
	return { ordered, blockers, replaced, splitLines, accountOf: lookups.accountOf };
}

function emptyFold(account: Doc<'accounts'>): Fold {
	return {
		account,
		startingBalance: null,
		rows: [],
		history: [],
		blocked: false,
		remapped: new Map()
	};
}

async function foldTransaction(
	ctx: QueryCtx,
	{ lookups, read }: { lookups: Lookups; read: ReadRows<LaterCutoverRead> },
	{
		fold,
		transaction,
		lines,
		folded
	}: {
		fold: Fold;
		transaction: Doc<'transactions'>;
		lines: Doc<'transactionSplits'>[];
		folded: ReadonlyMap<Id<'transactions'>, Doc<'transactions'>>;
	}
): Promise<MustResolve[]> {
	const { fromBank, feedsElsewhere, bankRows } = await bankOriginOf(
		ctx,
		{ lookups, read },
		transaction
	);
	fold.history.push({ transaction, lines, bankRows });
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

async function bankOriginOf(
	ctx: QueryCtx,
	{ lookups, read }: { lookups: Lookups; read: ReadRows<LaterCutoverRead> },
	transaction: Doc<'transactions'>
) {
	let fromBank = false;
	let feedsElsewhere: Id<'accounts'> | null = null;
	const bankRows = await read('bankRows', allBankRowsOf(ctx, transaction._id));
	for (const bankRow of bankRows) {
		if (bankRow.state !== 'linked' && bankRow.state !== 'changed') continue;
		fromBank = true;
		if (bankRow.connectionAccountId === undefined) continue;
		const feed = await lookups.feedOf(bankRow.connectionAccountId);
		if (feed?.state === 'mapped' && feed.accountId !== transaction.accountId) {
			feedsElsewhere = feed.accountId;
		}
	}
	return { fromBank, feedsElsewhere, bankRows };
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
		replaced,
		splitLines,
		proposed,
		to
	}: {
		replaced: readonly Doc<'transactions'>[];
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
	for (const transaction of replaced) {
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

async function fingerprintOfWhatItShows(
	reviewed: Omit<Extract<LaterCutoverPreview, { kind: 'ready' }>, 'fingerprint'>
) {
	const bytes = new TextEncoder().encode(canonicalWithEveryListAsASet(reviewed));
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalWithEveryListAsASet(value: unknown): string {
	if (Array.isArray(value))
		return `[${value.map(canonicalWithEveryListAsASet).toSorted().join(',')}]`;
	if (value !== null && typeof value === 'object') {
		const fields: [string, unknown][] = Object.entries(value);
		return `{${fields
			.toSorted(([a], [b]) => (a < b ? -1 : 1))
			.map(([key, field]) => `${JSON.stringify(key)}:${canonicalWithEveryListAsASet(field)}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}
