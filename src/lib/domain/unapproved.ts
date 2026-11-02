export const UNAPPROVED_COUNT_LIMIT = 1_000;

const whole = new Intl.NumberFormat('en-US');

export function formatUnapprovedCount(count: number): string {
	return count > UNAPPROVED_COUNT_LIMIT
		? `${whole.format(UNAPPROVED_COUNT_LIMIT)}+`
		: whole.format(count);
}
