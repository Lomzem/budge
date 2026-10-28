import { v } from 'convex/values';

import { localIsoDate } from '../src/lib/domain/dates';
import type { Id } from './_generated/dataModel';
import { env, internalMutation, type MutationCtx } from './_generated/server';
import { rebuildMonthlyTotals } from './lib/monthlyTotals';

// Invented Payees and amounts that mirror only the shape of a real budget. The repo is public:
// nothing here may come from real data.
const PAYEES = {
	paycheck: 'Sample Employer Payroll',
	rent: 'Sample Landlord',
	groceries: ['Sample Grocer', 'Sample Market'],
	transit: 'Sample Transit Pass',
	coffee: 'Sample Coffee Shop',
	dining: ['Sample Noodle Bar', 'Sample Taco Stand'],
	utilities: 'Sample Utility Co',
	interest: 'Savings Interest'
} as const;

/**
 * Writes a small synthetic budget on an empty backend: three Accounts and about three months of
 * made-up Transactions, from the first of the month two months back through today. Ends by
 * rebuilding the monthly totals, so every seeded deployment exercises the rebuild.
 */
export const run = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		// Any value, even an empty one, marks production.
		if (env.BUDGE_PRODUCTION !== undefined) throw new Error('The seed never runs on production.');
		const started =
			(await ctx.db.query('accounts').first()) !== null ||
			(await ctx.db.query('settings').first()) !== null;
		if (started) {
			throw new Error(
				'The seed runs only on an empty backend, before any Account or cutover date.'
			);
		}

		const now = new Date(Date.now());
		const today = localIsoDate(now);
		const cutover = new Date(now.getFullYear(), now.getMonth() - 2, 1);
		const cutoverDate = localIsoDate(cutover);
		await ctx.db.insert('settings', { cutoverDate });

		const checking = await ctx.db.insert('accounts', {
			name: 'Checking',
			kind: 'cash',
			position: 0
		});
		const savings = await ctx.db.insert('accounts', { name: 'Savings', kind: 'cash', position: 1 });
		const card = await ctx.db.insert('accounts', { name: 'Card', kind: 'creditCard', position: 2 });

		// Amounts are cents, written with a separator before the cents: 2_418_37 is $2,418.37.
		const write = writer(ctx);
		await write(checking, cutoverDate, 2_418_37, 'Starting Balance', true);
		await write(savings, cutoverDate, 8_150_00, 'Starting Balance', true);
		await write(card, cutoverDate, -612_48, 'Starting Balance', true);

		// A fixed pseudo-random sequence, so every seeded backend looks the same on the same day.
		let state = 7;
		const next = (below: number) => {
			state = (state * 48_271) % 2_147_483_647;
			return state % below;
		};
		for (let day = new Date(cutover); localIsoDate(day) <= today; day.setDate(day.getDate() + 1)) {
			const date = localIsoDate(day);
			const dayOfMonth = day.getDate();
			// Recent days stay uncleared, as if the bank hasn't confirmed them yet.
			const cleared =
				date < localIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4));
			if (dayOfMonth === 1) await write(checking, date, -1_450_00, PAYEES.rent, cleared);
			if (dayOfMonth === 1 || dayOfMonth === 15) {
				await write(checking, date, 2_310_42, PAYEES.paycheck, cleared);
			}
			if (dayOfMonth === 20)
				await write(checking, date, -(96_00 + next(40_00)), PAYEES.utilities, cleared);
			if (dayOfMonth === 28) await write(savings, date, 6_12, PAYEES.interest, cleared);
			if (day.getDay() === 6) {
				await write(card, date, -(48_00 + next(70_00)), PAYEES.groceries[next(2)] ?? '', cleared);
			}
			if (day.getDay() === 1) await write(checking, date, -25_00, PAYEES.transit, cleared);
			if (next(3) === 0) await write(card, date, -(3_75 + next(3_00)), PAYEES.coffee, cleared);
			if (next(6) === 0) {
				await write(card, date, -(14_00 + next(30_00)), PAYEES.dining[next(2)] ?? '', cleared);
			}
		}

		await rebuildMonthlyTotals(ctx);
		return null;
	}
});

/** Inserts Transactions directly, leaving the monthly totals to the final rebuild. */
function writer(ctx: MutationCtx) {
	const payees = new Map<string, Id<'payees'>>();
	return async (
		accountId: Id<'accounts'>,
		date: string,
		amount: number,
		payee: string,
		cleared: boolean
	) => {
		let payeeId = payees.get(payee);
		if (payeeId === undefined) {
			payeeId = await ctx.db.insert('payees', { name: payee });
			payees.set(payee, payeeId);
		}
		await ctx.db.insert('transactions', {
			accountId,
			date,
			amount,
			payeeId,
			cleared: cleared ? 'cleared' : 'uncleared'
		});
	};
}
