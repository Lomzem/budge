import { clerk } from '@clerk/testing/playwright';
import { expect, test } from './test';

import { formatCents, parseCents } from '../src/lib/domain/money';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('reconciles the seeded Card that later tests leave untouched, recording and locking the difference', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: /^Card/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Card' })).toBeVisible();
	await expect(page.getByTestId('last-reconciled')).toHaveText('Not reconciled yet');

	await test.step("Reconcile follows the Account's actions in tab order", async () => {
		await page.getByRole('button', { name: 'Card actions' }).focus();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Reconcile' })).toBeFocused();
	});
	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog');
	const clearedText = dialog.getByTestId('cleared-balance');
	await expect(clearedText).toHaveText(/\$/);
	const cardsClearedBalanceInTheInputsTerms = 'Cleared amount owed';
	await expect(dialog.getByText(cardsClearedBalanceInTheInputsTerms)).toBeVisible();
	const owed = parseCents((await clearedText.textContent())?.trim() ?? '');
	if (owed === undefined) throw new Error('The cleared amount owed is not an amount.');

	await expect(dialog.getByLabel('Amount owed, per the bank')).toBeFocused();
	const bankOwedOneDollarMoreThanCleared = owed + 100;
	await page.keyboard.type(formatCents(bankOwedOneDollarMoreThanCleared).replace('$', ''));
	await expect(dialog.getByRole('status')).toContainText('differs by −$1.00');
	await page.keyboard.press('Enter');
	await expect(dialog).toBeHidden();

	await expect(page.getByRole('status').filter({ hasText: 'Reconciled,' })).toHaveText(
		'Reconciled, with a Reconciliation Adjustment of −$1.00.'
	);
	await expect(page.getByTestId('last-reconciled')).toContainText(/^Reconciled \w+/);
	const adjustment = page.getByRole('row').filter({ hasText: 'Reconciliation Adjustment' });
	await expect(adjustment).toHaveCount(1);
	await expect(adjustment.getByText('Reconciled', { exact: true })).toBeAttached();
	await expect(adjustment.getByText('Ready to Assign').filter({ visible: true })).toBeVisible();

	await test.step("opening it shows the lock; its amount can't be edited until it's unlocked", async () => {
		await adjustment.getByRole('button', { name: /^Reconciliation Adjustment/ }).click();
		await expect(dialog.getByLabel('Amount')).toBeDisabled();
		await expect(dialog.getByRole('button', { name: 'Delete' })).toHaveCount(0);
		await dialog.getByRole('button', { name: 'Unlock' }).click();
		await expect(dialog.getByLabel('Amount')).toBeEnabled();
	});
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(adjustment.getByRole('checkbox', { name: /^Cleared/ })).toBeChecked();
});
