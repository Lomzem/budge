import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('the sidebar shows when each Bank Connection last synced', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	// The seed's Sandbox connection synced two hours ago and has no token.
	const line = page
		.getByRole('list', { name: 'Bank Connections' })
		.getByRole('button', { name: /Sample Bank \(Sandbox\): Synced 2 hours ago/ });
	await expect(line).toBeVisible();

	await line.click();
	const dialog = page.getByRole('dialog', { name: 'Sample Bank (Sandbox)' });
	await expect(dialog.getByText(/^Last synced /)).toBeVisible();

	await dialog.getByRole('button', { name: 'Sync now' }).click();
	await expect(dialog.getByRole('status')).toHaveText(
		'This Bank Connection has no bank login, so it never syncs.'
	);
});
