import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

import { parseCents } from '../src/lib/domain/money';

// Runs on the local backend after CI's `seed:run`, so Checking exists.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('adding a Transaction changes the Account balance', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: /^Checking/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Checking' })).toBeVisible();

	const balance = page.getByTestId('account-balance');
	const before = parseCents((await balance.textContent()) ?? '');
	if (before === undefined) throw new Error('The Checking balance is not an amount.');

	await page.getByRole('button', { name: 'Add Transaction' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
	await dialog.getByLabel('Payee').fill('Smoke Test Bakery');
	await dialog.getByLabel('Amount').fill('12.34');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	await expect(page.getByRole('button', { name: /^Smoke Test Bakery/ }).first()).toBeVisible();
	await expect
		.poll(async () => parseCents((await balance.textContent()) ?? ''))
		.toBe(before - 1234);

	// Columns drop as the list narrows, so nothing scrolls sideways at the narrowest width.
	await page.setViewportSize({ width: 320, height: 640 });
	await expect(page.getByRole('columnheader', { name: 'Memo' })).toBeHidden();
	const fits = await page.getByRole('table').evaluate((table) => {
		const box = table.parentElement;
		return box !== null && box.scrollWidth <= box.clientWidth;
	});
	expect(fits).toBe(true);
});
