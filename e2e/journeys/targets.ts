import { expect } from '@playwright/test';

import { ordinal } from '../../src/lib/domain/dates';
import { cents, openBudget, typed, type Journey } from './journey';

export const targets = {
	monthly: {
		title: 'a Target shows its progress, "Assign $X" funds it, and it is listed as Upcoming',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const name = 'Emergency Fund';
			const assigned = async () =>
				cents(await page.getByRole('textbox', { name: `Assigned for ${name}` }).inputValue());
			const region = page.getByRole('region', { name });
			const dialog = page.getByRole('dialog');
			const bar = page.getByRole('progressbar', { name: `${name} Target` }).first();
			const upcoming = page.getByRole('region', { name: 'Upcoming' });
			const row = upcoming.getByRole('row').filter({ hasText: name });
			const nameButton = page.getByRole('button', { name, exact: true });

			const twentyFiveDollarsMoreThanAssigned = await step(
				'open the Emergency Fund inspector',
				async () => {
					await openBudget(page);
					const before = await assigned();
					await nameButton.click();
					return before + 2_500;
				}
			);

			await step(
				'a Target to set aside $25 more, due today, is $25.00 short and not funded',
				async () => {
					await region.getByRole('button', { name: 'Add Target' }).click();
					await dialog
						.getByLabel('Amount', { exact: true })
						.fill(typed(twentyFiveDollarsMoreThanAssigned));
					await dialog.getByLabel('Set aside the amount', { exact: true }).check();
					await dialog
						.getByLabel('Due day', { exact: true })
						.selectOption({ label: `The ${ordinal(new Date().getDate())}` });
					await dialog.getByRole('button', { name: 'Save' }).click();
					await expect(dialog).toBeHidden();
					await expect(bar).toHaveAttribute('aria-valuetext', '$25.00 more needed');
					await expect(region.getByText('$25.00 more needed')).toBeVisible();
					await expect(upcoming).toHaveCount(0);
					await nameButton.click();
					await expect(row).toContainText('No');
					await nameButton.click();
				}
			);

			await step('Assign $25.00 funds it', async () => {
				await region.getByRole('button', { name: 'Assign $25.00' }).click();
				await expect(region.getByText('Funded', { exact: true })).toBeVisible();
				await expect(bar).toHaveAttribute('aria-valuetext', 'Funded');
				await nameButton.click();
				await expect(row).toContainText('Yes');
				await expect.poll(assigned).toBe(twentyFiveDollarsMoreThanAssigned);
			});

			await step('on a phone the Upcoming list follows the table', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await expect(upcoming).toBeVisible();
			});
		}
	}
} satisfies Record<string, Journey>;
