import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

import { localToday } from '../src/lib/domain/dates';

// Runs on the local backend after CI's `seed:run`, so Checking and Savings exist and today is past
// the cutover. Pass or fail, it deletes the Transactions it made.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;
const memo = 'Smoke test linked Transfer';

async function openAccount(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: new RegExp(`^${name}`) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Imports one invented row, in Capital One's checking and savings layout, into the open Account. */
async function importRow(page: Page, bankText: string, type: 'Debit' | 'Credit') {
	const [year, month, day] = localToday().split('-');
	const csv = [
		'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
		`0000,${bankText},${month ?? ''}/${day ?? ''}/${year ?? ''},${type},31.17,100.00`
	].join('\n');
	await page.getByRole('button', { name: 'Import file' }).click();
	const dialog = page.getByRole('dialog', { name: 'Import a bank file' });
	await expect(dialog.getByLabel('Account')).toHaveValue(/.+/);
	await dialog.getByLabel('File').setInputFiles({
		name: 'bank.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv)
	});
	await expect(dialog.getByRole('status')).toHaveText(/^1 new Transaction/);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog).toBeHidden();
}

test('a Transfer from an import links the other import instead of a duplicate', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const dialog = page.getByRole('dialog');
	const linked = page.getByRole('row').filter({ hasText: memo });
	const leftovers = page.getByRole('row').filter({ hasText: /SAMPLE E2E XFER (IN|OUT)/ });

	try {
		await openAccount(page, 'Savings');
		await importRow(page, 'SAMPLE E2E XFER IN', 'Credit');
		await openAccount(page, 'Checking');
		await importRow(page, 'SAMPLE E2E XFER OUT', 'Debit');

		await page.getByRole('button', { name: /^SAMPLE E2E XFER OUT/ }).click();
		await dialog.getByLabel('Category or Transfer').selectOption({ label: 'Transfer: Savings' });
		await expect(
			dialog.getByRole('radio', { name: /^Link the import SAMPLE E2E XFER IN/ })
		).toBeChecked();
		await dialog.getByLabel('Memo').fill(memo);
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		await expect(linked.getByText('To Savings').filter({ visible: true })).toBeVisible();
		await openAccount(page, 'Savings');
		// The Savings import became the other side: one row, and no Uncategorized duplicate left.
		await expect(linked).toHaveCount(1);
		await expect(linked.getByText('From Checking').filter({ visible: true })).toBeVisible();
		await expect(leftovers).toHaveCount(0);
	} finally {
		for (const account of ['Savings', 'Checking']) {
			await openAccount(page, account);
			for (const rows of [linked, leftovers]) {
				while ((await rows.count()) > 0) {
					await rows.first().getByRole('button').first().click();
					await dialog.getByRole('button', { name: 'Delete' }).click();
					await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
					await expect(page.getByRole('alertdialog')).toBeHidden();
				}
			}
		}
	}
});
