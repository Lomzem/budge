import { clerk } from '@clerk/testing/playwright';
import { holdResponseTo } from './heldResponse';
import { expect, test } from './test';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test.use({ fixture: 'bank-sync' });

test('a Bank Connection that needs a reconnect says so, and a failed reconnect keeps the notice', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const notice = page.getByText('Sample Savings Bank needs you to reconnect', { exact: true });
	await expect(notice).toBeVisible();
	await expect(page.getByText('Sample Credit Union needs you to reconnect')).toHaveCount(0);

	await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText("Couldn't reach the bank; try again later.");
	await expect(notice).toBeVisible();

	const connections = page.getByRole('list', { name: 'Bank Connections' });
	await connections.getByRole('button', { name: /Sample Savings Bank: / }).click();
	const dialog = page.getByRole('dialog', { name: 'Sample Savings Bank' });
	await expect(dialog.getByText('Sample Savings Bank needs you to reconnect.')).toBeVisible();
	await expect(dialog.getByRole('alert')).toHaveText(
		/failed: The bank needs you to reconnect \(ITEM_LOGIN_REQUIRED\)\.$/
	);
});

test('a Bank Connection whose consent is ending offers to renew it', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const connections = page.getByRole('list', { name: 'Bank Connections' });
	const consent = connections.getByText(/^Consent ends .+, renew$/);
	await expect(consent).toBeVisible();
	await consent.getByRole('button', { name: 'renew' }).click();

	const dialog = page.getByRole('dialog', { name: 'Sample Credit Union' });
	await expect(dialog.getByRole('status')).toHaveText("Couldn't reach the bank; try again later.");
	await expect(dialog.getByText('Your consent at the bank ends')).toContainText(
		'Reconnect to renew it.'
	);
});

test('a renew result that arrives while another Bank Connection is open waits for its own Bank Connection', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	const reconnect = await holdResponseTo(page, 'bankConnections:reconnect');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const connections = page.getByRole('list', { name: 'Bank Connections' });
	await connections.getByRole('button', { name: 'renew' }).click();
	await reconnect.held;
	await connections.getByRole('button', { name: /Sample Savings Bank: / }).click();
	const savings = page.getByRole('dialog', { name: 'Sample Savings Bank' });
	const syncNow = savings.getByRole('button', { name: 'Sync now' });
	await expect(syncNow).toBeDisabled();
	reconnect.release();

	await expect(syncNow).toBeEnabled();
	await expect(savings.getByRole('status')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(savings).toBeHidden();

	await connections.getByRole('button', { name: /Sample Credit Union: / }).click();
	const creditUnion = page.getByRole('dialog', { name: 'Sample Credit Union' });
	await expect(creditUnion.getByRole('status')).toHaveText(
		"Couldn't reach the bank; try again later."
	);
});
