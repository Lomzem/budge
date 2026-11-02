const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(text: string): boolean {
	const match = ISO_DATE.exec(text);
	if (!match) return false;
	const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function monthOf(date: string): string {
	return date.slice(0, 7);
}

const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isIsoMonth(text: string): boolean {
	return ISO_MONTH.test(text);
}

export function addMonths(month: string, count: number): string {
	const [year = 0, index = 1] = month.split('-').map(Number);
	const moved = year * 12 + (index - 1) + count;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${String(Math.floor(moved / 12)).padStart(4, '0')}-${pad((moved % 12) + 1)}`;
}

export function monthsBetween(from: string, to: string): number {
	const index = (month: string) => {
		const [year = 0, number = 1] = month.split('-').map(Number);
		return year * 12 + number - 1;
	};
	return index(to) - index(from);
}

export function addDays(date: string, count: number): string {
	const moved = new Date(`${date}T00:00:00Z`);
	moved.setUTCDate(moved.getUTCDate() + count);
	return moved.toISOString().slice(0, 10);
}

export function addMonthsToDate(date: string, count: number): string {
	return dayOfMonth(addMonths(monthOf(date), count), Number(date.slice(8)));
}

export function dayOfMonth(month: string, day: number): string {
	const [year = 0, index = 1] = month.split('-').map(Number);
	const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
	return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

export function localIsoDate(instant: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${String(instant.getFullYear())}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

export function localToday(): string {
	return localIsoDate(new Date());
}

const monthFormat = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

export function formatMonth(month: string): string {
	return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

const dateFormats = {
	long: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
	short: new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeZone: 'UTC' })
};

export function formatDate(date: string, style: keyof typeof dateFormats = 'long'): string {
	return dateFormats[style].format(new Date(`${date}T00:00:00Z`));
}

export function ordinal(day: number): string {
	const tens = day % 100;
	if (tens >= 11 && tens <= 13) return `${String(day)}th`;
	const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
	return `${String(day)}${suffix}`;
}
