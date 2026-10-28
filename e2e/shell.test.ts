import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

// The one test user, created by hand on the Clerk development instance. CI makes it the owner
// of the local backend.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('the owner signs in and lands in the app shell', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Budget and Accounts' })).toBeVisible();

	await page.setViewportSize({ width: 320, height: 640 });
	await expect(page.getByRole('navigation', { name: 'Budget and Accounts' })).toBeHidden();
	await expect(page.getByRole('button', { name: 'View Budget' })).toBeVisible();
});
