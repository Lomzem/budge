import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

import { formatCents, parseCents } from '../src/lib/domain/money';

// Runs on the local backend after CI's `seed:run`, so Groceries and Coffee exist. Every move it
// makes, it moves back.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

async function cents(page: Page, read: () => Promise<string | null>) {
	const amount = parseCents((await read()) ?? '');
	if (amount === undefined) throw new Error(`Expected an amount on ${page.url()}.`);
	return amount;
}

test('the inspector moves money by keyboard, and opens under its row on a phone', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible();

	const readyToAssign = () => cents(page, () => page.getByTestId('ready-to-assign').textContent());
	const assigned = (name: string) =>
		cents(page, () => page.getByRole('textbox', { name: `Assigned for ${name}` }).inputValue());

	const groceries = page.getByRole('button', { name: 'Groceries', exact: true });
	await groceries.focus();
	await page.keyboard.press('Enter');
	const inspector = page.getByRole('region', { name: 'Groceries' });
	await expect(inspector).toBeFocused();
	await expect(inspector.getByText('Left over from last month')).toBeVisible();

	const before = {
		readyToAssign: await readyToAssign(),
		groceries: await assigned('Groceries'),
		coffee: await assigned('Coffee')
	};
	const move = async (direction: 'Move to' | 'Take from') => {
		await inspector.getByLabel(direction).check();
		const category = inspector.getByLabel(
			direction === 'Move to' ? 'To Category' : 'From Category'
		);
		const coffee = await category.locator('option', { hasText: /^Coffee / }).getAttribute('value');
		await category.selectOption(coffee ?? '');
		await inspector.getByLabel('Amount').fill(formatCents(1_000).replace('$', ''));
		await inspector.getByLabel('Amount').press('Enter');
	};

	await move('Move to');
	await expect.poll(() => assigned('Groceries')).toBe(before.groceries - 1_000);
	await expect.poll(() => assigned('Coffee')).toBe(before.coffee + 1_000);
	expect(await readyToAssign()).toBe(before.readyToAssign);

	// Move it back, so the seeded budget stays as it was.
	await move('Take from');
	await expect.poll(() => assigned('Groceries')).toBe(before.groceries);
	await expect.poll(() => assigned('Coffee')).toBe(before.coffee);

	// On a phone the same inspector opens in a row under Groceries.
	await page.setViewportSize({ width: 320, height: 640 });
	await expect(inspector).toBeVisible();
	await expect(page.getByRole('row').filter({ has: inspector })).toBeVisible();
	await inspector.getByRole('button', { name: 'Close Groceries' }).click();
	await expect(inspector).toBeHidden();
	await expect(groceries).toBeFocused();
});
