import { expect } from '@playwright/test';

import { openBudget, type Journey } from './journey';

export const shell = {
	navigate: {
		title: 'the owner lands on the Budget, and the sidebar or the phone View menu leads back to it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const sidebar = page.getByRole('navigation', { name: 'Budget and Accounts' });
			const budgetHeading = page.getByRole('heading', { level: 1, name: 'Budget', exact: true });

			await step('sign-in lands on the Budget, beside the sidebar', async () => {
				await openBudget(page);
				await expect(sidebar).toBeVisible();
			});

			await step('the sidebar leads from All Accounts back to the Budget', async () => {
				await page.goto('/accounts');
				await expect(page.getByRole('heading', { level: 1, name: 'All Accounts' })).toBeVisible();
				await sidebar.getByRole('link', { name: 'Budget', exact: true }).click();
				await expect(budgetHeading).toBeVisible();
			});

			await step('on a 320 px phone the View menu replaces the sidebar', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await expect(sidebar).toBeHidden();
				await expect(page.getByRole('button', { name: 'View Budget' })).toBeVisible();
			});

			await step(
				'the View menu leads from All Accounts back to the Budget, with no sideways scroll',
				async () => {
					await page.goto('/accounts');
					await page.getByRole('button', { name: 'View All Accounts', exact: true }).click();
					await page.getByRole('menuitem', { name: 'Budget', exact: true }).click();
					await expect(budgetHeading).toBeVisible();
					expect(
						await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
					).toBe(true);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
