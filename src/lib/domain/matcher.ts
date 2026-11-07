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
	linkedFromFeed?: boolean;
}

export interface MatchContext<T> {
	knownImportIds: ReadonlySet<string>;

	knownRowsWithoutId?: readonly Pick<BankRow, 'date' | 'amount' | 'bankText'>[];

	candidates: readonly MatchCandidate<T>[];
	matchImported?: boolean;
}

export type MatchDecision<T> =
	| { kind: 'skip' }
	| { kind: 'match'; transactionId: T; candidates?: T[] }
	| { kind: 'ask'; candidates: T[] }
	| { kind: 'new'; candidates?: T[] };

export const MATCH_WINDOW_DAYS = 10;

const LISTED_CANDIDATES = 10;

export function matchBankRows<T>(
	source: BankSource,
	rows: readonly (BankRow & { pick?: T | 'new' | undefined })[],
	context: MatchContext<T>
): MatchDecision<T>[] {
	const seenIds = new Set(context.knownImportIds);
	const repeats = [...(context.knownRowsWithoutId ?? [])];
	const taken = new Set<T>();
	const fromFile = source !== 'plaid';
	const takesImported = ({ linkedSources }: MatchCandidate<T>) =>
		context.matchImported === true
			? linkedSources.length > 0
			: fromFile && linkedSources.includes('plaid');
	const pool = context.candidates
		.filter(
			(candidate) =>
				(!candidate.cleared || takesImported(candidate)) &&
				!(candidate.linkedFromFeed ?? candidate.linkedSources.includes(source))
		)
		.map(({ id, date, amount }) => ({ id, date, amount, time: Date.parse(date) }));

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

		const earliest = addDays(row.date, -MATCH_WINDOW_DAYS);
		const latest = addDays(row.date, MATCH_WINDOW_DAYS);
		const at = Date.parse(row.date);
		const candidates = pool
			.filter(
				(candidate) =>
					!taken.has(candidate.id) &&
					candidate.amount === row.amount &&
					candidate.date >= earliest &&
					candidate.date <= latest
			)
			.sort((a, b) => Math.abs(a.time - at) - Math.abs(b.time - at))
			.map((candidate) => candidate.id);

		if (row.pick === 'new')
			return candidates.length > 0
				? { kind: 'new', candidates: listed(candidates) }
				: { kind: 'new' };
		const [only] = candidates;
		if (only !== undefined && candidates.length === 1) {
			taken.add(only);
			return { kind: 'match', transactionId: only };
		}
		if (candidates.length > 1) {
			const picked = candidates.find((id) => id === row.pick);
			if (picked === undefined) return { kind: 'ask', candidates: listed(candidates) };
			taken.add(picked);
			return { kind: 'match', transactionId: picked, candidates: listed(candidates, picked) };
		}
		return { kind: 'new' };
	});
}

function listed<T>(candidates: T[], picked?: T): T[] {
	const nearest = candidates.slice(0, LISTED_CANDIDATES);
	if (picked === undefined || nearest.includes(picked)) return nearest;
	return [...nearest.slice(0, -1), picked];
}
