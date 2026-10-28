// Money is whole cents as safe integers. Typed amounts become cents here and nowhere else.

const AMOUNT = /^([-−])?\$?(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d{0,2}))?$/;

/** Cents for an amount the owner typed, such as `1,234.56` or `-3.07`, or `undefined`. */
export function parseCents(text: string): number | undefined {
	const match = AMOUNT.exec(text.trim());
	if (!match) return undefined;
	const [, sign, whole = '', fraction = ''] = match;
	if (whole === '' && fraction === '') return undefined;
	const cents = Number(whole.replaceAll(',', '') || '0') * 100 + Number(fraction.padEnd(2, '0'));
	if (!Number.isSafeInteger(cents)) return undefined;
	return sign && cents !== 0 ? -cents : cents;
}

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Cents as dollars, with a true minus sign for negatives: `−$450.00`. */
export function formatCents(cents: number): string {
	const text = dollars.format(Math.abs(cents) / 100);
	return cents < 0 ? `−${text}` : text;
}
