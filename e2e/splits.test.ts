import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

// Runs on the local backend after CI's `seed:run`, so the Card, Groceries, and Gifts exist. Pass
// or fail, it deletes the split it made.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;
const memo = 'Smoke test split';

test('a split shows "Split" in the list, and its lines can be added, edited, and removed', async ({
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

	const row = page.getByRole('row').filter({ hasText: memo });
	const dialog = page.getByRole('dialog');
	const remainder = dialog.getByText(/left to split|over the amount|Fully split/);

	try {
		await page.getByRole('button', { name: 'Add Transaction' }).click();
		await dialog.getByLabel('Payee').fill('Smoke Test Warehouse');
		// A minus sign typed in the amount doesn't carry into the lines; the Direction sets the sign.
		await dialog.getByLabel('Amount').fill('-50.00');
		await dialog.getByLabel('Memo', { exact: true }).fill(memo);
		await dialog
			.getByLabel('Category or Transfer')
			.selectOption({ label: 'Split across Categories' });

		// The first line starts with the whole amount; moving some to the second keeps the total.
		await expect(dialog.getByLabel('Line 1 amount')).toHaveValue('50.00');
		await dialog.getByLabel('Line 1 Category').selectOption({ label: 'Groceries' });
		await dialog.getByLabel('Line 1 amount').fill('30.00');
		await expect(remainder).toHaveText('$20.00 left to split');
		await dialog.getByLabel('Line 2 Category').selectOption({ label: 'Gifts' });
		await dialog.getByLabel('Line 2 amount').fill('12.00');
		await dialog.getByRole('button', { name: 'Add line' }).click();
		await dialog.getByLabel('Line 3 Category').selectOption({ label: 'Coffee' });
		await dialog.getByLabel('Line 3 amount').fill('9.00');
		await expect(remainder).toHaveText('$1.00 over the amount');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog.getByRole('alert')).toHaveText('The lines must add up to the amount.');
		await dialog.getByLabel('Line 3 amount').fill('8.00');
		await expect(remainder).toHaveText('Fully split');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();
		await expect(row.getByText('Split', { exact: true }).filter({ visible: true })).toBeVisible();

		// Editing shows the saved lines; removing one and giving its amount to another saves.
		await row.getByRole('button', { name: /^Smoke Test Warehouse/ }).click();
		await expect(dialog.getByLabel('Line 3 amount')).toHaveValue('8.00');
		await dialog.getByRole('button', { name: 'Remove line 3' }).click();
		await expect(remainder).toHaveText('$8.00 left to split');
		await dialog.getByLabel('Line 2 amount').fill('20.00');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();
		await row.getByRole('button', { name: /^Smoke Test Warehouse/ }).click();
		await expect(dialog.getByLabel('Line 2 amount')).toHaveValue('20.00');
		await expect(dialog.getByLabel('Line 3 amount')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	} finally {
		// Leaves no split behind if a step above failed.
		if (await dialog.isVisible()) await page.keyboard.press('Escape');
		while ((await row.count()) > 0) {
			await row
				.first()
				.getByRole('button', { name: /^Smoke Test Warehouse/ })
				.click();
			await dialog.getByRole('button', { name: 'Delete' }).click();
			await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
			await expect(page.getByRole('alertdialog')).toBeHidden();
		}
	}
});
