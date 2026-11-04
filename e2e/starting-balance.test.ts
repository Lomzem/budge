import { clerk } from '@clerk/testing/playwright';
import { holdResponseTo } from './heldResponse';
import { expect, test, type Page } from './test';

import { formatCents, parseCents } from '../src/lib/domain/money';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

async function openAccount(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: new RegExp(`^${name}`) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function openStartingBalance(page: Page, name: string) {
	await page.getByRole('button', { name: `${name} actions` }).click();
	await page.getByRole('menuitem', { name: 'Starting balance' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: `Starting balance for ${name}` })).toBeVisible();
	return dialog;
}

function centsIn(text: string | null) {
	const cents = parseCents((text ?? '').replace(/^Now /, '').replace('−', '-'));
	if (cents === undefined) throw new Error(`${String(text)} is not an amount.`);
	return cents;
}

test("a starting balance saved from a dismissed dialog lands, and leaves the next Account's dialog alone", async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 1280, height: 800 });
	const network = await holdResponseTo(page, 'accounts:setStartingBalance');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	await openAccount(page, 'Checking');
	const balanceBefore = centsIn(await page.getByTestId('account-balance').textContent());
	const checking = await openStartingBalance(page, 'Checking');
	const startBefore = centsIn(await checking.getByTestId('current-starting-balance').textContent());
	const startAfter = startBefore + 10_000;
	await checking.getByLabel('Starting balance').fill(formatCents(startAfter).replace('$', ''));
	await checking.getByRole('button', { name: 'Confirm' }).click();
	await network.held;
	await page.keyboard.press('Escape');
	await expect(checking).toBeHidden();

	await openAccount(page, 'Savings');
	const savings = await openStartingBalance(page, 'Savings');
	const savingsEntry = '9,999.99';
	await savings.getByLabel('Starting balance').fill(savingsEntry);

	network.release();
	await expect(
		page
			.getByRole('navigation', { name: 'Budget and Accounts' })
			.getByRole('link', { name: /^Checking/ })
	).toContainText(formatCents(balanceBefore - startBefore + startAfter));

	await expect(
		savings.getByRole('heading', { name: 'Starting balance for Savings' })
	).toBeVisible();
	await expect(savings.getByLabel('Starting balance')).toHaveValue(savingsEntry);
	await expect(savings.getByRole('button', { name: 'Confirm' })).toBeEnabled();
	await savings.getByRole('button', { name: 'Cancel' }).click();
	await expect(savings).toBeHidden();

	await openAccount(page, 'Checking');
	const reopened = await openStartingBalance(page, 'Checking');
	await expect(reopened.getByTestId('current-starting-balance')).toHaveText(
		`Now ${formatCents(startAfter)}`
	);
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('account-balance')).toHaveText(
		formatCents(balanceBefore - startBefore + startAfter)
	);
});

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
