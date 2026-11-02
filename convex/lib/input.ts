import { publicError } from './publicError';

export function requireName(name: string): string {
	const trimmed = name.trim();
	if (trimmed === '') throw publicError('INVALID_INPUT', 'Enter a name.');
	return trimmed;
}

const MAX_CENTS = 1_000_000_000_000;

export function requireCents(amount: number): number {
	if (!Number.isSafeInteger(amount))
		throw publicError('INVALID_INPUT', 'Enter an amount in cents.');
	if (Math.abs(amount) > MAX_CENTS)
		throw publicError('INVALID_INPUT', 'Enter an amount under $10 billion.');
	return amount;
}
