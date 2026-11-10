import { isIsoDate } from '$lib/domain/dates';

export interface TransactionFilterValues {
	search: string;
	accountId: string;
	categoryId: string;
	status: string;
	payeeId: string;
	from: string;
	to: string;
}

export const noFilters: TransactionFilterValues = {
	search: '',
	accountId: '',
	categoryId: '',
	status: '',
	payeeId: '',
	from: '',
	to: ''
};

export const UNCATEGORIZED = 'uncategorized';
export const UNAPPROVED = 'unapproved';
export const BANK_CHANGES = 'bank-changes';

const STATUSES = new Set([UNAPPROVED, BANK_CHANGES]);

const PARAMS: Record<keyof TransactionFilterValues, string> = {
	search: 'q',
	accountId: 'account',
	categoryId: 'category',
	status: 'status',
	payeeId: 'payee',
	from: 'from',
	to: 'to'
};

function accepted(key: keyof TransactionFilterValues, value: string) {
	switch (key) {
		case 'status':
			return STATUSES.has(value);
		case 'from':
		case 'to':
			return isIsoDate(value);
		case 'search':
		case 'accountId':
		case 'categoryId':
		case 'payeeId':
			return true;
	}
}

export interface FilterChoices {
	accountIds: readonly string[] | undefined;
	categoryIds: readonly string[] | undefined;
	payeeIds: readonly string[] | undefined;
}

type Chosen = 'accountId' | 'categoryId' | 'payeeId';

const CHOICES: Record<Chosen, keyof FilterChoices> = {
	accountId: 'accountIds',
	categoryId: 'categoryIds',
	payeeId: 'payeeIds'
};

export function offeredFilters(
	values: TransactionFilterValues,
	choices: FilterChoices
): TransactionFilterValues | undefined {
	const offered = { ...values };
	for (const key of Object.keys(CHOICES) as Chosen[]) {
		const value = values[key];
		if (value === '' || (key === 'categoryId' && value === UNCATEGORIZED)) continue;
		const ids = choices[CHOICES[key]];
		if (ids === undefined) return undefined;
		if (!ids.includes(value)) offered[key] = '';
	}
	return offered;
}

export function filtersFromUrl(url: URL): TransactionFilterValues {
	const values = { ...noFilters };
	for (const key of Object.keys(PARAMS) as (keyof TransactionFilterValues)[]) {
		const value = url.searchParams.get(PARAMS[key]) ?? '';
		if (value !== '' && accepted(key, value)) values[key] = value;
	}
	return values;
}

export function urlWithFilters(url: URL, values: TransactionFilterValues): URL {
	const next = new URL(url);
	for (const key of Object.keys(PARAMS) as (keyof TransactionFilterValues)[]) {
		if (values[key] === '') next.searchParams.delete(PARAMS[key]);
		else next.searchParams.set(PARAMS[key], values[key]);
	}
	return next;
}

export function countedTransactions(count: number, values: TransactionFilterValues) {
	const noun = count === 1 ? 'Transaction' : 'Transactions';
	if (values.status === BANK_CHANGES) return `${String(count)} ${noun} the bank changed`;
	const narrowedFurther =
		values.search.trim() !== '' ||
		values.accountId !== '' ||
		(values.categoryId !== '' && values.categoryId !== UNCATEGORIZED) ||
		values.payeeId !== '' ||
		values.from !== '' ||
		values.to !== '';
	const words = [
		...(narrowedFurther ? ['matching'] : []),
		...(values.status === UNAPPROVED ? ['Unapproved'] : []),
		...(values.categoryId === UNCATEGORIZED ? ['Uncategorized'] : []),
		noun
	];
	return `${String(count)} ${words.join(' ')}`;
}
