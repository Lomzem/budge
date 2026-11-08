import { expect, type Page } from '@playwright/test';

import type { Journey } from './journey';

async function openAllAccounts(page: Page) {
	await page.goto('/accounts');
	await expect(page.getByRole('heading', { level: 1, name: 'All Accounts' })).toBeVisible();
}

async function listedPayees(page: Page) {
	return await page
		.getByRole('table')
		.getByRole('button', { name: /edit Transaction on/ })
		.evaluateAll((buttons) =>
			buttons.map((button) => button.firstElementChild?.textContent.trim() ?? '')
		);
}

export const search = {
	filters: {
		title: 'search finds Transactions by Bank Text and split memo, and filters narrow the list',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const searchbox = page.getByRole('searchbox', { name: 'Search' });

			await step(
				'search finds a Transaction by its Bank Text and a split by its line memo',
				async () => {
					await openAllAccounts(page);
					const numberOnlyInTheMatchedCoffeesBankText = '0042';
					await searchbox.fill(numberOnlyInTheMatchedCoffeesBankText);
					await expect.poll(() => listedPayees(page)).toEqual(['Sample Coffee Shop']);
					await searchbox.fill('birthday');
					await expect.poll(() => listedPayees(page)).toEqual(['Sample Warehouse Club']);
				}
			);

			await step('the Payee filter narrows the list', async () => {
				await searchbox.fill('');
				await page.getByLabel('Payee', { exact: true }).selectOption({ label: 'Sample Landlord' });
				await expect
					.poll(async () => new Set(await listedPayees(page)))
					.toEqual(new Set(['Sample Landlord']));
			});

			await step(
				'the split has no Category of its own; its Gifts line lists it under Gifts',
				async () => {
					await page.getByLabel('Payee', { exact: true }).selectOption({ label: 'Any Payee' });
					await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Gifts' });
					await expect.poll(() => listedPayees(page)).toContain('Sample Warehouse Club');
				}
			);

			await step('Clear search and filters resets them', async () => {
				await page.getByRole('button', { name: 'Clear search and filters' }).click();
				await expect(page.getByLabel('Category', { exact: true })).toHaveValue('');
			});
		}
	},
	phone: {
		title: 'the search and filters are labeled and fit a 320 px screen',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 320, height: 640 });

			await step('every filter is labeled and visible', async () => {
				await openAllAccounts(page);
				for (const label of ['Search', 'Account', 'Category', 'Payee', 'From', 'To']) {
					await expect(page.getByLabel(label, { exact: true })).toBeVisible();
				}
			});

			await step('search works with nothing scrolling sideways', async () => {
				await page.getByRole('searchbox', { name: 'Search' }).fill('0042');
				await expect.poll(() => listedPayees(page)).toEqual(['Sample Coffee Shop']);
				expect(
					await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
				).toBe(true);
			});
		}
	}
} satisfies Record<string, Journey>;
