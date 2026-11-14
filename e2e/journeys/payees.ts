import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

import {
	choose,
	expectClearOf,
	expectNothingPastTheRightEdge,
	openAccount,
	type Journey
} from './journey';

async function filledInFor(page: Page, payee: string) {
	await page.getByRole('button', { name: 'Add Transaction' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
	await dialog.getByLabel('Payee').fill(payee);
	const category = dialog.getByLabel('Category or Transfer');
	await expect(category).not.toHaveText('Looking up the last Category…');
	const filled = (await category.innerText()).trim();
	await page.keyboard.press('Escape');
	await page
		.getByRole('alertdialog', { name: 'Discard your changes?' })
		.getByRole('button', { name: 'Discard' })
		.click();
	await expect(dialog).toBeHidden();
	return filled;
}

export const payees = {
	'last-category': {
		title: "a Payee's last Category fills in, and picking another Category keeps it",
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
			const payee = dialog.getByLabel('Payee');
			const category = dialog.getByLabel('Category or Transfer');

			await step('open Add Transaction on Checking', async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				await page.getByRole('button', { name: 'Add Transaction' }).click();
			});

			await step("a known Payee fills in its last Category; a new one doesn't", async () => {
				const seedsRentPayee = 'Sample Landlord';
				await payee.fill(seedsRentPayee);
				await expect(category).toHaveText('Rent');
				await payee.fill('Smoke Test Florist');
				await expect(category).toHaveText('Uncategorized');
			});

			await step('a Category picked by hand survives retyping the Payee', async () => {
				await payee.fill('Sample Landlord');
				await expect(category).toHaveText('Rent');
				await choose(category, 'Groceries');
				await payee.fill('Sample Landlor');
				await payee.fill('Sample Landlord');
				await expect(category).toHaveText('Groceries');
			});
		}
	},
	remember: {
		title:
			"a Category picked from a row or the dialog changes the Payee's remembered one only when Remember is checked, by keyboard and on a 320 px phone",
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const listbox = page.getByRole('listbox');
			const search = page.getByRole('combobox', { name: 'Search Categories and Transfers' });
			const remember = (payee: string) =>
				page.getByRole('checkbox', { name: `Remember for ${payee}’s later imports` });
			const status = page.getByRole('status').filter({ hasText: /saved/ });
			let landlordRow = page.locator('[data-category]');

			await step('a one-off Category from a row leaves the remembered Rent alone', async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				const id = await page
					.getByRole('button', { name: /Category of Sample Landlord on / })
					.first()
					.getAttribute('data-category');
				landlordRow = page.getByRole('button').and(page.locator(`[data-category="${String(id)}"]`));
				await landlordRow.click();
				await expect(remember('Sample Landlord')).not.toBeChecked();
				await expect(remember('Sample Landlord')).toHaveAccessibleDescription(
					'Remembered now: Rent.'
				);
				await search.fill('groc');
				await page.keyboard.press('Enter');
				await expect(landlordRow).toHaveAccessibleName(/^Groceries, /);
				await expect(status).toHaveText('Groceries saved for Sample Landlord');
				expect(await filledInFor(page, 'Sample Landlord')).toBe('Rent');
			});

			await step(
				'by keyboard, Remember picks the same Groceries again and makes it the remembered one',
				async () => {
					await landlordRow.focus();
					await page.keyboard.press('ArrowDown');
					await expect(search).toBeFocused();
					await page.keyboard.press('Shift+Tab');
					await expect(remember('Sample Landlord')).toBeFocused();
					await page.keyboard.press('Space');
					await expect(remember('Sample Landlord')).toBeChecked();
					await expect(listbox.getByRole('option', { name: 'Transfer: Savings' })).toBeDisabled();
					await page.keyboard.press('Tab');
					await expect(search).toBeFocused();
					await page.keyboard.press('Enter');
					await expect(listbox).toBeHidden();
					await expect(status).toHaveText('Groceries saved and remembered for Sample Landlord');
					await landlordRow.click();
					await expect(remember('Sample Landlord')).toHaveAccessibleDescription(
						'Remembered now: Groceries.'
					);
					await expect(remember('Sample Landlord')).not.toBeChecked();
					await page.keyboard.press('Escape');
					expect(await filledInFor(page, 'Sample Landlord')).toBe('Groceries');
				}
			);

			await step(
				'in the dialog a new Payee’s first Category is saved once, and remembered only when asked',
				async () => {
					const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
					const florist = 'Sample Verification Florist';
					const add = async (checked: boolean) => {
						await page.getByRole('button', { name: 'Add Transaction' }).click();
						await dialog.getByLabel('Payee').fill(florist);
						await dialog.getByLabel('Amount').fill('12.50');
						await choose(dialog.getByLabel('Category or Transfer'), 'Groceries');
						await expect(remember(florist)).toHaveAccessibleDescription(
							'Nothing is remembered yet.'
						);
						await expect(remember(florist)).not.toBeChecked();
						if (checked) await remember(florist).check();
						await dialog.getByRole('button', { name: 'Save' }).click();
						await expect(dialog).toBeHidden();
					};
					await add(false);
					expect(await filledInFor(page, florist)).toBe('Uncategorized');
					await add(true);
					expect(await filledInFor(page, florist)).toBe('Groceries');
					await page.getByRole('button', { name: 'Add Transaction' }).click();
					await dialog.getByLabel('Payee').fill(florist);
					await expect(
						dialog.getByText(`Groceries is remembered for ${florist}’s later imports.`)
					).toBeVisible();
					await expect(remember(florist)).toHaveCount(0);
				}
			);

			await step(
				'on a 320 px phone Remember sits in the open Category above the tab bar',
				async () => {
					await page.setViewportSize({ width: 320, height: 640 });
					await page.goto('/accounts');
					const category = page
						.getByRole('button', { name: /Category of Sample Coffee Shop on / })
						.first();
					await category.scrollIntoViewIfNeeded();
					await category.click();
					const tabBar = page.getByRole('navigation', { name: 'Sections', exact: true });
					await expectClearOf(remember('Sample Coffee Shop'), tabBar);
					await expectClearOf(listbox, tabBar);
					await expectNothingPastTheRightEdge(page);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
