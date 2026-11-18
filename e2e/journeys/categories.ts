import { expect, type Locator, type Page } from '@playwright/test';

import { failFirstCallTo, holdResponseTo } from '../heldResponse';
import {
	centerOf,
	choicesOf,
	choose,
	expectNothingPastTheRightEdge,
	openBudget,
	reloadOnceSaved,
	tap,
	touchscreen,
	useATouchScreen,
	type Journey
} from './journey';

function groupOf(page: Page, name: string) {
	return page
		.getByRole('rowgroup')
		.filter({ has: page.getByRole('rowheader', { name: new RegExp(`^${name}`) }) });
}

function rowOf(page: Page, name: string) {
	return page
		.getByRole('row')
		.filter({ has: page.getByRole('button', { name, exact: true }) })
		.first();
}

async function namesIn(group: Locator) {
	const names = await group.locator('[data-category-id]').allInnerTexts();
	return names.map((name) => name.trim());
}

async function groupOrder(page: Page) {
	const names = await page.locator('[data-group-id]').allInnerTexts();
	return names.map((name) => name.trim().split('\n')[0] ?? '');
}

async function fromRowMenu(page: Page, row: Locator, action: string) {
	await row.click({ button: 'right' });
	await page.getByRole('menuitem', { name: action, exact: true }).click();
}

async function fromGroupMenu(page: Page, group: string, action: string) {
	await page.getByRole('button', { name: `${group} actions`, exact: true }).click();
	await page.getByRole('menuitem', { name: action, exact: true }).click();
}

async function holdDown(page: Page, target: Locator) {
	await target.scrollIntoViewIfNeeded();
	const { x, y } = await centerOf(target);
	const screen = await touchscreen(page);
	await screen.touch('touchStart', [{ id: 1, x, y }]);
	await page.waitForTimeout(900);
	await screen.touch('touchEnd', []);
	await screen.detach();
}

async function everydayWidthOnAPhone(page: Page) {
	await page.setViewportSize({ width: 320, height: 640 });
	const box = await page.locator('[data-group-id]', { hasText: 'Everyday' }).boundingBox();
	await page.setViewportSize({ width: 1280, height: 800 });
	return box?.width ?? 0;
}

