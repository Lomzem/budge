import { expect, type Page } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
import { choicesOf, choose, openBudget, type Journey } from './journey';

async function act(page: Page, name: string, action: string) {
	const trigger = page.getByRole('button', {
		name: new RegExp(`^${name}( \\(hidden\\))? actions$`)
	});
	await trigger.focus();
	await page.keyboard.press('Enter');
	await page.getByRole('menuitem', { name: action }).click();
}

async function openCategories(page: Page) {
	await page.goto('/categories');
	await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
}

export const categories = {
	manage: {
		title: 'a Category can be added, renamed, hidden, and deleted, down to 320 px',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 320, height: 640 });

			await step("Budget's Add Category requires a group a Category can join", async () => {
				await openBudget(page);
				await page.getByRole('button', { name: 'Edit Categories' }).click();
				await page.getByRole('menuitem', { name: 'Add Category', exact: true }).click();
				const addCategory = page.getByRole('dialog', { name: 'Add Category' });
				await expect(addCategory.getByRole('combobox', { name: 'Category Group' })).toHaveAttribute(
					'aria-required',
					'true'
				);
				const groups = await choicesOf(addCategory.getByLabel('Category Group'));
				expect(groups).not.toHaveLength(0);
				expect(groups).not.toContain('Credit Card Payments');
				await page.keyboard.press('Escape');
				await expect(addCategory).toBeHidden();
			});

			await step('add a Category Group and a Category in it', async () => {
				await openCategories(page);
				await page.getByRole('button', { name: 'Add Category Group' }).click();
				const addGroup = page.getByRole('dialog', { name: 'Add Category Group' });
				await addGroup.getByLabel('Name').fill('Smoke Test Group');
				await addGroup.getByRole('button', { name: 'Add' }).click();
				await expect(addGroup).toBeHidden();

				await page.getByRole('button', { name: 'Add Category', exact: true }).click();
				const addCategory = page.getByRole('dialog', { name: 'Add Category' });
				await choose(addCategory.getByLabel('Category Group'), 'Smoke Test Group');
				await addCategory.getByLabel('Name').fill('Smoke Test Category');
				await addCategory.getByRole('button', { name: 'Add' }).click();
				await expect(addCategory).toBeHidden();
			});

			await step('a click opens its menu on the first action', async () => {
				const trigger = page.getByRole('button', { name: 'Smoke Test Category actions' });
				await trigger.click();
				await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
				await page.keyboard.press('Escape');
				await expect(trigger).toBeFocused();
			});

			await step('rename it, then hide it, with nothing scrolling sideways', async () => {
				await act(page, 'Smoke Test Category', 'Rename');
				const rename = page.getByRole('dialog', { name: 'Rename Category' });
				await rename.getByLabel('Name').fill('Smoke Test Renamed');
				await rename.getByRole('button', { name: 'Save' }).click();
				await expect(rename).toBeHidden();

				await act(page, 'Smoke Test Renamed', 'Hide from budget');
				await expect(
					page.getByRole('button', { name: 'Smoke Test Renamed (hidden) actions' })
				).toBeVisible();
				const scrollWidthAtTheNarrowestWidth = await page.evaluate(
					() => document.documentElement.scrollWidth
				);
				expect(scrollWidthAtTheNarrowestWidth).toBeLessThanOrEqual(320);
			});

			await step('delete the Category into Groceries, then its empty group', async () => {
				await act(page, 'Smoke Test Renamed', 'Delete…');
				const deleteCategory = page.getByRole('dialog', { name: 'Delete Smoke Test Renamed' });
				await choose(deleteCategory.getByLabel('Move its history to'), 'Groceries');
				await deleteCategory.getByRole('button', { name: 'Delete Category' }).click();
				await expect(deleteCategory).toBeHidden();
				await expect(page.getByRole('button', { name: /^Smoke Test Renamed/ })).toHaveCount(0);

				await act(page, 'Smoke Test Group', 'Delete…');
				const deleteGroup = page.getByRole('dialog', { name: 'Delete Smoke Test Group' });
				await deleteGroup.getByRole('button', { name: 'Delete group' }).click();
				await expect(deleteGroup).toBeHidden();
				await expect(
					page.getByRole('heading', { level: 2, name: /^Smoke Test Group/ })
				).toHaveCount(0);
			});
		}
	},
	'late-rename': {
		title: 'a rename that finishes after its dialog closed leaves the reopened dialog alone',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const renamed = await holdResponseTo(page, 'categories:rename');
			const rename = page.getByRole('dialog', { name: 'Rename Category' });

			await step(
				'save a rename of Groceries, hold its response, and close the dialog',
				async () => {
					await openCategories(page);
					await act(page, 'Groceries', 'Rename');
					await rename.getByLabel('Name').fill('Sample Slow Groceries');
					await rename.getByRole('button', { name: 'Save' }).click();
					await renamed.held;
					await page.keyboard.press('Escape');
					await expect(rename).toBeHidden();
				}
			);

			await step('reopen Rename for Groceries, then release the held rename', async () => {
				await act(page, 'Groceries', 'Rename');
				await expect(rename.getByLabel('Name')).toHaveValue('Groceries');
				renamed.release();
			});

			await step(
				'the rename lands in the list, and the reopened dialog stays as it was',
				async () => {
					await expect(
						page.getByRole('button', { name: 'Sample Slow Groceries actions', exact: true })
					).toBeVisible();
					await expect(rename).toHaveAttribute('data-state', 'open');
					await expect(rename.getByLabel('Name')).toHaveValue('Groceries');
					await expect(rename.getByRole('button', { name: 'Save' })).toBeEnabled();
					await expect(rename.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
