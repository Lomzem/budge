import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

// Runs on the local backend after CI's `seed:run`, so Groceries exists. Everything it adds, it
// deletes again.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

/** Opens the actions menu of a group or Category by keyboard, then picks `action`. */
async function act(page: Page, name: string, action: string) {
	const trigger = page.getByRole('button', {
		name: new RegExp(`^${name}( \\(hidden\\))? actions$`)
	});
	await trigger.focus();
	await page.keyboard.press('Enter');
	await page.getByRole('menuitem', { name: action }).click();
}

test('a Category can be added, renamed, hidden, and deleted, down to 320 px', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 320, height: 640 });
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/categories');
	await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();

	await page.getByRole('button', { name: 'Add Category Group' }).click();
	const addGroup = page.getByRole('dialog', { name: 'Add Category Group' });
	await addGroup.getByLabel('Name').fill('Smoke Test Group');
	await addGroup.getByRole('button', { name: 'Add' }).click();
	await expect(addGroup).toBeHidden();

	await page.getByRole('button', { name: 'Add Category', exact: true }).click();
	const addCategory = page.getByRole('dialog', { name: 'Add Category' });
	await addCategory.getByLabel('Category Group').selectOption({ label: 'Smoke Test Group' });
	await addCategory.getByLabel('Name').fill('Smoke Test Category');
	await addCategory.getByRole('button', { name: 'Add' }).click();
	await expect(addCategory).toBeHidden();

	await act(page, 'Smoke Test Category', 'Rename');
	const rename = page.getByRole('dialog', { name: 'Rename Category' });
	await rename.getByLabel('Name').fill('Smoke Test Renamed');
	await rename.getByRole('button', { name: 'Save' }).click();
	await expect(rename).toBeHidden();

	await act(page, 'Smoke Test Renamed', 'Hide from budget');
	await expect(
		page.getByRole('button', { name: 'Smoke Test Renamed (hidden) actions' })
	).toBeVisible();
	// Nothing scrolls sideways at the narrowest width.
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

	await act(page, 'Smoke Test Renamed', 'Delete…');
	const deleteCategory = page.getByRole('dialog', { name: 'Delete Smoke Test Renamed' });
	await deleteCategory.getByLabel('Move its history to').selectOption({ label: 'Groceries' });
	await deleteCategory.getByRole('button', { name: 'Delete Category' }).click();
	await expect(deleteCategory).toBeHidden();
	await expect(page.getByRole('button', { name: /^Smoke Test Renamed/ })).toHaveCount(0);

	await act(page, 'Smoke Test Group', 'Delete…');
	const deleteGroup = page.getByRole('dialog', { name: 'Delete Smoke Test Group' });
	await deleteGroup.getByRole('button', { name: 'Delete group' }).click();
	await expect(deleteGroup).toBeHidden();
	await expect(page.getByRole('heading', { level: 2, name: /^Smoke Test Group/ })).toHaveCount(0);
});
