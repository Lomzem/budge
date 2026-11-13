import { expect } from '@playwright/test';

import { expectNothingPastTheRightEdge, openBudget, type Journey } from './journey';

const SECTIONS = ['Budget', 'Accounts', 'Bank', 'Categories', 'Settings'] as const;

export const shell = {
	navigate: {
		title:
			'the owner lands on the Budget, and the sidebar or the phone tab bar reaches all five Sections',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const sidebar = page.getByRole('navigation', { name: 'Sections and Accounts' });
			const tabs = page.getByRole('navigation', { name: 'Sections', exact: true });

			await step('sign-in lands on the Budget, beside the sidebar', async () => {
				await openBudget(page);
				await expect(sidebar).toBeVisible();
				await expect(tabs).toBeHidden();
				await expect(sidebar.getByRole('link', { name: /^Budget/ })).toHaveAttribute(
					'aria-current',
					'page'
				);
			});

			await step('each sidebar Section opens its page and marks itself current', async () => {
				for (const name of SECTIONS) {
					const link = sidebar.getByRole('link', { name: new RegExp(`^${name}`) });
					await link.click();
					await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
					await expect(link).toHaveAttribute('aria-current', 'page');
				}
			});

			await step('a wheel over the Budget table or the sidebar scrolls the page', async () => {
				await page.setViewportSize({ width: 1280, height: 800 });
				await sidebar.getByRole('link', { name: /^Budget/ }).click();
				const table = page.getByRole('main').getByRole('table').first();
				for (const area of [table, sidebar]) {
					await expect(area).toBeVisible();
					await page.evaluate(() => {
						window.scrollTo(0, 0);
					});
					await area.hover({ position: { x: 40, y: 20 } });
					const before = await page.evaluate(() => window.scrollY);
					await page.mouse.wheel(0, 200);
					await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
				}
			});

			await step('on a 320 px phone the tab bar replaces the sidebar', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await expect(sidebar).toBeHidden();
				await expect(tabs).toBeVisible();
			});

			await step(
				'each tab opens its Section with no sideways scroll, and an Account keeps Accounts current',
				async () => {
					for (const name of SECTIONS) {
						const tab = tabs.getByRole('link', { name: new RegExp(`^${name}`) });
						await tab.click();
						await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
						await expect(tab).toHaveAttribute('aria-current', 'page');
						await expectNothingPastTheRightEdge(page);
					}
					await tabs.getByRole('link', { name: /^Accounts/ }).click();
					await page.getByText('Your Accounts').click();
					await page
						.getByRole('navigation', { name: 'Accounts' })
						.getByRole('link', { name: /^Checking/ })
						.click();
					await expect(
						page.getByRole('heading', { level: 1, name: 'Checking', exact: true })
					).toBeVisible();
					await expect(tabs.getByRole('link', { name: /^Accounts/ })).toHaveAttribute(
						'aria-current',
						'true'
					);
				}
			);
		}
	},
	'phone-pages': {
		title: 'on a 390 px phone every Section and an Account register load and scroll without moving',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			const pages = [
				['/', 'Budget'],
				['/accounts', 'Accounts'],
				['/bank', 'Bank'],
				['/categories', 'Categories'],
				['/settings', 'Settings']
			] as const;

			for (const [path, heading] of pages) {
				await step(`${heading} loads in place and scrolls to its end`, async () => {
					await page.goto(path);
					await expect(
						page.getByRole('heading', { level: 1, name: heading, exact: true })
					).toBeVisible();
					await page.waitForLoadState('networkidle');
					await page.mouse.wheel(0, 20_000);
					await page.waitForLoadState('networkidle');
				});
			}

			await step('the Checking register loads in place and scrolls to its end', async () => {
				await page.goto('/accounts');
				await page.getByText('Your Accounts').click();
				await page
					.getByRole('navigation', { name: 'Accounts' })
					.getByRole('link', { name: /^Checking/ })
					.click();
				await expect(
					page.getByRole('heading', { level: 1, name: 'Checking', exact: true })
				).toBeVisible();
				await page.waitForLoadState('networkidle');
				await page.mouse.wheel(0, 20_000);
				await page.waitForLoadState('networkidle');
			});
		}
	}
} satisfies Record<string, Journey>;
