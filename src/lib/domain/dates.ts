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

/** The `YYYY-MM-DD` date `instant` falls on in the local time zone. */
export function localIsoDate(instant: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${String(instant.getFullYear())}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

const dateFormats = {
	long: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
	short: new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeZone: 'UTC' })
};

/** A `YYYY-MM-DD` date for display: `Aug 1, 2026`, or `8/1/26` when short. */
export function formatDate(date: string, style: keyof typeof dateFormats = 'long'): string {
	return dateFormats[style].format(new Date(`${date}T00:00:00Z`));
}
