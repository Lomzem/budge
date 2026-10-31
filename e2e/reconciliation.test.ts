import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

import { formatCents, parseCents } from '../src/lib/domain/money';

// Runs on the local backend after CI's `seed:run`, so the Card exists with Cleared Transactions.
// Reconciling can't be undone, so this reconciles the Card, which no later test edits.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('reconciling the Card from the keyboard records the difference and locks it', async ({
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

	// Reconcile follows the Account's actions in tab order.
	await page.getByRole('button', { name: 'Card actions' }).focus();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Reconcile' })).toBeFocused();
	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog');
	const clearedText = dialog.getByTestId('cleared-balance');
	await expect(clearedText).toHaveText(/\$/);
	const cleared = parseCents((await clearedText.textContent())?.trim() ?? '');
	if (cleared === undefined) throw new Error('The cleared balance is not an amount.');

	// The bank says the card owes $1.00 more than Budge has cleared.
	await expect(dialog.getByLabel('Amount owed, per the bank')).toBeFocused();
	await page.keyboard.type(formatCents(-cleared + 100).replace('$', ''));
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

	// Opening it shows the lock; its amount can't be edited until it's unlocked.
	await adjustment.getByRole('button', { name: /^Reconciliation Adjustment/ }).click();
	await expect(dialog.getByLabel('Amount')).toBeDisabled();
	await expect(dialog.getByRole('button', { name: 'Delete' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Unlock' }).click();
	await expect(dialog.getByLabel('Amount')).toBeEnabled();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(adjustment.getByRole('checkbox', { name: /^Cleared/ })).toBeChecked();
});
