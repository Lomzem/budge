import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Locator, type Page } from './test';

import { ordinal } from '../src/lib/domain/dates';
import { formatCents, parseCents } from '../src/lib/domain/money';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

async function assigned(page: Page, name: string) {
	const text = await page.getByRole('textbox', { name: `Assigned for ${name}` }).inputValue();
	const amount = parseCents(text);
	if (amount === undefined) throw new Error(`Expected an Assigned amount for ${name}.`);
	return amount;
}

async function waitForAssignToSettle(inspector: Locator) {
	const assign = inspector.getByRole('button', { name: /^Assign \$/ });
	await expect
		.poll(() =>
			assign.evaluateAll(
				(buttons) => buttons.length === 0 || buttons.some((button) => !button.matches(':disabled'))
			)
		)
		.toBe(true);
}

test('a Target shows its progress, "Assign $X" funds it, and it is listed as Upcoming', async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible();

	const name = 'Emergency Fund';
	const before = await assigned(page, name);
	await page.getByRole('button', { name, exact: true }).click();
	const inspector = page.getByRole('region', { name });

	const dialog = page.getByRole('dialog');
	let assigning = false;
	try {
		const twentyFiveDollarsMoreThanAssigned = before + 2_500;
		const dueToday = `The ${ordinal(new Date().getDate())}`;
		await inspector.getByRole('button', { name: 'Add Target' }).click();
		await dialog
			.getByLabel('Amount', { exact: true })
			.fill(formatCents(twentyFiveDollarsMoreThanAssigned).replace('$', ''));
		await dialog.getByLabel('Set aside the amount', { exact: true }).check();
		await dialog.getByLabel('Due day', { exact: true }).selectOption({ label: dueToday });
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();

		const bar = page.getByRole('progressbar', { name: `${name} Target` }).first();
		await expect(bar).toHaveAttribute('aria-valuetext', '$25.00 more needed');
		await expect(inspector.getByText('$25.00 more needed')).toBeVisible();
		const upcoming = page.getByRole('region', { name: 'Upcoming' });
		const row = upcoming.getByRole('row').filter({ hasText: name });
		await expect(row).toContainText('No');

		assigning = true;
		await inspector.getByRole('button', { name: 'Assign $25.00' }).click();
		await expect(inspector.getByText('Funded', { exact: true })).toBeVisible();
		await expect(bar).toHaveAttribute('aria-valuetext', 'Funded');
		await expect(row).toContainText('Yes');
		await expect.poll(() => assigned(page, name)).toBe(twentyFiveDollarsMoreThanAssigned);

		await test.step('on a phone the Upcoming list follows the table', async () => {
			await page.setViewportSize({ width: 320, height: 640 });
			await expect(upcoming).toBeVisible();
		});
	} finally {
		await page.setViewportSize({ width: 1280, height: 800 });
		if (await dialog.isVisible()) await page.keyboard.press('Escape');
		if (assigning) await waitForAssignToSettle(inspector);
		const edit = inspector.getByRole('button', { name: 'Edit Target' });
		if (await edit.isVisible()) {
			await edit.click();
			await dialog.getByRole('button', { name: 'Remove Target' }).click();
			await expect(inspector.getByText('No Target yet.')).toBeVisible();
		}
		const input = page.getByRole('textbox', { name: `Assigned for ${name}` });
		await input.fill(formatCents(before).replace('$', ''));
		await input.press('Enter');
		await expect.poll(() => assigned(page, name)).toBe(before);
	}
});
