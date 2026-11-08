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
		title: 'editing Assigned inline changes Ready to Assign, and reloads and other months keep it',
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
	}
} satisfies Record<string, Journey>;
