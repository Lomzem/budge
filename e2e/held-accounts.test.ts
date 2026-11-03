import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from './test';

import { parseCents } from '../src/lib/domain/money';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test.use({ fixture: 'bank-sync' });

async function openHeld(page: Page, label: RegExp) {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const held = page.getByRole('region', { name: 'New bank Accounts' }).getByRole('button', {
		name: label
	});
	await held.click();
	return held;
}

async function confirmStartingBalance(page: Page, label: string, amount: string) {
	const dialog = page.getByRole('dialog', { name: 'Starting balance' });
	await expect(dialog.getByRole('button', { name: 'Suggest again' })).toBeEnabled();
	await dialog.getByLabel(label).fill(amount);
	await dialog.getByRole('button', { name: 'Confirm' }).click();
	await expect(dialog).toBeHidden();
}

async function openAccount(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: new RegExp(`^${name}`) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

function balanceOf(page: Page) {
	return async () => parseCents((await page.getByTestId('account-balance').textContent()) ?? '');
}

test('a held bank Account brought into an existing Account adds its rows and resets its Starting Balance', async ({
	page
}) => {
	const held = await openHeld(
		page,
		/^Sample Savings Plus ending 4417, from Sample Credit Union: 2 rows waiting$/
	);
	const choose = page.getByRole('dialog', { name: 'Sample Savings Plus ending 4417' });
	await choose.getByRole('radio', { name: 'Into Savings' }).check();
	await choose.getByRole('button', { name: 'Bring in its rows' }).click();

	await confirmStartingBalance(page, 'Starting balance', '1,000.00');
	await expect(held).toBeHidden();

	await openAccount(page, 'Savings');
	await expect(page.getByRole('button', { name: /^SAMPLE INTEREST PAID/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^SAMPLE TRANSFER IN 5512/ })).toBeVisible();
	await expect(
		page.getByRole('row').filter({ has: page.getByRole('button', { name: /^Starting Balance/ }) })
	).toContainText('$1,000.00');
});

test('a held card becomes a new credit-card Account whose Starting Balance is the amount owed', async ({
	page
}) => {
	const held = await openHeld(page, /^Sample Rewards Card ending 9021, from Sample Credit Union/);
	const choose = page.getByRole('dialog', { name: 'Sample Rewards Card ending 9021' });
	await choose.getByRole('radio', { name: 'Into a new Account' }).check();
	await expect(choose.getByLabel('Name')).toHaveValue('Sample Rewards Card');
	await choose.getByLabel('Name').fill('Rewards Card');
	await choose.getByRole('radio', { name: 'Credit card' }).check();
	await choose.getByRole('button', { name: 'Bring in its rows' }).click();

	await confirmStartingBalance(page, 'Amount owed on the cutover date', '100.00');
	await expect(held).toBeHidden();

	await openAccount(page, 'Rewards Card');
	await expect(page.getByRole('button', { name: /^SAMPLE BISTRO 0817/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^SAMPLE BOOK NOOK 3306/ })).toBeVisible();
	await expect.poll(balanceOf(page)).toBe(-10_000 - 3_629 - 2_108);
});

test('an ignored held bank Account leaves the list and stays gone', async ({ page }) => {
	const held = await openHeld(page, /^Sample Holiday Club ending 1180, from Sample Credit Union/);
	const choose = page.getByRole('dialog', { name: 'Sample Holiday Club ending 1180' });
	await choose.getByRole('radio', { name: 'Nowhere: ignore this bank Account' }).check();
	await expect(
		choose.getByText("Its rows are dropped, and Budge won't ask about it again.")
	).toBeVisible();
	await choose.getByRole('button', { name: 'Ignore' }).click();
	await expect(choose).toBeHidden();
	await expect(held).toBeHidden();

	await page.reload();
	await expect(
		page.getByRole('region', { name: 'New bank Accounts' }).getByRole('button', {
			name: /^Sample Savings Plus ending 4417/
		})
	).toBeVisible();
	await expect(held).toBeHidden();
});
