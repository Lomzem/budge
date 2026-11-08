import { expect, type Page } from '@playwright/test';

import { addDays, formatMonth, localToday, monthOf } from '../../src/lib/domain/dates';
import { openBudget, type Journey } from './journey';

function cutoverRegion(page: Page) {
	return page.getByRole('region', { name: 'Cutover date', exact: true });
}

async function expectCutover(page: Page, date: string) {
	await expect(cutoverRegion(page).locator(`time[datetime="${date}"]`)).toBeVisible();
}

async function saveCutover(page: Page, date: string) {
	const region = cutoverRegion(page);
	await region.getByLabel('Cutover date').fill(date);
	await region.getByRole('button', { name: 'Save' }).click();
}

export const settings = {
	cutover: {
		title:
			'the first cutover date gates Add Account, survives reload and cancel, bounds the months, and refuses to pass a Transaction',
		fixture: 'empty-budget',
		run: async (page, { step }) => {
			const cutover = addDays(localToday(), -40);
			const dayEarlier = addDays(cutover, -1);
			const region = cutoverRegion(page);

			await step('before a date, there is no Cancel and Add Account points to Budget', async () => {
				await openBudget(page);
				await expect(region.getByLabel('Cutover date')).toBeVisible();
				await expect(region.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
				await page.getByRole('complementary').getByRole('button', { name: 'Add Account' }).click();
				const dialog = page.getByRole('dialog', { name: 'Add Account' });
				await expect(dialog).toContainText('Set the cutover date first');
				await expect(dialog.getByLabel('Name')).toHaveCount(0);
				await page.keyboard.press('Escape');
				await expect(dialog).toBeHidden();
			});

			await step('saving the first date keeps it on the Budget, then in Settings', async () => {
				await saveCutover(page, cutover);
				await expectCutover(page, cutover);
				await page.reload();
				await expect(region).toHaveCount(0);
				await page.goto('/settings');
				await expectCutover(page, cutover);
			});

			await step('a cancelled change keeps the date; a saved one moves it', async () => {
				await region.getByRole('button', { name: 'Change' }).click();
				await region.getByLabel('Cutover date').fill(dayEarlier);
				await region.getByRole('button', { name: 'Cancel' }).click();
				await expectCutover(page, cutover);
				await region.getByRole('button', { name: 'Change' }).click();
				await saveCutover(page, dayEarlier);
				await expectCutover(page, dayEarlier);
				await page.reload();
				await expectCutover(page, dayEarlier);
			});

			await step('Previous month stops at the cutover month', async () => {
				await openBudget(page);
				const previous = page.getByRole('button', { name: 'Previous month' });
				const cutoverMonth = page.getByText(formatMonth(monthOf(dayEarlier)), { exact: true });
				for (let back = 0; back < 3 && !(await cutoverMonth.isVisible()); back++) {
					await previous.click();
				}
				await expect(cutoverMonth).toBeVisible();
				await expect(previous).toBeDisabled();
			});

			await step('moving the date past a Starting Balance is refused', async () => {
				await page.getByRole('main').getByRole('button', { name: 'Add Account' }).click();
				const dialog = page.getByRole('dialog', { name: 'Add Account' });
				await dialog.getByLabel('Name').fill('Research Checking');
				await dialog.getByLabel('Cash, such as checking or savings').check();
				await dialog.getByLabel('Current balance').fill('100');
				await dialog.getByRole('button', { name: 'Add Account' }).click();
				await expect(
					page.getByRole('heading', { level: 1, name: 'Research Checking' })
				).toBeVisible();
				await page.goto('/settings');
				await region.getByRole('button', { name: 'Change' }).click();
				await saveCutover(page, cutover);
				await expect(region.getByRole('alert')).toHaveText('A Transaction is dated before that.');
				await page.reload();
				await expectCutover(page, dayEarlier);
			});
		}
	}
} satisfies Record<string, Journey>;
