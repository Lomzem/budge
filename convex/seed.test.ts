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

		// One Transfer, Checking to Savings, with both sides in the list.
		const transfers = page.filter((row) => row.transfer !== null);
		expect(
			transfers.map((row) => [row.accountName, row.transfer?.accountName, row.amount]).sort()
		).toEqual([
			['Checking', 'Savings', -500_00],
			['Savings', 'Checking', 500_00]
		]);

		const { groups } = await owner.query(api.categories.list, {});
		expect(groups.map((group) => group.categories.length)).toEqual([4, 4, 4]);
		const budget = await owner.query(api.budget.month, { month: '2026-10', today: '2026-10-27' });
		expect(budget.groups.flatMap((group) => group.categories).every((c) => c.assigned > 0)).toBe(
			true
		);
		expect(budget.uncategorizedCount).toBeGreaterThan(0);
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
