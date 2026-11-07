import { v, type Infer } from 'convex/values';

import { addDays } from '../../src/lib/domain/dates';
import {
	MATCH_WINDOW_DAYS,
	matchBankRows,
	type BankRow,
	type BankSource,
	type MatchCandidate,
	type MatchDecision
} from '../../src/lib/domain/matcher';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { requireCents } from './input';
import { importedPayee, ImportedPayees } from './payees';
import { publicError } from './publicError';
import { allBankRowsOf, insertTransaction, refreshSearchText } from './transactions';
import { requireCutoverDate, requireIsoDate } from './settings';

export const fileSource = v.union(v.literal('qfx'), v.literal('csv'));
export type FileSource = Infer<typeof fileSource>;

export const fileRow = v.object({
	date: v.string(),
	amount: v.number(),
	bankText: v.string(),
	sourceId: v.optional(v.string()),
	pick: v.optional(v.union(v.id('transactions'), v.literal('new')))
});
export type FileRow = Infer<typeof fileRow>;

export const MAX_FILE_ROWS = 250;

const MAX_BANK_TEXT = 500;

export interface IncomingRow extends BankRow {
	merchantName?: string | undefined;
	pick?: Id<'transactions'> | 'new' | undefined;
	heldId?: Id<'imports'> | undefined;
}

export interface ImportPlan<R extends IncomingRow = FileRow> {
	rows: R[];
	decisions: MatchDecision<Id<'transactions'>>[];
	candidates: Map<Id<'transactions'>, Doc<'transactions'>>;
}

export async function planImport(
	ctx: QueryCtx,
	accountId: Id<'accounts'>,
	source: FileSource,
	input: FileRow[]
): Promise<ImportPlan> {
	if ((await ctx.db.get('accounts', accountId)) === null) throw publicError('NOT_FOUND');
	if (input.length > MAX_FILE_ROWS) {
		throw publicError(
			'INVALID_INPUT',
			`Import at most ${String(MAX_FILE_ROWS)} rows at a time; download a shorter date range.`
		);
	}
	const cutoverDate = await requireCutoverDate(ctx);
	const rows = input.map((row) => requireFileRow(row, source, cutoverDate));
	return await planBankRows(ctx, accountId, source, rows);
}

export async function planBankRows<R extends IncomingRow>(
	ctx: QueryCtx,
	accountId: Id<'accounts'>,
	source: BankSource,
	rows: R[],
	mappedFeed?: Id<'connectionAccounts'>
): Promise<ImportPlan<R>> {
	if (rows.length === 0) return { rows, decisions: [], candidates: new Map() };

	const dates = rows.map((row) => row.date).sort();
	const first = dates[0] ?? '';
	const last = dates.at(-1) ?? '';

	const knownImportIds = new Set<string>();
	for (const sourceId of new Set(rows.flatMap((row) => row.sourceId ?? []))) {
		const known = await ctx.db
			.query('imports')
			.withIndex('by_account_source_sourceId_date', (q) =>
				q.eq('accountId', accountId).eq('source', source).eq('sourceId', sourceId)
			)
			.first();
		if (known !== null) knownImportIds.add(sourceId);
	}
	const knownRowsWithoutId = rows.some((row) => row.sourceId === undefined)
		? await ctx.db
				.query('imports')
				.withIndex('by_account_source_sourceId_date', (q) =>
					q
						.eq('accountId', accountId)
						.eq('source', source)
						.eq('sourceId', undefined)
						.gte('date', first)
						.lte('date', last)
				)
				.collect()
		: [];

	const candidates = new Map<Id<'transactions'>, Doc<'transactions'>>();
	const matchCandidates: MatchCandidate<Id<'transactions'>>[] = [];
	const nearby = ctx.db
		.query('transactions')
		.withIndex('by_account_date', (q) =>
			q
				.eq('accountId', accountId)
				.gte('date', addDays(first, -MATCH_WINDOW_DAYS))
				.lte('date', addDays(last, MATCH_WINDOW_DAYS))
		);
	for await (const transaction of nearby) {
		if (!rows.some((row) => row.amount === transaction.amount)) continue;
		candidates.set(transaction._id, transaction);
		matchCandidates.push({
			id: transaction._id,
			date: transaction.date,
			amount: transaction.amount,
			cleared: transaction.cleared !== 'uncleared',
			...(await linkedInventory(ctx, transaction._id, mappedFeed))
		});
	}

	const decisions = matchBankRows(source, rows, {
		knownImportIds,
		knownRowsWithoutId,
		candidates: matchCandidates,
		...(mappedFeed === undefined ? {} : { matchImported: true })
	});
	return { rows, decisions, candidates };
}

