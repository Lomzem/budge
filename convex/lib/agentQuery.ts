import { isIsoDate, isIsoMonth } from '../../src/lib/domain/dates';

export interface Refusal {
	refused: string;
}

export const TRANSACTIONS_LIMIT = 100;
const DEFAULT_TRANSACTIONS_LIMIT = 50;

const TRANSACTION_PARAMETERS = [
	'from',
	'to',
	'accountId',
	'categoryId',
	'splitLines',
	'uncategorized',
	'approval',
	'search',
	'limit',
	'cursor'
] as const;

function unknownParameterIn(query: URLSearchParams, allowed: readonly string[]) {
	const unknown = [...query.keys()].find((name) => !allowed.includes(name));
	if (unknown === undefined) return null;
	const accepted = allowed.length === 0 ? 'none' : allowed.join(', ');
	return `Unknown parameter ${unknown}. Accepted parameters: ${accepted}.`;
}

function firstRefusal(problems: (string | null)[]): Refusal | null {
	const problem = problems.find((candidate): candidate is string => candidate !== null);
	return problem === undefined ? null : { refused: problem };
}

export function parseEmptyQuery(query: URLSearchParams): Refusal | null {
	return firstRefusal([unknownParameterIn(query, [])]);
}

export function parseBudgetQuery(
	query: URLSearchParams
): Refusal | { month: string; today: string } {
	const month = query.get('month') ?? '';
	const today = query.get('today') ?? '';
	const refusal = firstRefusal([
		unknownParameterIn(query, ['month', 'today']),
		isIsoMonth(month) ? null : 'month must be YYYY-MM, e.g. 2026-10.',
		isIsoDate(today) ? null : "today must be the owner's local date as YYYY-MM-DD."
	]);
	return refusal ?? { month, today };
}

function dateProblem(query: URLSearchParams, name: 'from' | 'to') {
	const value = query.get(name);
	return value === null || isIsoDate(value) ? null : `${name} must be a date as YYYY-MM-DD.`;
}

function flagProblem(query: URLSearchParams, name: 'uncategorized' | 'splitLines') {
	const value = query.get(name);
	return value === null || value === 'true' ? null : `${name} accepts only true.`;
}

const APPROVALS = ['approved', 'unapproved'] as const;

type Approval = (typeof APPROVALS)[number];

function limitOf(query: URLSearchParams) {
	const value = query.get('limit');
	if (value === null) return DEFAULT_TRANSACTIONS_LIMIT;
	const limit = /^\d+$/.test(value) ? Number(value) : NaN;
	return limit >= 1 && limit <= TRANSACTIONS_LIMIT ? limit : null;
}

function transactionsProblems(query: URLSearchParams, approval: Approval | undefined) {
	return [
		unknownParameterIn(query, TRANSACTION_PARAMETERS),
		dateProblem(query, 'from'),
		dateProblem(query, 'to'),
		flagProblem(query, 'uncategorized'),
		flagProblem(query, 'splitLines'),
		query.has('approval') && approval === undefined
			? 'approval must be approved or unapproved.'
			: null,
		query.has('uncategorized') && query.has('categoryId')
			? 'Pick categoryId or uncategorized=true, not both.'
			: null,
		query.has('splitLines') && !query.has('categoryId')
			? 'splitLines=true needs the categoryId the split lines are in.'
			: null
	];
}

export function parseTransactionsQuery(query: URLSearchParams) {
	const limit = limitOf(query);
	if (limit === null) {
		return { refused: `limit must be a whole number from 1 to ${String(TRANSACTIONS_LIMIT)}.` };
	}
	const approval = APPROVALS.find((candidate) => candidate === query.get('approval'));
	const refusal = firstRefusal(transactionsProblems(query, approval));
	if (refusal !== null) return refusal;
	return {
		from: query.get('from') ?? undefined,
		to: query.get('to') ?? undefined,
		accountId: query.get('accountId') ?? undefined,
		categoryId: query.get('categoryId') ?? undefined,
		search: query.get('search') ?? undefined,
		approval,
		uncategorized: query.has('uncategorized') ? (true as const) : undefined,
		splitLines: query.has('splitLines'),
		paginationOpts: { numItems: limit, cursor: query.get('cursor') }
	};
}
