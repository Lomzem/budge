import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

import { localToday } from '../src/lib/domain/dates';

// Runs on the local backend after CI's `seed:run`, so Savings exists and today is past the cutover.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('an imported row arrives Unapproved and Approve clears it', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const sidebar = page.getByRole('navigation', { name: 'Budget and Accounts' });
	await expect(sidebar.getByRole('link', { name: /^All Accounts \d+ Unapproved$/ })).toBeVisible();
	await sidebar.getByRole('link', { name: /^Savings/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Savings' })).toBeVisible();

	// Invented Bank Text and amount, in Capital One's checking and savings layout.
	const [year, month, day] = localToday().split('-');
	const csv = [
		'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
		`0000,SAMPLE E2E BOOKSHOP,${month ?? ''}/${day ?? ''}/${year ?? ''},Debit,23.45,100.00`
	].join('\n');

	await page.getByRole('button', { name: 'Import file' }).click();
	const dialog = page.getByRole('dialog', { name: 'Import a bank file' });
	await expect(dialog.getByLabel('Account')).toHaveValue(/.+/);
	await dialog.getByLabel('File').setInputFiles({
		name: 'savings.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv)
	});
	await expect(dialog.getByRole('status')).toHaveText(/^1 new Transaction, 0 Matches/);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();

	const approve = page.getByRole('button', { name: /^Approve SAMPLE E2E BOOKSHOP/ });
	await expect(approve).toBeVisible();
	await approve.click();
	await expect(approve).toBeHidden();
	await expect(page.getByRole('button', { name: /^SAMPLE E2E BOOKSHOP/ })).toBeVisible();
});
