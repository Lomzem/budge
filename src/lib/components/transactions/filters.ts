export interface TransactionFilterValues {
	search: string;
	accountId: string;
	categoryId: string;
	payeeId: string;
	from: string;
	to: string;
}

export const noFilters: TransactionFilterValues = {
	search: '',
	accountId: '',
	categoryId: '',
	payeeId: '',
	from: '',
	to: ''
};
