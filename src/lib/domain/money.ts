const AMOUNT = /^([-−])?\$?(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d{0,2}))?$/;

export function parseCents(text: string): number | undefined {
	const match = AMOUNT.exec(text.trim());
	if (!match) return undefined;
	const [, sign, whole = '', fraction = ''] = match;
	if (whole === '' && fraction === '') return undefined;
	const cents = Number(whole.replaceAll(',', '') || '0') * 100 + Number(fraction.padEnd(2, '0'));
	if (!Number.isSafeInteger(cents)) return undefined;
	return sign && cents !== 0 ? -cents : cents;
}

const SUM = /^[-−]?[^+\-−]+(?:[+\-−][^+\-−]+)*$/;

export function parseCentsSum(text: string): number | undefined {
	const trimmed = text.trim();
	if (!SUM.test(trimmed)) return undefined;
	let total = 0;
	for (const [, operator, term = ''] of trimmed.matchAll(/([+\-−]?)([^+\-−]+)/g)) {
		const cents = parseCents(term.trim());
		if (cents === undefined) return undefined;
		total += operator === '' || operator === '+' ? cents : -cents;
	}
	return Number.isSafeInteger(total) ? total : undefined;
}

export function parseAssigned(text: string, saved: number): number | undefined {
	const trimmed = text.trim();
	const relative = /^[+\-−]/.test(trimmed);
	const cents = parseCentsSum(relative ? `0${trimmed}` : trimmed);
	if (cents === undefined) return undefined;
	const total = relative ? saved + cents : cents;
	return Number.isSafeInteger(total) ? total : undefined;
}

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatCents(cents: number): string {
	const text = dollars.format(Math.abs(cents) / 100);
	return cents < 0 ? `−${text}` : text;
}
