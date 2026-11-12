export const BANK_CHANGE_LIMIT = 500;

export function formatBankChangeCount({
	count,
	complete
}: {
	count: number;
	complete: boolean;
}): string {
	return `${String(count)}${complete ? '' : '+'} ${count === 1 && complete ? 'bank change' : 'bank changes'}`;
}
