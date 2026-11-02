import { addDays } from './dates';

export type BankSource = 'plaid' | 'qfx' | 'csv';

export interface BankRow {
	date: string;
	amount: number;
	bankText: string;

	sourceId?: string;
}

export interface MatchCandidate<T> {
	id: T;
	date: string;
	amount: number;
	cleared: boolean;

	linkedSources: readonly BankSource[];
}

export interface MatchContext<T> {
	knownImportIds: ReadonlySet<string>;

	knownRowsWithoutId?: readonly Pick<BankRow, 'date' | 'amount' | 'bankText'>[];

	candidates: readonly MatchCandidate<T>[];
}

export type MatchDecision<T> =
	| { kind: 'skip' }
	| { kind: 'match'; transactionId: T; candidates?: T[] }
	| { kind: 'ask'; candidates: T[] }
	| { kind: 'new'; candidates?: T[] };

export const MATCH_WINDOW_DAYS = 10;

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

		if (row.pick === 'new')
			return candidates.length > 0 ? { kind: 'new', candidates } : { kind: 'new' };
		const [only] = candidates;
		if (only !== undefined && candidates.length === 1) {
			taken.add(only);
			return { kind: 'match', transactionId: only };
		}
		if (candidates.length > 1) {
			const picked = candidates.find((id) => id === row.pick);
			if (picked === undefined) return { kind: 'ask', candidates };
			taken.add(picked);
			return { kind: 'match', transactionId: picked, candidates };
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
