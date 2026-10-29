import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

import { parseCents } from '../src/lib/domain/money';

// Runs on the local backend after CI's `seed:run`, so Checking and Savings exist. Pass or fail,
// it deletes the Transfer it made.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;
const memo = 'Smoke test Transfer';

async function openAccount(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: new RegExp(`^${name}`) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
	const balance = page.getByTestId('account-balance');
	const amount = parseCents((await balance.textContent()) ?? '');
	if (amount === undefined) throw new Error(`The ${name} balance is not an amount.`);
	return { balance, amount };
}

test('a Transfer appears in both Accounts, and deleting one side deletes both', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const savingsBefore = (await openAccount(page, 'Savings')).amount;
	const checking = await openAccount(page, 'Checking');
	const row = page.getByRole('row').filter({ hasText: memo });
	const dialog = page.getByRole('dialog');

	try {
		await page.getByRole('button', { name: 'Add Transaction' }).click();
		await dialog.getByLabel('Category or Transfer').selectOption({ label: 'Transfer: Savings' });
		await expect(dialog.getByLabel('Payee')).toBeHidden();
		await dialog.getByLabel('Amount').fill('12.34');
		await dialog.getByLabel('Memo').fill(memo);
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		// The other Account shows in place of a Category.
		await expect(row.getByText('To Savings').filter({ visible: true })).toBeVisible();
		await expect
			.poll(async () => parseCents((await checking.balance.textContent()) ?? ''))
			.toBe(checking.amount - 1234);

		const savings = await openAccount(page, 'Savings');
		expect(savings.amount).toBe(savingsBefore + 1234);
		await expect(row.getByText('From Checking').filter({ visible: true })).toBeVisible();

		// Deleting from the Savings side takes both sides out.
		await row.getByRole('button', { name: /^Transfer/ }).click();
		await dialog.getByRole('button', { name: 'Delete' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
		await expect(row).toHaveCount(0);
		await expect
			.poll(async () => parseCents((await savings.balance.textContent()) ?? ''))
			.toBe(savingsBefore);
		await openAccount(page, 'Checking');
		await expect(row).toHaveCount(0);
	} finally {
		// Leaves no Transfer behind if a step above failed.
		while ((await row.count()) > 0) {
			await row
				.first()
				.getByRole('button', { name: /^Transfer/ })
				.click();
			await dialog.getByRole('button', { name: 'Delete' }).click();
			await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
			await expect(page.getByRole('alertdialog')).toBeHidden();
		}
	}
});
