import { clerk } from '@clerk/testing/playwright';
import { holdResponseTo } from './heldResponse';
import { expect, test } from './test';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('the sidebar shows when each Bank Connection last synced', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	const seededSandboxConnection = page
		.getByRole('list', { name: 'Bank Connections' })
		.getByRole('button', { name: /Sample Bank \(Sandbox\): Synced 2 hours ago/ });
	await expect(seededSandboxConnection).toBeVisible();

	await seededSandboxConnection.click();
	const dialog = page.getByRole('dialog', { name: 'Sample Bank (Sandbox)' });
	await expect(dialog.getByText(/^Last synced /)).toBeVisible();

	await dialog.getByRole('button', { name: 'Sync now' }).click();
	await expect(dialog.getByRole('status')).toHaveText(
		'This Bank Connection has no bank login, so it never syncs.'
	);
});

test.describe('with more than one Bank Connection', () => {
	test.use({ fixture: 'bank-sync' });

	test("a Sync now that finishes after its dialog closed leaves the next Bank Connection's dialog alone", async ({
		page
	}) => {
		if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
		const sync = await holdResponseTo(page, 'bankConnections:syncNow');
		await page.goto('/sign-in');
		await clerk.signIn({ page, emailAddress: ownerEmail });
		await page.goto('/');
		const connections = page.getByRole('list', { name: 'Bank Connections' });

		await connections.getByRole('button', { name: /^Sample Bank \(Sandbox\): / }).click();
		const sandbox = page.getByRole('dialog', { name: 'Sample Bank (Sandbox)' });
		await sandbox.getByRole('button', { name: 'Sync now' }).click();
		await sync.held;
		await page.keyboard.press('Escape');
		await expect(sandbox).toBeHidden();

		await connections.getByRole('button', { name: /^Sample Credit Union: / }).click();
		const creditUnion = page.getByRole('dialog', { name: 'Sample Credit Union' });
		await expect(creditUnion.getByRole('button', { name: 'Sync now' })).toBeEnabled();
		sync.release();
		await expect(page.getByText('This Bank Connection has no bank login')).toHaveCount(0);
		await expect(creditUnion.getByRole('status')).toHaveCount(0);
		await expect(creditUnion.getByRole('button', { name: 'Sync now' })).toBeEnabled();
	});
});
