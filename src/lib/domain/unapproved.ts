// Counting reads each Unapproved Transaction, so a count stops one past this many, and one
// "Approve all" approves at most this many.
export const UNAPPROVED_COUNT_LIMIT = 1_000;

const whole = new Intl.NumberFormat('en-US');

/** An Unapproved count as text. Past the limit the count is a lower bound: `1,000+`. */
export function formatUnapprovedCount(count: number): string {
	return count > UNAPPROVED_COUNT_LIMIT
		? `${whole.format(UNAPPROVED_COUNT_LIMIT)}+`
		: whole.format(count);
}
