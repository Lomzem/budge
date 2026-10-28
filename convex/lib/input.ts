import { publicError } from './publicError';

/** A name with its outer spaces trimmed; blank names are refused. */
export function requireName(name: string): string {
	const trimmed = name.trim();
	if (trimmed === '') throw publicError('INVALID_INPUT', 'Enter a name.');
	return trimmed;
}

// $10 billion. Far above any household amount, and low enough that totals of many such
// amounts stay safe integers, so the monthly totals never lose a cent.
const MAX_CENTS = 1_000_000_000_000;

/** Money is whole cents as a safe integer, no larger than $10 billion either way. */
export function requireCents(amount: number): number {
	if (!Number.isSafeInteger(amount))
		throw publicError('INVALID_INPUT', 'Enter an amount in cents.');
	if (Math.abs(amount) > MAX_CENTS)
		throw publicError('INVALID_INPUT', 'Enter an amount under $10 billion.');
	return amount;
}
