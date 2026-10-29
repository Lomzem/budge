// Dates are `YYYY-MM-DD` strings and months `YYYY-MM`; both sort correctly as text.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `text` is a real calendar date written `YYYY-MM-DD`. */
export function isIsoDate(text: string): boolean {
	const match = ISO_DATE.exec(text);
	if (!match) return false;
	const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The `YYYY-MM` month a Transaction dated `date` falls in. */
export function monthOf(date: string): string {
	return date.slice(0, 7);
}

const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Whether `text` is a month written `YYYY-MM`. */
export function isIsoMonth(text: string): boolean {
	return ISO_MONTH.test(text);
}

/** The `YYYY-MM` month `count` months after `month` (before it when negative). */
export function addMonths(month: string, count: number): string {
	const [year = 0, index = 1] = month.split('-').map(Number);
	const moved = year * 12 + (index - 1) + count;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${String(Math.floor(moved / 12)).padStart(4, '0')}-${pad((moved % 12) + 1)}`;
}

/** The `YYYY-MM-DD` date `instant` falls on in the local time zone. */
export function localIsoDate(instant: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${String(instant.getFullYear())}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

/** The owner's local date now. */
export function localToday(): string {
	return localIsoDate(new Date());
}

const monthFormat = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

/** A `YYYY-MM` month for display: `October 2026`. */
export function formatMonth(month: string): string {
	return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

const dateFormats = {
	long: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
	short: new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeZone: 'UTC' })
};

/** A `YYYY-MM-DD` date for display: `Aug 1, 2026`, or `8/1/26` when short. */
export function formatDate(date: string, style: keyof typeof dateFormats = 'long'): string {
	return dateFormats[style].format(new Date(`${date}T00:00:00Z`));
}
