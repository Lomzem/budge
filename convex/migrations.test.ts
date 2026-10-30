import { describe, expect, test } from 'vitest';

import { api, internal } from './_generated/api';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

async function budgetWithCard() {
	const backend = newBackend();
	const { owner } = backend;
	await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
	await owner.mutation(api.accounts.create, {
		name: 'Checking',
		kind: 'cash',
		startingBalance: 300_000
	});
	const card = await owner.mutation(api.accounts.create, {
		name: 'Discover',
		kind: 'creditCard',
		startingBalance: -20_000
	});
	await owner.mutation(api.transactions.create, {
		accountId: card,
		date: '2026-08-05',
		amount: -4_500,
		payee: 'Sample Grocer',
		memo: ''
	});
	const view = async () => {
		const month = await owner.query(api.budget.month, { month: '2026-08', today: '2026-08-31' });
		return {
			readyToAssign: month.readyToAssign,
			groups: month.groups.map((group) => ({
				name: group.name,
				kind: group.kind,
				categories: group.categories.map(({ name, available, payment }) => ({
					name,
					available,
					payment
				}))
			}))
		};
	};
	return { ...backend, card, view };
}

describe('backfilling Payment Categories', () => {
	test('gives a card made before Credit Card Accounts what a new card gets', async () => {
		const current = await budgetWithCard();
		const legacy = await budgetWithCard();
		// Before Credit Card Accounts, a card had no Payment Category, and its starting debt sat
		// Uncategorized.
		await legacy.t.run(async (ctx) => {
			for await (const category of ctx.db.query('categories')) {
				if (category.kind === 'creditCardPayment') await ctx.db.delete('categories', category._id);
			}
			for await (const group of ctx.db.query('categoryGroups')) {
				if (group.kind === 'creditCardPayments') await ctx.db.delete('categoryGroups', group._id);
			}
			for await (const transaction of ctx.db.query('transactions')) {
				if (transaction.accountId === legacy.card && transaction.date === '2026-08-01') {
					await ctx.db.patch('transactions', transaction._id, { categoryId: undefined });
				}
			}
		});
		await legacy.t.mutation(internal.monthlyTotals.rebuild, {});
		expect(await legacy.view()).not.toEqual(await current.view());

		expect(await legacy.t.mutation(internal.migrations.backfillPaymentCategories, {})).toBe(1);

		expect(await legacy.view()).toEqual(await current.view());
		expect(await legacy.t.mutation(internal.migrations.backfillPaymentCategories, {})).toBe(0);
		expect(await current.t.mutation(internal.migrations.backfillPaymentCategories, {})).toBe(0);
	});
});
