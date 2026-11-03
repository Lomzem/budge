import { clerk } from '@clerk/testing/playwright';
import { expect, test } from './test';

import { localToday } from '../src/lib/domain/dates';

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

	const [year, month, day] = localToday().split('-');
	const inventedCapitalOneCheckingAndSavingsCsv = [
		'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
		`0000,SAMPLE E2E BOOKSHOP,${month ?? ''}/${day ?? ''}/${year ?? ''},Debit,23.45,100.00`
	].join('\n');

	await page.getByRole('button', { name: 'Import file' }).click();
	const dialog = page.getByRole('dialog', { name: 'Import a bank file' });
	await expect(dialog.getByLabel('Account')).toHaveValue(/.+/);
	await dialog.getByLabel('File').setInputFiles({
		name: 'savings.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(inventedCapitalOneCheckingAndSavingsCsv)
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
