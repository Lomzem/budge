import { isIsoDate } from '../../src/lib/domain/dates';
import type { QueryCtx } from '../_generated/server';
import { publicError } from './publicError';

export async function readCutoverDate(ctx: QueryCtx): Promise<string | null> {
	const settings = await ctx.db.query('settings').first();
	return settings?.cutoverDate ?? null;
}

/** The cutover date, which must be set before any Account or Transaction exists. */
export async function requireCutoverDate(ctx: QueryCtx): Promise<string> {
	const cutoverDate = await readCutoverDate(ctx);
	if (cutoverDate === null) throw publicError('INVALID_INPUT', 'Set the cutover date first.');
	return cutoverDate;
}

export function requireIsoDate(date: string) {
	if (!isIsoDate(date)) throw publicError('INVALID_INPUT', 'Enter a real date.');
}
