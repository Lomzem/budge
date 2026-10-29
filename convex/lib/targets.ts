import { v, type Infer } from 'convex/values';

import { isRepeatInterval, MAX_REPEAT_MONTHS } from '../../src/lib/domain/budget';
import { isIsoDate } from '../../src/lib/domain/dates';
import { requireCents } from './input';
import { publicError } from './publicError';

/** A Category's Target, stored on the Category: a Monthly Target or a By date Target. */
export const targetValidator = v.union(
	v.object({
		kind: v.literal('monthly'),
		amount: v.number(),
		mode: v.union(v.literal('refill'), v.literal('setAside')),
		// 1–31; a shorter month uses its last day.
		dueDay: v.optional(v.number())
	}),
	v.object({
		kind: v.literal('byDate'),
		amount: v.number(),
		firstDate: v.string(),
		everyMonths: v.optional(v.number())
	})
);

export type StoredTarget = Infer<typeof targetValidator>;

/** A Target the budget can work with: a positive amount, a real due day or date, whole months. */
export function requireTarget(target: StoredTarget): StoredTarget {
	const amount = requireCents(target.amount);
	if (amount <= 0) throw publicError('INVALID_INPUT', 'Enter an amount above zero.');
	if (target.kind === 'monthly') {
		const { dueDay } = target;
		if (dueDay !== undefined && !(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31)) {
			throw publicError('INVALID_INPUT', 'Pick a due day from 1 to 31.');
		}
		return dueDay === undefined
			? { kind: 'monthly', amount, mode: target.mode }
			: { kind: 'monthly', amount, mode: target.mode, dueDay };
	}
	if (!isIsoDate(target.firstDate)) throw publicError('INVALID_INPUT', 'Pick a date.');
	const { everyMonths } = target;
	if (everyMonths !== undefined && !isRepeatInterval(everyMonths)) {
		throw publicError('INVALID_INPUT', `Repeat every 1 to ${String(MAX_REPEAT_MONTHS)} months.`);
	}
	return everyMonths === undefined
		? { kind: 'byDate', amount, firstDate: target.firstDate }
		: { kind: 'byDate', amount, firstDate: target.firstDate, everyMonths };
}
