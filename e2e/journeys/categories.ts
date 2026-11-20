import { expect, type Locator, type Page } from '@playwright/test';

import { failFirstCallTo, holdResponseTo } from '../heldResponse';
import {
	centerOf,
	choicesOf,
	choose,
	clickTheSpotOf,
	expectNothingPastTheRightEdge,
	openBudget,
	reloadOnceSaved,
	tap,
	touchscreen,
	typed,
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

async function rightClickTheNameCell(row: Locator) {
	await row.getByRole('cell').first().click({ button: 'right' });
}

async function fromRowMenu(page: Page, row: Locator, action: string) {
	await rightClickTheNameCell(row);
	await page.getByRole('menuitem', { name: action, exact: true }).click();
}

async function fromKeyboardMenu(page: Page, category: string, action: string) {
	await page.getByRole('button', { name: category, exact: true }).focus();
	await page.keyboard.press('Shift+F10');
	await page.getByRole('menuitem', { name: action, exact: true }).focus();
	await page.keyboard.press('Enter');
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

async function tapTheCornerOf(page: Page, target: Locator) {
	await target.scrollIntoViewIfNeeded();
	const box = await target.boundingBox();
	if (box === null) throw new Error(`${String(target)} has no box to tap`);
	const corner = { x: box.x + 3, y: box.y + box.height - 3 };
	for (const menu of await page.getByRole('menu').all()) {
		const cover = await menu.boundingBox();
		if (cover === null) continue;
		const inside =
			corner.x >= cover.x &&
			corner.x <= cover.x + cover.width &&
			corner.y >= cover.y &&
			corner.y <= cover.y + cover.height;
		if (inside) throw new Error(`A menu covers the corner of ${String(target)}`);
	}
	const screen = await touchscreen(page);
	await screen.touch('touchStart', [{ id: 1, ...corner }]);
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
				'a right-click on a row opens its menu; Rename edits in place, refuses an empty name, and Escape keeps the old one; Delete of a one-Category group speaks of one Category',
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
					await fromGroupMenu(page, 'Smoke Test Shelf', 'Delete…');
					const oneCategoryGroup = page.getByRole('dialog', { name: 'Delete Smoke Test Shelf' });
					await expect(oneCategoryGroup.getByText(/group you pick/)).toHaveText(
						'Its Category moves to the group you pick, with its history.'
					);
					await expect(oneCategoryGroup.getByLabel('Move its Category to')).toBeVisible();
					await page.keyboard.press('Escape');
					await expect(oneCategoryGroup).toBeHidden();
				}
			);

			await step(
				'a click on another row while the menu is open only closes the menu, and a click on the row selects it',
				async () => {
					const groceries = rowOf(page, 'Groceries');
					const other = rowOf(page, 'Smoke Test Renamed');
					await rightClickTheNameCell(groceries);
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
					await rowOf(page, second).getByRole('cell').last().click({ button: 'right' });
					await expect(page.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute(
						'data-disabled'
					);
					await page.keyboard.press('Escape');
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(page.getByRole('button', { name: second, exact: true })).toBeFocused();
					await groupOf(page, 'Smoke Test Shelf')
						.getByRole('row')
						.first()
						.getByRole('cell')
						.last()
						.click({ button: 'right' });
					await page.keyboard.press('Escape');
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(
						page.locator('[data-group-id]', { hasText: 'Smoke Test Shelf' })
					).toBeFocused();

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

					await fromKeyboardMenu(page, 'Smoke Test Renamed', 'Move to group');
					await page.keyboard.press('ArrowRight');
					await page.getByRole('menuitem', { name: 'Everyday', exact: true }).focus();
					await page.keyboard.press('Enter');
					await expect.poll(() => namesIn(everyday)).toContain('Smoke Test Renamed');
					await expect(
						page.getByRole('button', { name: 'Smoke Test Renamed', exact: true })
					).toBeFocused();

					await reloadOnceSaved(page);
					await expect.poll(() => namesIn(everyday)).toEqual([...swapped, 'Smoke Test Renamed']);
					await expect.poll(() => groupOrder(page)).toEqual(raised);
				}
			);

			await step(
				'Hide from the keyboard moves it under Hidden and focus to its neighbour, and Show opens its collapsed group with focus on it',
				async () => {
					const everyday = groupOf(page, 'Everyday');
					const neighbour = (await namesIn(everyday)).at(-2) ?? '';
					await fromKeyboardMenu(page, 'Smoke Test Renamed', 'Hide');
					const hidden = page.getByRole('region', { name: 'Hidden' });
					await expect(hidden.getByRole('listitem')).toContainText(['Smoke Test Renamed']);
					const restored = page.getByRole('button', { name: 'Smoke Test Renamed', exact: true });
					await expect(restored).toHaveCount(0);
					await expect(page.getByRole('button', { name: neighbour, exact: true })).toBeFocused();
					await reloadOnceSaved(page);
					const everydayToggle = page.locator('[data-group-id]', { hasText: 'Everyday' });
					await everydayToggle.click();
					await expect(everydayToggle).toHaveAttribute('aria-expanded', 'false');
					await hidden.getByRole('button', { name: 'Show Smoke Test Renamed' }).focus();
					await page.keyboard.press('Enter');
					await expect(everydayToggle).toHaveAttribute('aria-expanded', 'true');
					await expect(restored).toBeFocused();
					await expect(hidden).toHaveCount(0);

					const groups = await groupOrder(page);
					const shelfAt = groups.indexOf('Smoke Test Shelf');
					const nextGroup = groups[shelfAt + 1] ?? groups[shelfAt - 1] ?? '';
					await page.getByRole('button', { name: 'Smoke Test Shelf actions' }).focus();
					await page.keyboard.press('Enter');
					await page.getByRole('menuitem', { name: 'Hide', exact: true }).focus();
					await page.keyboard.press('Enter');
					await expect(hidden.getByRole('button', { name: 'Show Smoke Test Shelf' })).toBeVisible();
					await expect(page.locator('[data-group-id]', { hasText: nextGroup })).toBeFocused();
					await hidden.getByRole('button', { name: 'Show Smoke Test Shelf' }).focus();
					await page.keyboard.press('Enter');
					await expect(
						page.locator('[data-group-id]', { hasText: 'Smoke Test Shelf' })
					).toBeFocused();
				}
			);

			await step(
				'delete the Category into Groceries, which puts focus on Transit beside it and leaves its group empty without narrowing the phone table, then delete the group',
				async () => {
					await fromRowMenu(page, rowOf(page, 'Smoke Test Renamed'), 'Delete…');
					const deleteCategory = page.getByRole('dialog', { name: 'Delete Smoke Test Renamed' });
					await choose(deleteCategory.getByLabel('Move its history to'), 'Groceries');
					await deleteCategory.getByRole('button', { name: 'Delete Category' }).click();
					await expect(deleteCategory).toBeHidden();
					await expect(page.getByRole('button', { name: 'Transit', exact: true })).toBeFocused();
					await expect(page.getByRole('button', { name: /^Smoke Test Renamed/ })).toHaveCount(0);
					await expect(groupOf(page, 'Smoke Test Shelf')).toBeVisible();
					await expect(groupOf(page, 'Smoke Test Shelf').locator('[data-category-id]')).toHaveCount(
						0
					);
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
			'on a 320 px touch screen, holding a Category name opens its menu without selecting it, a tap outside any Budget menu only closes it, and Assigned fields never open a row menu',
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
				const moveToGroup = page.getByRole('menuitem', { name: 'Move to group' });
				expect((await moveToGroup.boundingBox())?.height).toBeGreaterThanOrEqual(44);
				await tap(page, moveToGroup);
				const groupsToMoveTo = page
					.getByRole('menu')
					.filter({ has: page.getByRole('menuitem', { name: 'Bills', exact: true }) });
				await expect(groupsToMoveTo).toBeVisible();
				const width = page.viewportSize()?.width ?? 0;
				await expect
					.poll(async () => {
						const box = await groupsToMoveTo.boundingBox();
						return box !== null && box.x >= 0 && box.x + box.width <= width;
					})
					.toBe(true);
				const bills = groupsToMoveTo.getByRole('menuitem', { name: 'Bills', exact: true });
				expect((await bills.boundingBox())?.height).toBeGreaterThanOrEqual(44);
			});
			await step('tap outside the menu, which only closes it', async () => {
				const everyday = page.getByRole('button', { name: 'Everyday', exact: true });
				await tap(page, everyday);
				await expect(page.getByRole('menu')).toHaveCount(0);
				await expect(everyday).toHaveAttribute('aria-expanded', 'true');
				await expect(rowOf(page, 'Groceries')).not.toHaveAttribute('data-state', 'selected');
			});
			await step('with the menu open again, a tap on the Coffee name only closes it', async () => {
				await holdDown(page, page.getByRole('button', { name: 'Groceries', exact: true }));
				await expect(page.getByRole('menu')).toBeVisible();
				await tap(page, page.getByRole('button', { name: 'Coffee', exact: true }));
				await expect(page.getByRole('menu')).toHaveCount(0);
				await expect(page.getByRole('dialog')).toHaveCount(0);
				await expect(rowOf(page, 'Coffee')).not.toHaveAttribute('data-state', 'selected');
			});
			await step(
				'with the menu open again, a tap on a blank part of the Coffee row only closes it',
				async () => {
					await holdDown(page, page.getByRole('button', { name: 'Groceries', exact: true }));
					await expect(page.getByRole('menu')).toBeVisible();
					await tapTheCornerOf(page, rowOf(page, 'Coffee').getByRole('cell').first());
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(page.getByRole('dialog')).toHaveCount(0);
					await expect(rowOf(page, 'Coffee')).not.toHaveAttribute('data-state', 'selected');
				}
			);
			await step(
				'a tap on the Groceries Assigned field opens no menu and takes the amount typed',
				async () => {
					const assigned = page.getByRole('textbox', { name: 'Assigned for Groceries' });
					await tap(page, assigned);
					await expect(assigned).toBeFocused();
					await expect(page.getByRole('menu')).toHaveCount(0);
					await page.keyboard.type('400');
					await page.keyboard.press('Enter');
					await expect(assigned).toHaveValue(typed(40_000));
				}
			);
			await step(
				"with a group's ⋯ menu open, a tap on the Transit name only closes it",
				async () => {
					await tap(page, page.getByRole('button', { name: 'Everyday actions' }));
					await expect(page.getByRole('menu')).toBeVisible();
					await tap(page, page.getByRole('button', { name: 'Transit', exact: true }));
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(page.getByRole('dialog')).toHaveCount(0);
					await expect(rowOf(page, 'Transit')).not.toHaveAttribute('data-state', 'selected');
					await expect(page.getByRole('button', { name: 'Everyday actions' })).toBeFocused();
					await stopTouching?.();
				}
			);
			await step(
				"on a desktop, a right-click in an Assigned field opens no row menu, and a click or right-click on a name or the page with a group's ⋯ menu open only closes it and leaves focus on ⋯, and the next click reaches the page",
				async () => {
					await page.setViewportSize({ width: 1280, height: 800 });
					await page
						.getByRole('textbox', { name: 'Assigned for Transit' })
						.click({ button: 'right' });
					await expect(page.getByRole('menu')).toHaveCount(0);
					await page.getByRole('button', { name: 'Bills actions' }).click();
					await expect(page.getByRole('menu')).toBeVisible();
					await clickTheSpotOf(page, page.getByRole('button', { name: 'Coffee', exact: true }));
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(rowOf(page, 'Coffee')).not.toHaveAttribute('data-state', 'selected');
					await expect(page.getByRole('region', { name: 'Coffee' })).toHaveCount(0);
					const bills = page.getByRole('button', { name: 'Bills actions' });
					await expect(bills).toBeFocused();
					await bills.click();
					await expect(page.getByRole('menu')).toBeVisible();
					await page.mouse.click(1080, 50);
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(bills).toBeFocused();
					await bills.click();
					await expect(page.getByRole('menu')).toBeVisible();
					await clickTheSpotOf(
						page,
						page.getByRole('button', { name: 'Coffee', exact: true }),
						'right'
					);
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(bills).toBeFocused();
					await clickTheSpotOf(page, page.getByRole('button', { name: 'Coffee', exact: true }));
					await expect(page.getByRole('region', { name: 'Coffee' })).toBeVisible();
				}
			);
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
