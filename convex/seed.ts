import { v } from 'convex/values';

import { localIsoDate, monthOf } from '../src/lib/domain/dates';
import type { Id } from './_generated/dataModel';
import { env, internalMutation, type MutationCtx } from './_generated/server';
import { createPaymentCategory, ensureReadyToAssign } from './lib/categories';
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
	warehouse: 'Sample Warehouse Club',
	interest: 'Savings Interest'
} as const;

// Twelve Categories in three groups, each with what the seed Assigns to it every month.
const GROUPS = [
	{
		name: 'Bills',
		categories: [
			['Rent', 1_450_00],
			['Utilities', 130_00],
			['Phone', 45_00],
			['Internet', 60_00]
		]
	},
	{
		name: 'Everyday',
		categories: [
			['Groceries', 380_00],
			['Dining Out', 90_00],
			['Coffee', 40_00],
			['Transit', 100_00]
		]
	},
	{
		name: 'Savings Goals',
		categories: [
			['Emergency Fund', 500_00],
			['Vacation', 150_00],
			['Gifts', 50_00],
			['Car Repairs', 75_00]
		]
	}
] as const;

type CategoryName = (typeof GROUPS)[number]['categories'][number][0];

/**
 * Writes a small synthetic budget on an empty backend: three Accounts, twelve Categories in three
 * groups with Assigned amounts each month, and about three months of made-up Transactions, from
 * the first of the month two months back through today, with one Transfer, one card payment, and
 * the newest few imported and Unapproved. Ends by rebuilding the monthly totals, so every seeded
 * deployment exercises the rebuild.
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
		const readyToAssign = await ensureReadyToAssign(ctx);
		const category = new Map<CategoryName, Id<'categories'>>();
		const months = [0, 1, 2].map((ago) =>
			monthOf(localIsoDate(new Date(now.getFullYear(), now.getMonth() - ago, 1)))
		);
		for (const [groupPosition, group] of GROUPS.entries()) {
			const groupId = await ctx.db.insert('categoryGroups', {
				name: group.name,
				position: groupPosition,
				kind: 'normal'
			});
			for (const [position, [name, monthly]] of group.categories.entries()) {
				const categoryId = await ctx.db.insert('categories', {
					groupId,
					name,
					position,
					kind: 'normal'
				});
				category.set(name, categoryId);
				for (const month of months) {
					await ctx.db.insert('assignments', { month, categoryId, amount: monthly });
				}
			}
		}
		const to = (name: CategoryName) => category.get(name);

		const checking = await ctx.db.insert('accounts', {
			name: 'Checking',
			kind: 'cash',
			position: 0
		});
		const savings = await ctx.db.insert('accounts', { name: 'Savings', kind: 'cash', position: 1 });
		const card = await ctx.db.insert('accounts', { name: 'Card', kind: 'creditCard', position: 2 });
		const cardPayment = await createPaymentCategory(ctx, { _id: card, name: 'Card' });

		// Amounts are cents, written with a separator before the cents: 2_418_37 is $2,418.37.
		const write = writer(ctx);
		await write(checking, cutoverDate, 2_418_37, 'Starting Balance', true, readyToAssign);
		await write(savings, cutoverDate, 8_150_00, 'Starting Balance', true, readyToAssign);
		// A card's starting debt sits in its Payment Category, so it touches no Category.
		await write(card, cutoverDate, -612_48, 'Starting Balance', true, cardPayment);

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
			// The newest few stay Uncategorized, waiting for review.
			const categorizeIfCleared = <T>(value: T) => (cleared ? value : undefined);
			if (dayOfMonth === 1) {
				await write(checking, date, -1_450_00, PAYEES.rent, cleared, to('Rent'));
			}
			if (dayOfMonth === 1 || dayOfMonth === 15) {
				await write(checking, date, 2_310_42, PAYEES.paycheck, cleared, readyToAssign);
			}
			if (dayOfMonth === 20) {
				const amount = -(96_00 + next(40_00));
				await write(checking, date, amount, PAYEES.utilities, cleared, to('Utilities'));
			}
			if (dayOfMonth === 28) {
				await write(savings, date, 6_12, PAYEES.interest, cleared, readyToAssign);
			}
			if (day.getDay() === 6) {
				const payee = PAYEES.groceries[next(2)] ?? '';
				await write(card, date, -(48_00 + next(70_00)), payee, cleared, to('Groceries'));
			}
			if (day.getDay() === 1) {
				await write(checking, date, -25_00, PAYEES.transit, cleared, to('Transit'));
			}
			if (next(3) === 0) {
				const amount = -(3_75 + next(3_00));
				await write(card, date, amount, PAYEES.coffee, cleared, categorizeIfCleared(to('Coffee')));
			}
			if (next(6) === 0) {
				const payee = PAYEES.dining[next(2)] ?? '';
				await write(
					card,
					date,
					-(14_00 + next(30_00)),
					payee,
					cleared,
					categorizeIfCleared(to('Dining Out'))
				);
			}
		}

		// Bank Rows from a card statement file, waiting for review: two new Transactions named by
		// their Bank Text, and one that Matched a coffee entered by hand.
		const daysAgo = (days: number) =>
			localIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
		const bankRows: [string, number, string, boolean][] = [
			[daysAgo(1), -12_40, 'SAMPLE BOOKSHOP 0193', false],
			[daysAgo(2), -31_75, 'SAMPLE HARDWARE 2208', false],
			[daysAgo(3), -4_50, 'SAMPLE COFFEE SHOP 0042', true]
		];
		for (const [date, amount, bankText, matched] of bankRows) {
			const payee = matched ? PAYEES.coffee : bankText;
			const transactionId = await write(card, date, amount, payee, true, undefined, false);
			await ctx.db.insert('imports', {
				source: 'csv',
				accountId: card,
				date,
				amount,
				bankText,
				transactionId,
				matched,
				state: 'linked'
			});
		}

		// One Transfer: savings set aside the day after the first mid-month paycheck. And one card
		// payment from Checking, early the next month.
		const transfer = async (
			from: Id<'accounts'>,
			into: Id<'accounts'>,
			date: string,
			amount: number
		) => {
			const intoSide = await ctx.db.insert('transactions', {
				accountId: into,
				date,
				amount,
				cleared: 'cleared',
				approved: true
			});
			const fromSide = await ctx.db.insert('transactions', {
				accountId: from,
				date,
				amount: -amount,
				cleared: 'cleared',
				approved: true,
				transferTransactionId: intoSide
			});
			await ctx.db.patch('transactions', intoSide, { transferTransactionId: fromSide });
		};
		const dayOf = (monthsLater: number, day: number) =>
			localIsoDate(new Date(cutover.getFullYear(), cutover.getMonth() + monthsLater, day));
		await transfer(checking, savings, dayOf(0, 16), 500_00);
		await transfer(checking, card, dayOf(1, 3), 400_00);

		// One split card purchase: a warehouse trip that is part groceries and part a gift.
		const splitDate = dayOf(1, 10);
		const warehouse = await ctx.db.insert('transactions', {
			accountId: card,
			date: splitDate,
			amount: -86_40,
			payeeId: await ctx.db.insert('payees', { name: PAYEES.warehouse }),
			split: true,
			cleared: 'cleared',
			approved: true
		});
		const lines: [CategoryName, number, string][] = [
			['Groceries', -54_15, 'Pantry restock'],
			['Gifts', -32_25, 'Birthday present']
		];
		for (const [name, amount, memo] of lines) {
			const categoryId = to(name);
			if (categoryId === undefined) continue;
			await ctx.db.insert('transactionSplits', {
				transactionId: warehouse,
				categoryId,
				amount,
				memo,
				date: splitDate
			});
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
		cleared: boolean,
		categoryId?: Id<'categories'>,
		approved = true
	) => {
		let payeeId = payees.get(payee);
		if (payeeId === undefined) {
			payeeId = await ctx.db.insert('payees', { name: payee });
			payees.set(payee, payeeId);
		}
		return await ctx.db.insert('transactions', {
			accountId,
			date,
			amount,
			payeeId,
			...(categoryId === undefined ? {} : { categoryId }),
			cleared: cleared ? 'cleared' : 'uncleared',
			approved
		});
	};
}
