import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import { newBackend, useOwnerEnv } from './test.helper';

useOwnerEnv();

beforeEach(() => {
	vi.useFakeTimers({ now: new Date('2026-10-27T12:00:00Z'), toFake: ['Date'] });
});

afterEach(() => {
	vi.useRealTimers();
});

describe('seed:run', () => {
	test('fills an empty backend with a small synthetic budget', async () => {
		const { t, owner } = newBackend();

		await t.mutation(internal.seed.run, {});

		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: '2026-08-01' });
		const accounts = await owner.query(api.accounts.list, {});
		expect(accounts.map(({ name, kind }) => ({ name, kind }))).toEqual([
			{ name: 'Checking', kind: 'cash' },
			{ name: 'Savings', kind: 'cash' },
			{ name: 'Card', kind: 'creditCard' }
		]);
		const { page } = await owner.query(api.transactions.list, {
			paginationOpts: { numItems: 500, cursor: null }
		});
		const months = new Set(page.map((row) => row.date.slice(0, 7)));
		expect([...months].sort()).toEqual(['2026-08', '2026-09', '2026-10']);
		expect(page.length).toBeGreaterThan(30);
		expect(page.every((row) => row.date <= '2026-10-27')).toBe(true);
		for (const account of accounts) {
			const sum = page
				.filter((row) => row.accountId === account._id)
				.reduce((total, row) => total + row.amount, 0);
			expect(account.balance, account.name).toBe(sum);
		}

		const sidesOfOneTransferAndOneCardPayment = page.filter((row) => row.transfer !== null);
		expect(
			sidesOfOneTransferAndOneCardPayment
				.map((row) => [row.accountName, row.transfer?.accountName, row.amount])
				.sort()
		).toEqual([
			['Card', 'Checking', 400_00],
			['Checking', 'Card', -400_00],
			['Checking', 'Savings', -500_00],
			['Savings', 'Checking', 500_00]
		]);

		const splitCardPurchases = page.filter((row) => row.splits !== null);
		expect(
			splitCardPurchases.map((row) => [row.accountName, row.categoryName, row.amount])
		).toEqual([['Card', null, -86_40]]);
		expect(splitCardPurchases[0]?.splits?.map((line) => [line.categoryName, line.amount])).toEqual([
			['Groceries', -54_15],
			['Gifts', -32_25]
		]);

		const { groups } = await owner.query(api.categories.list, {});
		expect(groups.map((group) => group.categories.length)).toEqual([4, 4, 4]);
		const rent = groups.flatMap((group) => group.categories).find((c) => c.name === 'Rent');
		const landlordsLastCategory = await owner.query(api.payees.lastCategory, {
			name: 'Sample Landlord'
		});
		expect(landlordsLastCategory).toBe(rent?._id);
		const budget = await owner.query(api.budget.month, { month: '2026-10', today: '2026-10-27' });
		const normal = budget.groups.filter((group) => group.kind === 'normal');
		expect(normal.flatMap((group) => group.categories).every((c) => c.assigned > 0)).toBe(true);
		expect(budget.uncategorizedCount).toBeGreaterThan(0);
		const paymentCategories = budget.groups.find((group) => group.kind === 'creditCardPayments');
		expect(paymentCategories?.categories.map((c) => c.name)).toEqual(['Card']);
		expect(paymentCategories?.categories[0]?.payment?.uncovered).toBeGreaterThan(0);
		expect(await owner.query(api.transactions.unapprovedCount, {})).toBe(3);
		expect(page.filter((row) => row.bankRows.length > 0)).toHaveLength(3);
		expect(await owner.query(api.bankConnections.list, { now: Date.now() })).toMatchObject([
			{
				name: 'Sample Bank (Sandbox)',
				status: 'ok',
				lastSyncedAt: Date.parse('2026-10-27T10:00:00Z'),
				lastError: null
			}
		]);
	});

	test('refuses once any Account exists', async () => {
		const { t, owner } = newBackend();
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-08-01' });
		await owner.mutation(api.accounts.create, { name: 'Wallet', kind: 'cash', startingBalance: 0 });

		await expect(t.mutation(internal.seed.run, {})).rejects.toThrow(/Account/);
		expect(await owner.query(api.accounts.list, {})).toHaveLength(1);
	});

	test('refuses once the cutover date is set', async () => {
		const { t, owner } = newBackend();
		await owner.mutation(api.settings.setCutoverDate, { cutoverDate: '2026-10-01' });

		await expect(t.mutation(internal.seed.run, {})).rejects.toThrow(/empty backend/);
		expect(await owner.query(api.settings.get, {})).toEqual({ cutoverDate: '2026-10-01' });
	});

	test('refuses on production', async () => {
		vi.stubEnv('BUDGE_PRODUCTION', 'true');
		const { t, owner } = newBackend();

		await expect(t.mutation(internal.seed.run, {})).rejects.toThrow(/production/);
		expect(await owner.query(api.accounts.list, {})).toEqual([]);
	});
});
