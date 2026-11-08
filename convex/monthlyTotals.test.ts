import { expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { startBudget, useOwnerEnv } from './test.helper';

useOwnerEnv();

function replayableSeededRandom(seed: number) {
	let state = seed;
	const next = () => {
		state = (Math.imul(state, 1_103_515_245) + 12_345) & 0x7fffffff;
		return state / 2_147_483_648;
	};
	return {
		int: (below: number) => Math.floor(next() * below),
		pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
	};
}

const dates = ['2026-08-01', '2026-08-19', '2026-09-03', '2026-09-30', '2026-10-15', '2027-01-02'];
const payees = ['Corner Grocer', 'Bus Pass Co', 'Paycheck Inc', ''];
const smallAmountsSoEditsOftenBringATotalBackToZero = [-500, 500, -1_250, 1_250, -99, 0];

test.each([1, 2, 3, 4, 5])(
	'the rebuilt monthly totals equal the kept ones after any writes (sequence %i)',
	async (seed) => {
		const rand = replayableSeededRandom(seed);
		const startingBalance = () => rand.int(200_000) - 50_000;
		const budget = await startBudget({
			accounts: {
				Checking: ['cash', startingBalance()],
				Savings: ['cash', startingBalance()],
				Card: ['creditCard', startingBalance()]
			},
			groups: { Everyday: ['Groceries', 'Transit'] }
		});
		const { t, owner } = budget;
		const accounts = Object.values(budget.accounts);
		const categories = [
			undefined,
			budget.readyToAssignId,
			budget.categories.Groceries,
			budget.categories.Transit
		];
		const lineCategories = categories.filter((c) => c !== undefined);
		let splitsEntered = 0;
		const live: Id<'transactions'>[] = [];
		const entry = () => {
			const accountId = rand.pick(accounts);
			const shared = {
				accountId,
				date: rand.pick(dates),
				amount: rand.pick(smallAmountsSoEditsOftenBringATotalBackToZero),
				memo: ''
			};
			const aboutOneInFourIsATransfer = rand.int(4) === 0;
			const [checking, savings, card] = accounts;
			if (aboutOneInFourIsATransfer && checking !== undefined && savings !== undefined) {
				if (accountId === checking) return { ...shared, payee: '', transferAccountId: savings };
				if (accountId === savings) return { ...shared, payee: '', transferAccountId: checking };
				if (accountId === card) {
					const cardPaymentFromChecking = {
						...shared,
						amount: Math.abs(shared.amount),
						payee: '',
						transferAccountId: checking
					};
					return cardPaymentFromChecking;
				}
			}
			const aboutOneInFiveOfTheRestIsSplitInTwo = rand.int(5) === 0;
			if (aboutOneInFiveOfTheRestIsSplitInTwo) {
				splitsEntered++;
				const first = rand.pick([-250, 0, 300]);
				return {
					...shared,
					payee: rand.pick(payees),
					splits: [
						{ categoryId: rand.pick(lineCategories), amount: first, memo: '' },
						{ categoryId: rand.pick(lineCategories), amount: shared.amount - first, memo: '' }
					]
				};
			}
			const categoryId = rand.pick(categories);
			return {
				...shared,
				payee: rand.pick(payees),
				...(categoryId === undefined ? {} : { categoryId })
			};
		};

		for (let step = 0; step < 100; step++) {
			const action = live.length === 0 ? 0 : rand.int(4);
			if (action <= 1) {
				live.push(await owner.mutation(api.transactions.create, entry()));
			} else if (action === 2) {
				await owner.mutation(api.transactions.update, {
					transactionId: rand.pick(live),
					...entry()
				});
			} else {
				const [transactionId] = live.splice(rand.int(live.length), 1);
				if (transactionId) await owner.mutation(api.transactions.remove, { transactionId });
			}
		}

		const readTotals = () =>
			t.run(async (ctx) =>
				(await ctx.db.query('monthlyTotals').collect())
					.map(({ month, accountId, bucket, amount, count }) => ({
						month,
						accountId,
						bucket,
						amount,
						count
					}))
					.sort((a, b) =>
						`${a.month}${a.accountId}${a.bucket}`.localeCompare(
							`${b.month}${b.accountId}${b.bucket}`
						)
					)
			);
		const kept = await readTotals();
		await t.mutation(internal.monthlyTotals.rebuild, {});
		expect(await readTotals()).toEqual(kept);
		expect(kept.every((row) => row.count > 0)).toBe(true);
		expect(kept.some((row) => row.bucket === 'transfer')).toBe(true);
		expect(splitsEntered).toBeGreaterThan(0);
	}
);
