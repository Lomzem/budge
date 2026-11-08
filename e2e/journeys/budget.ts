import { expect } from '@playwright/test';

import { cents, centsIn, openBudget, typed, type Journey } from './journey';

function monthName(monthsFromNow: number) {
	const today = new Date();
	return new Date(today.getFullYear(), today.getMonth() + monthsFromNow, 1).toLocaleString(
		'en-US',
		{ month: 'long', year: 'numeric' }
	);
}

export const budget = {
	assign: {
		title:
			'editing Assigned inline keeps focus, changes Ready to Assign, and reloads and other months keep it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const assigned = page.getByRole('textbox', { name: 'Assigned for Groceries', exact: true });
			const readyToAssign = () => centsIn(page.getByTestId('ready-to-assign'));

			const before = await step('open the Budget', async () => {
				await openBudget(page);
				await expect(page.getByText(monthName(0), { exact: true })).toBeVisible();
				return {
					assigned: cents(await assigned.inputValue()),
					readyToAssign: await readyToAssign()
				};
			});
			const tenDollarsMore = typed(before.assigned + 1_000);

			await step('assign $10 more to Groceries', async () => {
				await assigned.fill(tenDollarsMore);
				await assigned.press('Enter');
				await expect(assigned).toBeFocused();
				await expect(assigned).toHaveValue(tenDollarsMore);
				await expect.poll(readyToAssign).toBe(before.readyToAssign - 1_000);
			});

			await step('a reload keeps Assigned and Ready to Assign', async () => {
				await page.reload();
				await expect(assigned).toHaveValue(tenDollarsMore);
				await expect.poll(readyToAssign).toBe(before.readyToAssign - 1_000);
			});

			await step('Ready to Assign is the same next month', async () => {
				await page.getByRole('button', { name: 'Next month', exact: true }).click();
				await expect(page.getByText(monthName(1), { exact: true })).toBeVisible();
				await expect.poll(readyToAssign).toBe(before.readyToAssign - 1_000);
			});

			await step('back in this month, Groceries keeps its Assigned', async () => {
				await page.getByRole('button', { name: 'Previous month', exact: true }).click();
				await expect(page.getByText(monthName(0), { exact: true })).toBeVisible();
				await expect(assigned).toHaveValue(tenDollarsMore);
			});
		}
	},
	'needs-you': {
		title:
			'each Needs you item leads to what needs the owner: a filtered register or the overspent Category',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const needsYou = page.getByRole('region', { name: 'Needs you', exact: true });
			const rows = page.getByRole('table').getByRole('button', { name: /edit Transaction on/ });
			const chosen = (label: string) =>
				page
					.getByRole('search', { name: 'Search and filter Transactions' })
					.getByLabel(label, { exact: true })
					.locator('option:checked');

			await step('the first item is painted on screen, not only present in the page', async () => {
				await openBudget(page);
				const first = needsYou.getByRole('listitem').first();
				await expect(first).toBeVisible();
				const clip = await first.boundingBox();
				if (clip === null) throw new Error('The first Needs you item has no box.');
				const painted = await page.screenshot({ clip });
				await first.evaluate((item) => {
					item.style.visibility = 'hidden';
				});
				const blank = await page.screenshot({ clip });
				await first.evaluate((item) => {
					item.style.visibility = '';
				});
				expect(painted.equals(blank)).toBe(false);
			});

			for (const [link, filter, option, count] of [
				[/^6 Transactions need a Category$/, 'Category', 'Uncategorized', 6],
				[/^3 Unapproved$/, 'Status', 'Unapproved', 3]
			] as const) {
				await step(`${option} opens the register already narrowed to ${option}`, async () => {
					await openBudget(page);
					await needsYou.getByRole('link', { name: link }).click();
					await expect(
						page.getByRole('heading', { level: 1, name: 'Accounts', exact: true })
					).toBeVisible();
					await expect(chosen(filter)).toHaveText(option);
					await expect(rows).toHaveCount(count);
				});
			}

			await step('the overspent item opens the first overspent Category', async () => {
				await openBudget(page);
				await needsYou.getByRole('button', { name: /^\d+ Categories? overspent$/ }).click();
				const opened = page.getByRole('table').getByRole('button', { expanded: true });
				await expect(opened).toHaveCount(1);
				const name = (await opened.textContent())?.trim() ?? '';
				await expect(page.getByRole('region', { name, exact: true })).toContainText('Overspent by');
			});
		}
	}
} satisfies Record<string, Journey>;
