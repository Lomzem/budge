// The one matcher that decides what each Bank Row does to the Transactions, shared by file import
// and, later, bank sync.

import { addDays } from './dates';

/** Where a Bank Row came from: a bank sync, or a QFX or CSV file. */
export type BankSource = 'plaid' | 'qfx' | 'csv';

/** What a bank reported for one Transaction, in whole cents and an ISO date. */
export interface BankRow {
	date: string;
	amount: number;
	bankText: string;
	/** The bank's import ID, unique within the Account and source. CSV rows have none. */
	sourceId?: string;
}

/** A Transaction already in the Account that a Bank Row might Match. */
export interface MatchCandidate<T> {
	id: T;
	date: string;
	amount: number;
	cleared: boolean;
	/** The sources of the Bank Rows already linked to it. */
	linkedSources: readonly BankSource[];
}

/** What the Account already holds that the matcher checks a batch of Bank Rows against. */
export interface MatchContext<T> {
	/** The import IDs of this source already known in the Account. */
	knownImportIds: ReadonlySet<string>;
	/**
	 * This source's Bank Rows without an import ID already in the Account, over the batch's
	 * dates. A row identical to one of them repeats it, once per row.
	 */
	knownRowsWithoutId?: readonly Pick<BankRow, 'date' | 'amount' | 'bankText'>[];
	/** The Account's Transactions dated within the match window of any row in the batch. */
	candidates: readonly MatchCandidate<T>[];
}

export type MatchDecision<T> =
	| { kind: 'skip' }
	| { kind: 'match'; transactionId: T }
	| { kind: 'ask'; candidates: T[] }
	| { kind: 'new' };

/** How far apart, in days, a Bank Row and the Transaction it Matches may be dated. */
export const MATCH_WINDOW_DAYS = 10;

/**
 * Decides, for each Bank Row in order, whether to skip it, Match it to the one candidate, ask the
 * owner to pick among several, or add it as a new Transaction. Each Transaction takes at most one
 * row, so two identical rows never collapse into one. A row's `pick` resolves an "ask": a
 * candidate's ID Matches it, and `'new'` adds it as a new Transaction.
 */
export function matchBankRows<T>(
	source: BankSource,
	rows: readonly (BankRow & { pick?: T | 'new' | undefined })[],
	context: MatchContext<T>
): MatchDecision<T>[] {
	const seenIds = new Set(context.knownImportIds);
	const repeats = [...(context.knownRowsWithoutId ?? [])];
	const taken = new Set<T>();
	const fromFile = source !== 'plaid';

	return rows.map((row) => {
		if (row.sourceId !== undefined) {
			if (seenIds.has(row.sourceId)) return { kind: 'skip' };
			seenIds.add(row.sourceId);
		} else {
			const repeat = repeats.findIndex(
				(known) =>
					known.date === row.date && known.amount === row.amount && known.bankText === row.bankText
			);
			if (repeat !== -1) {
				repeats.splice(repeat, 1);
				return { kind: 'skip' };
			}
		}

		const candidates = context.candidates
			.filter(
				(candidate) =>
					!taken.has(candidate.id) &&
					candidate.amount === row.amount &&
					withinWindow(candidate.date, row.date) &&
					(!candidate.cleared || (fromFile && candidate.linkedSources.includes('plaid'))) &&
					!candidate.linkedSources.includes(source)
			)
			.sort((a, b) => distance(a.date, row.date) - distance(b.date, row.date))
			.map((candidate) => candidate.id);

		const [only] = candidates;
		if (only !== undefined && candidates.length === 1) {
			taken.add(only);
			return { kind: 'match', transactionId: only };
		}
		if (candidates.length > 1) {
			if (row.pick === 'new') return { kind: 'new' };
			const picked = candidates.find((id) => id === row.pick);
			if (picked === undefined) return { kind: 'ask', candidates };
			taken.add(picked);
			return { kind: 'match', transactionId: picked };
		}
		return { kind: 'new' };
	});
}

function withinWindow(a: string, b: string) {
	return a >= addDays(b, -MATCH_WINDOW_DAYS) && a <= addDays(b, MATCH_WINDOW_DAYS);
}

function distance(a: string, b: string) {
	return Math.abs(Date.parse(a) - Date.parse(b));
}
