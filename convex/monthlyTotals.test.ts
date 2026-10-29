import { expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

/** A small seeded generator, so a failing sequence can be replayed. */
function random(seed: number) {
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

test.each([1, 2, 3, 4, 5])(
	'the rebuilt monthly totals equal the kept ones after any writes (sequence %i)',
	async (seed) => {
		const { t, owner } = newBackend();
		const rand = random(seed);
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
		const accounts: Id<'accounts'>[] = [];
		for (const name of ['Checking', 'Savings', 'Card']) {
			accounts.push(
				await owner.mutation(api.accounts.create, {
					name,
					kind: name === 'Card' ? 'creditCard' : 'cash',
					startingBalance: rand.int(200_000) - 50_000
				})
			);
		}
		const groupId = await owner.mutation(api.categories.createGroup, { name: 'Everyday' });
		const categories = [
			undefined,
			(await owner.query(api.categories.list, {})).readyToAssignId ?? undefined,
			await owner.mutation(api.categories.create, { groupId, name: 'Groceries' }),
			await owner.mutation(api.categories.create, { groupId, name: 'Transit' })
		];
		const live: Id<'transactions'>[] = [];
		const entry = () => {
			const categoryId = rand.pick(categories);
			return {
				accountId: rand.pick(accounts),
				date: rand.pick(dates),
				// Small amounts, so edits often bring a total back to zero.
				amount: rand.pick([-500, 500, -1_250, 1_250, -99, 0]),
				payee: rand.pick(payees),
				...(categoryId === undefined ? {} : { categoryId }),
				memo: ''
			};
		};

		for (let step = 0; step < 80; step++) {
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
	}
);
