import { v, type Infer } from 'convex/values';

import { addDays } from '../../src/lib/domain/dates';
import {
	MATCH_WINDOW_DAYS,
	matchBankRows,
	type MatchCandidate,
	type MatchDecision
} from '../../src/lib/domain/matcher';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { requireCents } from './input';
import { publicError } from './publicError';
import { bankRowsOf } from './transactions';
import { requireCutoverDate, requireIsoDate } from './settings';

export const fileSource = v.union(v.literal('qfx'), v.literal('csv'));
export type FileSource = Infer<typeof fileSource>;

/** A Bank Row decoded in the browser, and the owner's pick when it has several candidates. */
export const fileRow = v.object({
	date: v.string(),
	amount: v.number(),
	bankText: v.string(),
	sourceId: v.optional(v.string()),
	pick: v.optional(v.union(v.id('transactions'), v.literal('new')))
});
export type FileRow = Infer<typeof fileRow>;

/** More rows than a year of one Account's statements; keeps one commit inside Convex's limits. */
export const MAX_FILE_ROWS = 1_000;

const MAX_BANK_TEXT = 500;

export interface ImportPlan {
	rows: FileRow[];
	decisions: MatchDecision<Id<'transactions'>>[];
	candidates: Map<Id<'transactions'>, Doc<'transactions'>>;
}

/**
 * Checks a file's rows again, never trusting the browser, then runs the matcher against what the
 * Account already holds.
 */
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
	if (rows.length === 0) return { rows, decisions: [], candidates: new Map() };

	const dates = rows.map((row) => row.date).sort();
	const first = dates[0] ?? cutoverDate;
	const last = dates.at(-1) ?? cutoverDate;

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
		const linked = await bankRowsOf(ctx, transaction._id);
		candidates.set(transaction._id, transaction);
		matchCandidates.push({
			id: transaction._id,
			date: transaction.date,
			amount: transaction.amount,
			cleared: transaction.cleared !== 'uncleared',
			linkedSources: linked.map((row) => row.source)
		});
	}

	const decisions = matchBankRows(source, rows, {
		knownImportIds,
		knownRowsWithoutId,
		candidates: matchCandidates
	});
	return { rows, decisions, candidates };
}

function requireFileRow(row: FileRow, source: FileSource, cutoverDate: string): FileRow {
	requireIsoDate(row.date);
	if (row.date < cutoverDate) {
		throw publicError('INVALID_INPUT', 'Budge starts on the cutover date; drop earlier rows.');
	}
	const bankText = row.bankText.replace(/\s+/g, ' ').trim();
	if (bankText === '' || bankText.length > MAX_BANK_TEXT) {
		throw publicError('INVALID_INPUT', 'Each row needs a bank description.');
	}
	const sourceId = row.sourceId?.trim();
	if (source === 'qfx' && (sourceId === undefined || sourceId === '')) {
		throw publicError('INVALID_INPUT', 'Each QFX row needs its import ID.');
	}
	if (source === 'csv' && sourceId !== undefined) {
		throw publicError('INVALID_INPUT', 'CSV rows have no import ID.');
	}
	return {
		date: row.date,
		amount: requireCents(row.amount),
		bankText,
		...(sourceId === undefined ? {} : { sourceId }),
		...(row.pick === undefined ? {} : { pick: row.pick })
	};
}