export interface ImportCounts {
	added: number;
	matched: number;
	skipped: number;
}

export async function applyBankRows(
	ctx: MutationCtx,
	accountId: Id<'accounts'>,
	source: BankSource,
	{ rows, decisions, candidates }: ImportPlan<IncomingRow>,
	payees: ImportedPayees,
	connectionAccountId?: Id<'connectionAccounts'>
): Promise<ImportCounts> {
	const counts = { added: 0, matched: 0, skipped: 0 };
	for (const [index, decision] of decisions.entries()) {
		const row = rows[index];
		if (row === undefined) continue;
		const bankRow = {
			source,
			...(row.sourceId === undefined ? {} : { sourceId: row.sourceId }),
			accountId,
			...(connectionAccountId === undefined ? {} : { connectionAccountId }),
			date: row.date,
			amount: row.amount,
			bankText: row.bankText,
			state: 'linked' as const
		};
		const writeBankRow = async (transactionId: Id<'transactions'>, matched: boolean) => {
			if (row.heldId === undefined) {
				await ctx.db.insert('imports', { ...bankRow, transactionId, matched });
			} else {
				await ctx.db.patch('imports', row.heldId, {
					accountId,
					transactionId,
					matched,
					state: 'linked',
					merchantName: undefined
				});
			}
			await refreshSearchText(ctx, transactionId);
		};
		if (decision.kind === 'match') {
			const matchedStaysLockedIfReconciled =
				candidates.get(decision.transactionId)?.cleared === 'reconciled';
			await ctx.db.patch('transactions', decision.transactionId, {
				cleared: matchedStaysLockedIfReconciled ? 'reconciled' : 'cleared',
				approved: false
			});
			await writeBankRow(decision.transactionId, true);
			counts.matched++;
		} else if (decision.kind === 'skip') {
			if (row.heldId !== undefined) await ctx.db.delete('imports', row.heldId);
			counts.skipped++;
		} else {
			const transactionId = await insertImported(ctx, accountId, row, payees);
			await writeBankRow(transactionId, false);
			counts.added++;
		}
	}
	return counts;
}

export async function insertImported(
	ctx: MutationCtx,
	accountId: Id<'accounts'>,
	row: { date: string; amount: number; bankText: string; merchantName?: string | undefined },
	payees?: ImportedPayees
) {
	return await insertTransaction(
		ctx,
		{
			accountId,
			date: row.date,
			amount: row.amount,
			...(await importedPayee(ctx, row, payees)),
			cleared: 'cleared',
			approved: false
		},
		[],
		{ deferSearchText: true }
	);
}

export function requireBankRow<R extends BankRow>(row: R, cutoverDate: string): R {
	requireIsoDate(row.date);
	if (row.date < cutoverDate) {
		throw publicError('INVALID_INPUT', 'Budge starts on the cutover date; drop earlier rows.');
	}
	const bankText = row.bankText.replace(/\s+/g, ' ').trim();
	if (bankText === '' || bankText.length > MAX_BANK_TEXT) {
		throw publicError('INVALID_INPUT', 'Each row needs a bank description.');
	}
	return { ...row, amount: requireCents(row.amount), bankText };
}

function requireFileRow(input: FileRow, source: FileSource, cutoverDate: string): FileRow {
	const row = requireBankRow(input, cutoverDate);
	const sourceId = row.sourceId?.trim();
	if (source === 'qfx' && (sourceId === undefined || sourceId === '')) {
		throw publicError('INVALID_INPUT', 'Each QFX row needs its import ID.');
	}
	if (source === 'csv' && sourceId !== undefined) {
		throw publicError('INVALID_INPUT', 'CSV rows have no import ID.');
	}
	return {
		date: row.date,
		amount: row.amount,
		bankText: row.bankText,
		...(sourceId === undefined ? {} : { sourceId }),
		...(row.pick === undefined ? {} : { pick: row.pick })
	};
}

async function linkedInventory(
	ctx: QueryCtx,
	transactionId: Id<'transactions'>,
	mappedFeed: Id<'connectionAccounts'> | undefined
) {
	const linkedSources: BankSource[] = [];
	let linkedFromFeed = false;
	for await (const row of allBankRowsOf(ctx, transactionId)) {
		linkedSources.push(row.source);
		linkedFromFeed ||= row.connectionAccountId === mappedFeed;
	}
	return mappedFeed === undefined ? { linkedSources } : { linkedSources, linkedFromFeed };
}