export const categories = {
	manage: {
		title:
			'Categories are added, renamed, moved, hidden, shown, and deleted from the Budget menu, and the changes last',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			let everydayAtTheStart = 0;
			await step(
				"Budget's Add Category requires a group, and offers to make a new one",
				async () => {
					await openBudget(page);
					everydayAtTheStart = await everydayWidthOnAPhone(page);
					expect(everydayAtTheStart).toBeGreaterThan(0);
					await page.getByRole('button', { name: 'Add Category', exact: true }).click();
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

			await step("a group's menu adds a Category to that group", async () => {
				await fromGroupMenu(page, 'Savings Goals', 'Add Category');
				const addCategory = page.getByRole('dialog', { name: 'Add Category' });
				await expect(addCategory.getByLabel('Category Group')).toHaveText('Savings Goals');
				await expect(addCategory.getByLabel('Name')).toBeFocused();
				await addCategory.getByLabel('Name').fill('Sample Bike Fund');
				await addCategory.getByRole('button', { name: 'Add' }).click();
				await expect(addCategory).toBeHidden();
				await reloadOnceSaved(page);
				await expect
					.poll(() => namesIn(groupOf(page, 'Savings Goals')))
					.toContain('Sample Bike Fund');
			});

			await step(
				'a new group needs its own name, and a Category the server refuses is retried into that same group',
				async () => {
					await page.getByRole('button', { name: 'Add Category', exact: true }).click();
					const addCategory = page.getByRole('dialog', { name: 'Add Category' });
					await choose(addCategory.getByLabel('Category Group'), 'New Category Group…');
					const groupName = addCategory.getByLabel('Group name');
					await expect(groupName).toBeFocused();
					await addCategory.getByLabel('Name', { exact: true }).fill('Smoke Test Category');
					await addCategory.getByRole('button', { name: 'Add' }).click();
					await expect(groupName).toBeFocused();

					await groupName.fill('Smoke Test Group');
					const spacesPassTheFormButNotTheServer = '   ';
					await addCategory
						.getByLabel('Name', { exact: true })
						.fill(spacesPassTheFormButNotTheServer);
					await addCategory.getByRole('button', { name: 'Add' }).click();
					await expect(addCategory.getByRole('alert')).toHaveText('Enter a name.');
					await expect(addCategory.getByLabel('Category Group')).toHaveText('Smoke Test Group');
					await addCategory.getByLabel('Name', { exact: true }).fill('Smoke Test Category');
					await addCategory.getByRole('button', { name: 'Add' }).click();
					await expect(addCategory).toBeHidden();
					await reloadOnceSaved(page);
					await expect
						.poll(() => namesIn(groupOf(page, 'Smoke Test Group')))
						.toEqual(['Smoke Test Category']);
				}
			);

			await step(
				'a right-click on a row opens its menu; Rename edits in place, refuses an empty name, and Escape keeps the old one',
				async () => {
					await fromRowMenu(page, rowOf(page, 'Smoke Test Category'), 'Rename');
					const field = page.getByRole('textbox', { name: 'Category name' });
					await expect(field).toBeFocused();
					await expect(field).toHaveValue('Smoke Test Category');
					await field.fill('  ');
					await field.press('Enter');
					await expect(page.getByRole('alert').filter({ hasText: 'Enter a name.' })).toBeVisible();
					await field.press('Escape');
					await expect(
						page.getByRole('button', { name: 'Smoke Test Category', exact: true })
					).toBeVisible();

					await fromRowMenu(page, rowOf(page, 'Smoke Test Category'), 'Rename');
					await field.fill('Smoke Test Renamed');
					await field.press('Enter');
					await expect(
						page.getByRole('button', { name: 'Smoke Test Renamed', exact: true })
					).toBeFocused();
					await fromGroupMenu(page, 'Smoke Test Group', 'Rename');
					const groupField = page.getByRole('textbox', { name: 'Category Group name' });
					await expect(groupField).toHaveValue('Smoke Test Group');
					await groupField.fill('Smoke Test Shelf');
					await groupField.press('Enter');
					await reloadOnceSaved(page);
					await expect
						.poll(() => namesIn(groupOf(page, 'Smoke Test Shelf')))
						.toEqual(['Smoke Test Renamed']);
				}
			);

			await step(
				'a click on another row while the menu is open only closes the menu, and a click on the row selects it',
				async () => {
					const groceries = rowOf(page, 'Groceries');
					const other = rowOf(page, 'Smoke Test Renamed');
					await groceries.click({ button: 'right' });
					await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
					const name = await centerOf(
						other.getByRole('button', { name: 'Smoke Test Renamed', exact: true })
					);
					await page.mouse.click(name.x, name.y);
					await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeHidden();
					await expect(other).not.toHaveAttribute('data-state', 'selected');
					await expect(groceries).not.toHaveAttribute('data-state', 'selected');
					const { x, y } = await centerOf(groceries.getByRole('cell').last());
					await page.mouse.click(x, y);
					await expect(groceries).toHaveAttribute('data-state', 'selected');
				}
			);

			await step(
				'Move up and Move down reorder Categories and groups, Move to group moves one across, and the order lasts',
				async () => {
					const everyday = groupOf(page, 'Everyday');
					const before = await namesIn(everyday);
					const second = before[1] ?? '';
					const swapped = [second, before[0], ...before.slice(2)];
					await fromRowMenu(page, rowOf(page, second), 'Move up');
					await expect.poll(() => namesIn(everyday)).toEqual(swapped);

					await page.getByRole('button', { name: second, exact: true }).focus();
					await page.keyboard.press('Enter');
					await page.getByRole('button', { name: `${second} actions` }).focus();
					await page.keyboard.press('Enter');
					await page.getByRole('menuitem', { name: 'Move down' }).focus();
					await page.keyboard.press('Enter');
					await expect.poll(() => namesIn(everyday)).toEqual(before);
					await page.getByRole('button', { name: `Close ${second}` }).click();

					await fromRowMenu(page, rowOf(page, second), 'Move up');
					await expect.poll(() => namesIn(everyday)).toEqual(swapped);
					await rowOf(page, second).click({ button: 'right' });
					await expect(page.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute(
						'data-disabled'
					);
					await page.keyboard.press('Escape');
					await expect(page.getByRole('menu')).toHaveCount(0);

					const groups = await groupOrder(page);
					const shelfAt = groups.indexOf('Smoke Test Shelf');
					const raised = [
						...groups.slice(0, shelfAt - 1),
						'Smoke Test Shelf',
						groups[shelfAt - 1],
						...groups.slice(shelfAt + 1)
					];
					await fromGroupMenu(page, 'Smoke Test Shelf', 'Move up');
					await expect.poll(() => groupOrder(page)).toEqual(raised);
					await fromGroupMenu(page, 'Smoke Test Shelf', 'Move down');
					await expect.poll(() => groupOrder(page)).toEqual(groups);
					await fromGroupMenu(page, 'Smoke Test Shelf', 'Move up');
					await expect.poll(() => groupOrder(page)).toEqual(raised);

					await rowOf(page, 'Smoke Test Renamed').click({ button: 'right' });
					await page.getByRole('menuitem', { name: 'Move to group' }).click();
					await page.getByRole('menuitem', { name: 'Everyday', exact: true }).click();
					await expect.poll(() => namesIn(everyday)).toContain('Smoke Test Renamed');

					await reloadOnceSaved(page);
					await expect.poll(() => namesIn(everyday)).toEqual([...swapped, 'Smoke Test Renamed']);
					await expect.poll(() => groupOrder(page)).toEqual(raised);
				}
			);

			await step(
				'Hide moves it under Hidden, and Show from the keyboard brings it back with focus on it',
				async () => {
					await fromRowMenu(page, rowOf(page, 'Smoke Test Renamed'), 'Hide');
					const hidden = page.getByRole('region', { name: 'Hidden' });
					await expect(hidden.getByRole('listitem')).toContainText(['Smoke Test Renamed']);
					const restored = page.getByRole('button', { name: 'Smoke Test Renamed', exact: true });
					await expect(restored).toHaveCount(0);
					await reloadOnceSaved(page);
					await hidden.getByRole('button', { name: 'Show Smoke Test Renamed' }).focus();
					await page.keyboard.press('Enter');
					await expect(restored).toBeFocused();
					await expect(hidden).toHaveCount(0);
				}
			);

			await step(
				'delete the Category into Groceries, which leaves its group empty without narrowing the phone table, then delete the group',
				async () => {
					await fromRowMenu(page, rowOf(page, 'Smoke Test Renamed'), 'Delete…');
					const deleteCategory = page.getByRole('dialog', { name: 'Delete Smoke Test Renamed' });
					await choose(deleteCategory.getByLabel('Move its history to'), 'Groceries');
					await deleteCategory.getByRole('button', { name: 'Delete Category' }).click();
					await expect(deleteCategory).toBeHidden();
					await expect(page.getByRole('button', { name: /^Smoke Test Renamed/ })).toHaveCount(0);
					await expect(
						groupOf(page, 'Smoke Test Shelf').getByText('No Categories yet.')
					).toBeVisible();
					expect(
						await everydayWidthOnAPhone(page),
						'Everyday at 320 px once a group is empty'
					).toBeCloseTo(everydayAtTheStart, 0);

					await fromGroupMenu(page, 'Smoke Test Shelf', 'Delete…');
					const deleteGroup = page.getByRole('dialog', { name: 'Delete Smoke Test Shelf' });
					await deleteGroup.getByRole('button', { name: 'Delete group' }).click();
					await expect(deleteGroup).toBeHidden();
					await expect(
						page.locator('[data-group-id]', { hasText: 'Smoke Test Shelf' })
					).toHaveCount(0);
				}
			);
		}
	},
	'touch-menu': {
		title:
			'on a 320 px touch screen, holding a Category name opens its menu without selecting it, and a tap outside only closes it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			let stopTouching: (() => Promise<void>) | undefined;
			await step('hold the Groceries name until its menu opens', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				stopTouching = await useATouchScreen(page);
				await openBudget(page);
				const groceries = rowOf(page, 'Groceries');
				const name = page.getByRole('button', { name: 'Groceries', exact: true });
				await holdDown(page, name);
				await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
				await expect(page.getByRole('dialog')).toHaveCount(0);
				await expect(name).toHaveAttribute('aria-expanded', 'false');
				await expect(groceries).not.toHaveAttribute('data-state', 'selected');
				await expectNothingPastTheRightEdge(page);
			});
			await step('tap outside the menu, which only closes it', async () => {
				const everyday = page.getByRole('button', { name: 'Everyday', exact: true });
				await tap(page, everyday);
				await expect(page.getByRole('menu')).toHaveCount(0);
				await expect(everyday).toHaveAttribute('aria-expanded', 'true');
				await expect(rowOf(page, 'Groceries')).not.toHaveAttribute('data-state', 'selected');
				await stopTouching?.();
			});
		}
	},
	'held-rename': {
		title: 'a rename still on its way neither overwrites a later rename nor comes back after it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const renamed = await holdResponseTo(page, 'categories:rename');
			const field = page.getByRole('textbox', { name: 'Category name' });
			const named = (name: string) => page.getByRole('button', { name, exact: true });

			await step('rename Groceries and hold the save', async () => {
				await openBudget(page);
				await fromRowMenu(page, rowOf(page, 'Groceries'), 'Rename');
				await field.fill('Sample Slow Groceries');
				await field.press('Enter');
				await renamed.held;
				await expect(named('Sample Slow Groceries')).toBeFocused();
			});

			await step('rename it again while that save is held', async () => {
				await fromRowMenu(page, rowOf(page, 'Sample Slow Groceries'), 'Rename');
				await expect(field).toHaveValue('Sample Slow Groceries');
				await field.fill('Sample Fast Groceries');
				await field.press('Enter');
			});

			await step('the earlier save landing does not bring back its name', async () => {
				renamed.landEarliest();
				await expect(named('Sample Fast Groceries')).toBeVisible();
				await expect(named('Sample Slow Groceries')).toHaveCount(0);
			});

			await step('the name typed last stays, after a reload too', async () => {
				renamed.release();
				await expect(named('Sample Fast Groceries')).toBeVisible();
				await reloadOnceSaved(page);
				await expect(named('Sample Fast Groceries')).toBeVisible();
			});
		}
	},
	'failed-rename': {
		title: 'a rename the server fails reopens its own name to retry, and saving it again works',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const server = await failFirstCallTo(page, 'categories:rename');
			const field = page.getByRole('textbox', { name: 'Category name' });
			const failure = "Budge couldn't rename it. Try again.";

			await step('rename Groceries; when the save fails the name reopens with it', async () => {
				await openBudget(page);
				await fromRowMenu(page, rowOf(page, 'Groceries'), 'Rename');
				await field.fill('Sample Refused Groceries');
				await field.press('Enter');
				await server.called('categories:rename');
				server.failWithServerError('categories:rename');
				await expect(field).toHaveValue('Sample Refused Groceries');
				await expect(field).toBeFocused();
				await expect(field).toHaveAccessibleDescription(failure);
			});

			await step('Enter saves it again, and a reload keeps it', async () => {
				await field.press('Enter');
				const renamed = page.getByRole('button', { name: 'Sample Refused Groceries', exact: true });
				await expect(renamed).toBeFocused();
				await reloadOnceSaved(page);
				await expect(renamed).toBeVisible();
			});
		}
	}
} satisfies Record<string, Journey>;
