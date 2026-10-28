import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

import { formatCents, parseCents } from '../src/lib/domain/money';

// Runs on the local backend after CI's `seed:run`, so Groceries exists.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test('editing Assigned inline changes Ready to Assign', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible();

	const readyToAssign = page.getByTestId('ready-to-assign');
	const assigned = page.getByRole('textbox', { name: 'Assigned for Groceries' });
	await expect(assigned).toBeVisible();
	const readCents = async () => parseCents((await readyToAssign.textContent()) ?? '');
	const before = await readCents();
	const was = parseCents(await assigned.inputValue());
	if (before === undefined || was === undefined) throw new Error('Expected amounts on screen.');

	await assigned.fill(formatCents(was + 1_000).replace('$', ''));
	await assigned.press('Enter');
	await expect.poll(readCents).toBe(before - 1_000);
	await expect(assigned).toHaveValue(formatCents(was + 1_000).replace('$', ''));

	// Put it back, so the seeded budget stays as it was.
	await assigned.fill(formatCents(was).replace('$', ''));
	await assigned.press('Enter');
	await expect.poll(readCents).toBe(before);
});
