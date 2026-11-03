import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('editing a starting balance offers only the edits it allows, and saving it still works', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: /^Checking/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Checking' })).toBeVisible();

	await page.getByRole('button', { name: /^Starting Balance/ }).click();
	const dialog = page.getByRole('dialog', { name: 'Edit Transaction' });

	await expect(dialog.getByLabel('Account')).toBeDisabled();
	await expect(dialog.getByLabel('Payee')).toBeDisabled();
	await expect(dialog.getByLabel('Payee')).toHaveValue('Starting Balance');
	const category = dialog.getByLabel('Category', { exact: true });
	await expect(category.getByRole('option', { name: 'Groceries' })).toHaveCount(1);
	await expect(category.getByRole('option', { name: 'Split across Categories' })).toHaveCount(0);
	await expect(category.getByRole('option', { name: /^Transfer:/ })).toHaveCount(0);

	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('button', { name: /^Starting Balance/ })).toBeVisible();
});
