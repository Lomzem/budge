import { expect, type Locator, type Page } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
import {
	choicesOf,
	choose,
	expectNothingPastTheRightEdge,
	openBudget,
	type Journey
} from './journey';

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

function groupOf(page: Page, name: string) {
	return page.getByRole('region', { name, exact: true });
}

async function orderIn(scope: Locator) {
	const handles = await scope.getByRole('button', { name: /^Move / }).all();
	const names = await Promise.all(handles.map((handle) => handle.getAttribute('aria-label')));
	return names.map((name) => (name ?? '').replace(/^Move /, ''));
}

async function groupOrder(page: Page) {
	return (await page.getByRole('heading', { level: 2 }).allInnerTexts()).map((name) => name.trim());
}

async function drag(page: Page, handle: Locator, onto: Locator) {
	const from = await handle.boundingBox();
	const to = await onto.boundingBox();
	if (from === null || to === null) throw new Error('A drag needs both rows on screen.');
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2, to.y + 2, { steps: 8 });
	await page.mouse.up();
}

export const categories = {
	manage: {
		title:
			'a Category can be added from its group or with a new group, renamed in place, hidden, and deleted, down to 320 px',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 320, height: 640 });

			await step(
				"Budget's Add Category requires a group, and offers to make a new one",
				async () => {
					await openBudget(page);
					await page.getByRole('button', { name: 'Edit Categories' }).click();
					await page.getByRole('menuitem', { name: 'Add Category', exact: true }).click();
					const addCategory = page.getByRole('dialog', { name: 'Add Category' });
					await expect(
						addCategory.getByRole('combobox', { name: 'Category Group' })
					).toHaveAttribute('aria-required', 'true');
					const groups = await choicesOf(addCategory.getByLabel('Category Group'));
					expect(groups).toContain('Everyday');
					expect(groups).toContain('New Category Group…');
					expect(groups).not.toContain('Credit Card Payments');
					await page.keyboard.press('Escape');
					await expect(addCategory).toBeHidden();
				}
			);

			await step("a group's + on the Budget adds a Category to that group", async () => {
				await page.getByRole('button', { name: 'Add Category to Savings Goals' }).click();
				const addCategory = page.getByRole('dialog', { name: 'Add Category' });
				await expect(addCategory.getByLabel('Category Group')).toHaveText('Savings Goals');
				await expect(addCategory.getByLabel('Name')).toBeFocused();
				await addCategory.getByLabel('Name').fill('Sample Bike Fund');
				await addCategory.getByRole('button', { name: 'Add' }).click();
				await expect(addCategory).toBeHidden();
				await page.reload();
				const savings = page
					.getByRole('rowgroup')
					.filter({ has: page.getByRole('rowheader', { name: /Savings Goals/ }) });
				await expect(
					savings.getByRole('button', { name: 'Sample Bike Fund', exact: true })
				).toBeVisible();
			});

			await step('add a Category with a new group in the same dialog', async () => {
				await openCategories(page);
				await page.getByRole('button', { name: 'Add Category', exact: true }).click();
				const addCategory = page.getByRole('dialog', { name: 'Add Category' });
				await choose(addCategory.getByLabel('Category Group'), 'New Category Group…');
				await expect(addCategory.getByLabel('Group name')).toBeFocused();
				await addCategory.getByRole('button', { name: 'Add' }).click();
				await expect(addCategory).toBeVisible();
				await addCategory.getByLabel('Group name').fill('Smoke Test Group');
				await addCategory.getByLabel('Name', { exact: true }).fill('Smoke Test Category');
				await addCategory.getByRole('button', { name: 'Add' }).click();
				await expect(addCategory).toBeHidden();
				await page.reload();
				await expect(
					groupOf(page, 'Smoke Test Group').getByRole('button', {
						name: 'Smoke Test Category',
						exact: true
					})
				).toBeVisible();
			});

			await step('a click opens its menu on the first action', async () => {
				const trigger = page.getByRole('button', { name: 'Smoke Test Category actions' });
				await trigger.click();
				await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
				await page.keyboard.press('Escape');
				await expect(trigger).toBeFocused();
			});

			await step(
				'Rename edits the name in place; an empty name is refused and Escape keeps the old one',
				async () => {
					await act(page, 'Smoke Test Category', 'Rename');
					const field = page.getByRole('textbox', { name: 'Category name' });
					await expect(field).toBeFocused();
					await expect(field).toHaveValue('Smoke Test Category');
					await field.fill('  ');
					await field.press('Enter');
					await expect(page.getByRole('alert').filter({ hasText: 'Enter a name.' })).toBeVisible();
					await field.press('Escape');
					const name = page.getByRole('button', { name: 'Smoke Test Category', exact: true });
					await expect(name).toBeFocused();

					await name.click();
					await field.fill('Smoke Test Renamed');
					await field.press('Enter');
					await expect(
						page.getByRole('button', { name: 'Smoke Test Renamed', exact: true })
					).toBeFocused();
					await page.reload();
					await expect(
						page.getByRole('button', { name: 'Smoke Test Renamed', exact: true })
					).toBeVisible();
				}
			);

			await step('a group is renamed in place from its name', async () => {
				await page.getByRole('button', { name: 'Smoke Test Group', exact: true }).click();
				const field = page.getByRole('textbox', { name: 'Category Group name' });
				await field.fill('Smoke Test Shelf');
				await field.press('Enter');
				await page.reload();
				await expect(groupOf(page, 'Smoke Test Shelf')).toBeVisible();
			});

			await step('hide it, with nothing scrolling sideways', async () => {
				await act(page, 'Smoke Test Renamed', 'Hide from budget');
				await expect(
					page.getByRole('button', { name: 'Smoke Test Renamed (hidden) actions' })
				).toBeVisible();
				await expectNothingPastTheRightEdge(page);
			});

			await step('delete the Category into Groceries, then its empty group', async () => {
				await act(page, 'Smoke Test Renamed', 'Delete…');
				const deleteCategory = page.getByRole('dialog', { name: 'Delete Smoke Test Renamed' });
				await choose(deleteCategory.getByLabel('Move its history to'), 'Groceries');
				await deleteCategory.getByRole('button', { name: 'Delete Category' }).click();
				await expect(deleteCategory).toBeHidden();
				await expect(page.getByRole('button', { name: /^Smoke Test Renamed/ })).toHaveCount(0);

				await act(page, 'Smoke Test Shelf', 'Delete…');
				const deleteGroup = page.getByRole('dialog', { name: 'Delete Smoke Test Shelf' });
				await deleteGroup.getByRole('button', { name: 'Delete group' }).click();
				await expect(deleteGroup).toBeHidden();
				await expect(
					page.getByRole('heading', { level: 2, name: /^Smoke Test Shelf/ })
				).toHaveCount(0);
			});
		}
	},
	reorder: {
		title:
			'Categories and groups reorder by keyboard on their handle or by dragging it, and the order lasts',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const everyday = groupOf(page, 'Everyday');

			await step('open the Categories page at phone width', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await openCategories(page);
				expect(await orderIn(everyday)).toEqual([
					'Everyday',
					'Groceries',
					'Dining Out',
					'Coffee',
					'Transit'
				]);
			});

			await step(
				'ArrowUp and Home move Coffee, and its handle keeps focus at the group edge',
				async () => {
					const handle = everyday.getByRole('button', { name: 'Move Coffee' });
					await handle.focus();
					await page.keyboard.press('ArrowUp');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Groceries', 'Coffee', 'Dining Out', 'Transit']);
					await expect(handle).toBeFocused();
					await page.keyboard.press('Home');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Coffee', 'Groceries', 'Dining Out', 'Transit']);
					await page.keyboard.press('ArrowUp');
					await expect(handle).toBeFocused();
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Coffee', 'Groceries', 'Dining Out', 'Transit']);
				}
			);

			await step('End moves the Savings Goals group last', async () => {
				const before = await groupOrder(page);
				await page.getByRole('button', { name: 'Move Savings Goals' }).focus();
				await page.keyboard.press('End');
				await expect
					.poll(() => groupOrder(page))
					.toEqual([...before.filter((name) => name !== 'Savings Goals'), 'Savings Goals']);
			});

			await step('dragging Transit by its handle onto Coffee puts it first', async () => {
				await page.setViewportSize({ width: 1280, height: 800 });
				await drag(
					page,
					everyday.getByRole('button', { name: 'Move Transit' }),
					everyday.getByRole('listitem').first()
				);
				await expect
					.poll(() => orderIn(everyday))
					.toEqual(['Everyday', 'Transit', 'Coffee', 'Groceries', 'Dining Out']);
			});

			await step('a reload and the Budget keep the new order', async () => {
				await page.reload();
				await expect
					.poll(() => orderIn(everyday))
					.toEqual(['Everyday', 'Transit', 'Coffee', 'Groceries', 'Dining Out']);
				expect((await groupOrder(page)).at(-1)).toBe('Savings Goals');
				await openBudget(page);
				const rows = page
					.getByRole('rowgroup')
					.filter({ has: page.getByRole('rowheader', { name: /^Everyday/ }) })
					.locator('[data-category-id]');
				await expect(rows).toHaveText(['Transit', 'Coffee', 'Groceries', 'Dining Out']);
			});
		}
	},
	'late-rename': {
		title: 'renaming again while the first rename is still on its way keeps the name typed last',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const renamed = await holdResponseTo(page, 'categories:rename');
			const field = page.getByRole('textbox', { name: 'Category name' });

			await step('rename Groceries in place and hold the save', async () => {
				await openCategories(page);
				await page.getByRole('button', { name: 'Groceries', exact: true }).click();
				await field.fill('Sample Slow Groceries');
				await field.press('Enter');
				await renamed.held;
				await expect(
					page.getByRole('button', { name: 'Sample Slow Groceries', exact: true })
				).toBeFocused();
			});

			await step('rename it again while the first save is held', async () => {
				await page.getByRole('button', { name: 'Sample Slow Groceries', exact: true }).click();
				await expect(field).toHaveValue('Sample Slow Groceries');
				await field.fill('Sample Fast Groceries');
				await field.press('Enter');
			});

			await step('the first save landing does not bring back its name', async () => {
				renamed.releaseEarliest();
				await expect(
					page.getByRole('button', { name: 'Sample Fast Groceries', exact: true })
				).toBeVisible();
				await expect(
					page.getByRole('button', { name: 'Sample Slow Groceries', exact: true })
				).toHaveCount(0);
			});

			await step('the name typed last stays, after a reload too', async () => {
				renamed.release();
				await expect(
					page.getByRole('button', { name: 'Sample Fast Groceries', exact: true })
				).toBeVisible();
				await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
				await page.reload();
				await expect(
					page.getByRole('button', { name: 'Sample Fast Groceries', exact: true })
				).toBeVisible();
			});
		}
	}
} satisfies Record<string, Journey>;
