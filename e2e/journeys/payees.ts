import { expect } from '@playwright/test';

import { openAccount, type Journey } from './journey';

export const payees = {
	'last-category': {
		title: "a Payee's last Category fills in, and picking another Category keeps it",
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
			const payee = dialog.getByLabel('Payee');
			const category = dialog.getByLabel('Category or Transfer');
			const picked = category.locator('option:checked');

			await step('open Add Transaction on Checking', async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				await page.getByRole('button', { name: 'Add Transaction' }).click();
			});

			await step("a known Payee fills in its last Category; a new one doesn't", async () => {
				const seedsRentPayee = 'Sample Landlord';
				await payee.fill(seedsRentPayee);
				await expect(picked).toHaveText('Rent');
				await payee.fill('Smoke Test Florist');
				await expect(picked).toHaveText('Uncategorized');
			});

			await step('a Category picked by hand survives retyping the Payee', async () => {
				await payee.fill('Sample Landlord');
				await expect(picked).toHaveText('Rent');
				await category.selectOption({ label: 'Groceries' });
				await payee.fill('Sample Landlor');
				await payee.fill('Sample Landlord');
				await expect(picked).toHaveText('Groceries');
			});
		}
	}
} satisfies Record<string, Journey>;
