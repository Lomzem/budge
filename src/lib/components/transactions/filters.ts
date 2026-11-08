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

export function filtersFromUrl(url: URL): TransactionFilterValues {
	const category = url.searchParams.get('category');
	const status = url.searchParams.get('status');
	return {
		...noFilters,
		categoryId: category === UNCATEGORIZED ? UNCATEGORIZED : '',
		status: status === UNAPPROVED ? UNAPPROVED : ''
	};
}
