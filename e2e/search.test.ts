import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

async function openAllAccounts(page: Page) {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/accounts');
	await expect(page.getByRole('heading', { level: 1, name: 'All Accounts' })).toBeVisible();
}

async function listedPayees(page: Page) {
	return await page
		.getByRole('table')
		.getByRole('button', { name: /edit Transaction on/ })
		.evaluateAll((buttons) =>
			buttons.map((button) => button.firstElementChild?.textContent.trim() ?? '')
		);
}

test('search finds Transactions by Bank Text and split memo, and filters narrow the list', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await openAllAccounts(page);
	const search = page.getByRole('searchbox', { name: 'Search' });

	const numberOnlyInTheMatchedCoffeesBankText = '0042';
	await search.fill(numberOnlyInTheMatchedCoffeesBankText);
	await expect.poll(() => listedPayees(page)).toEqual(['Sample Coffee Shop']);

	await search.fill('birthday');
	await expect.poll(() => listedPayees(page)).toEqual(['Sample Warehouse Club']);

	await search.fill('');
	await page.getByLabel('Payee', { exact: true }).selectOption({ label: 'Sample Landlord' });
	await expect
		.poll(async () => new Set(await listedPayees(page)))
		.toEqual(new Set(['Sample Landlord']));

	await test.step('the split has no Category of its own; its Gifts line lists it under Gifts', async () => {
		await page.getByLabel('Payee', { exact: true }).selectOption({ label: 'Any Payee' });
		await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Gifts' });
		await expect.poll(() => listedPayees(page)).toContain('Sample Warehouse Club');
	});

	await page.getByRole('button', { name: 'Clear search and filters' }).click();
	await expect(page.getByLabel('Category', { exact: true })).toHaveValue('');
});

test('the search and filters are labeled and fit a 320 px screen', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 640 });
	await openAllAccounts(page);

	for (const label of ['Search', 'Account', 'Category', 'Payee', 'From', 'To']) {
		await expect(page.getByLabel(label, { exact: true })).toBeVisible();
	}
	await page.getByRole('searchbox', { name: 'Search' }).fill('0042');
	await expect.poll(() => listedPayees(page)).toEqual(['Sample Coffee Shop']);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
