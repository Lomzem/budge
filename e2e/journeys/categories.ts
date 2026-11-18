import { expect, type Locator, type Page } from '@playwright/test';

import { failFirstCallTo, holdResponseTo } from '../heldResponse';
import {
	centerOf,
	choicesOf,
	choose,
	expectClearOf,
	expectNothingPastTheRightEdge,
	openBudget,
	tap,
	touchscreen,
	useATouchScreen,
	type Finger,
	reloadOnceSaved,
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

async function settled(page: Page) {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					resolve();
				});
			})
	);
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
	return (await page.getByRole('main').getByRole('heading', { level: 2 }).allInnerTexts()).map(
		(name) => name.trim()
	);
}

async function drag(page: Page, handle: Locator, onto: Locator) {
	await handle.scrollIntoViewIfNeeded();
	await onto.scrollIntoViewIfNeeded();
	const from = await handle.boundingBox();
	const to = await onto.boundingBox();
	if (from === null || to === null) throw new Error('A drag needs both rows on screen.');
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2, to.y + 2, { steps: 8 });
	await page.mouse.up();
}

async function touchDragToTheBottomEdge(page: Page, handle: Locator, until: Locator) {
	const from = await handle.boundingBox();
	const height = page.viewportSize()?.height;
	if (from === null || height === undefined) throw new Error('A drag needs its handle on screen.');
	const finger = await page.context().newCDPSession(page);
	const x = from.x + from.width / 2;
	const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) => {
		await finger.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
		});
	};
	const start = from.y + from.height / 2;
	const nearTheBottomEdge = height - 100;
	await touch('touchStart', start);
	for (let step = 1; step <= 8; step++) {
		await touch('touchMove', start + ((nearTheBottomEdge - start) * step) / 8);
	}
	await expect(until).toBeInViewport();
	await touch('touchEnd', nearTheBottomEdge);
	await finger.detach();
}

const tabBarOf = (page: Page) => page.getByRole('navigation', { name: 'Sections', exact: true });

const touchSlop = 16;

async function swipeJustAboveTheTabBar(page: Page, target: Locator) {
	const barTop = (await tabBarOf(page).boundingBox())?.y;
	if (barTop === undefined) throw new Error('The tab bar is not on screen.');
	const finger = await touchscreen(page);
	for (let swipe = 0; swipe < 8; swipe++) {
		const box = await target.boundingBox();
		if (box === null) throw new Error('The name is not on the page.');
		const gap = barTop - (box.y + box.height);
		if (gap >= 0 && gap < 12) break;
		const travel = Math.max(-300, Math.min(300, gap - 4));
		const from = travel > 0 ? 150 : 450;
		await finger.touch('touchStart', [{ id: 1, x: 6, y: from }]);
		for (let move = 1; move <= 10; move++) {
			const y = from + ((travel + Math.sign(travel) * touchSlop) * move) / 10;
			await finger.touch('touchMove', [{ id: 1, x: 6, y }]);
		}
		await finger.touch('touchEnd', []);
		await settled(page);
	}
	await finger.detach();
	const placed = await target.boundingBox();
	if (placed === null) throw new Error('The name is not on the page.');
	const gap = barTop - (placed.y + placed.height);
	expect(gap, 'the name sits just above the tab bar').toBeGreaterThanOrEqual(0);
	expect(gap, 'the name sits just above the tab bar').toBeLessThan(12);
	await expect(target).toBeInViewport({ ratio: 1 });
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
				await reloadOnceSaved(page);
				const savings = page
					.getByRole('rowgroup')
					.filter({ has: page.getByRole('rowheader', { name: /Savings Goals/ }) });
				await expect(
					savings.getByRole('button', { name: 'Sample Bike Fund', exact: true })
				).toBeVisible();
			});

			await step('a new group needs its own name even when the Category is named', async () => {
				await openCategories(page);
				await page.getByRole('button', { name: 'Add Category', exact: true }).click();
				const addCategory = page.getByRole('dialog', { name: 'Add Category' });
				await choose(addCategory.getByLabel('Category Group'), 'New Category Group…');
				const groupName = addCategory.getByLabel('Group name');
				await expect(groupName).toBeFocused();
				await addCategory.getByLabel('Name', { exact: true }).fill('Smoke Test Category');
				await addCategory.getByRole('button', { name: 'Add' }).click();
				await expect(addCategory).toBeVisible();
				await expect(groupName).toBeFocused();
				expect(
					await groupName.evaluate((field: HTMLInputElement) => field.validity.valueMissing)
				).toBe(true);
				expect(
					await addCategory
						.getByLabel('Name', { exact: true })
						.evaluate((field: HTMLInputElement) => field.validity.valid)
				).toBe(true);
			});

			await step(
				'when the group is made but the Category is refused, a retry adds it to that same group',
				async () => {
					const addCategory = page.getByRole('dialog', { name: 'Add Category' });
					await addCategory.getByLabel('Group name').fill('Smoke Test Group');
					const spacesPassTheFormButNotTheServer = '   ';
					await addCategory
						.getByLabel('Name', { exact: true })
						.fill(spacesPassTheFormButNotTheServer);
					await addCategory.getByRole('button', { name: 'Add' }).click();
					await expect(addCategory.getByRole('alert')).toHaveText('Enter a name.');
					await expect(addCategory.getByLabel('Category Group')).toHaveText('Smoke Test Group');
					await expect(addCategory.getByLabel('Group name')).toBeHidden();
					await addCategory.getByLabel('Name', { exact: true }).fill('Smoke Test Category');
					await addCategory.getByRole('button', { name: 'Add' }).click();
					await expect(addCategory).toBeHidden();
					await reloadOnceSaved(page);
					await expect(groupOf(page, 'Smoke Test Group')).toHaveCount(1);
					await expect
						.poll(() => orderIn(groupOf(page, 'Smoke Test Group')))
						.toEqual(['Smoke Test Group', 'Smoke Test Category']);
				}
			);

			await step(
				'a name edited while the new group is still being made does not change the Category being added',
				async () => {
					const createdGroup = await holdResponseTo(page, 'categories:createGroup');
					await openCategories(page);
					await page.getByRole('button', { name: 'Add Category', exact: true }).click();
					const addCategory = page.getByRole('dialog', { name: 'Add Category' });
					await choose(addCategory.getByLabel('Category Group'), 'New Category Group…');
					await addCategory.getByLabel('Group name').fill('Sample Held Group');
					const name = addCategory.getByLabel('Name', { exact: true });
					await name.fill('Sample Submitted Category');
					await addCategory.getByRole('button', { name: 'Add' }).click();
					await createdGroup.held;
					await name.fill('Sample Edited Afterwards');
					createdGroup.release();
					await expect(addCategory).toBeHidden();
					await reloadOnceSaved(page);
					await expect
						.poll(() => orderIn(groupOf(page, 'Sample Held Group')))
						.toEqual(['Sample Held Group', 'Sample Submitted Category']);
					await expect(page.getByRole('button', { name: 'Sample Edited Afterwards' })).toHaveCount(
						0
					);
				}
			);

			await step('a click opens its menu on the first action', async () => {
				const trigger = page.getByRole('button', { name: 'Smoke Test Category actions' });
				await trigger.click();
				await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
				await page.keyboard.press('Escape');
				await expect(trigger).toBeFocused();
			});

			await step(
				'Rename edits the name in place; an empty name is refused on Enter and on leaving the field, Escape keeps the old one, an empty name left for another name stays unsaved, and a click on another name saves the one typed',
				async () => {
					await act(page, 'Smoke Test Category', 'Rename');
					const field = page.getByRole('textbox', { name: 'Category name' });
					const emptyName = page.getByRole('alert').filter({ hasText: 'Enter a name.' });
					await expect(field).toBeFocused();
					await expect(field).toHaveValue('Smoke Test Category');
					await field.fill('  ');
					await field.press('Enter');
					await expect(emptyName).toBeVisible();
					await field.press('Escape');
					const name = page.getByRole('button', { name: 'Smoke Test Category', exact: true });
					await expect(name).toBeFocused();

					await name.click();
					await field.fill('  ');
					await field.press('Tab');
					await expect(
						page.getByRole('button', { name: 'Smoke Test Category actions', exact: true })
					).toBeFocused();
					await expect(field).toHaveValue('  ');
					await expect(emptyName).toBeVisible();
					await field.click();
					await field.press('Escape');
					await expect(name).toBeFocused();
					await expect(emptyName).toHaveCount(0);

					await name.click();
					await field.fill('  ');
					await page.getByRole('button', { name: 'Smoke Test Group', exact: true }).click();
					const openedNext = page.getByRole('textbox', { name: 'Category Group name' });
					await expect(openedNext).toBeFocused();
					await expect(openedNext).toHaveValue('Smoke Test Group');
					await expect(emptyName).toHaveCount(0);
					await openedNext.press('Escape');
					await expect(name).toBeVisible();

					await name.click();
					await field.fill('Smoke Test Renamed');
					await page.getByRole('button', { name: 'Smoke Test Group', exact: true }).click();
					const groupField = page.getByRole('textbox', { name: 'Category Group name' });
					await expect(groupField).toBeFocused();
					await expect(groupField).toHaveValue('Smoke Test Group');
					await groupField.press('Escape');
					await expect(
						page.getByRole('button', { name: 'Smoke Test Renamed', exact: true })
					).toBeVisible();
					await expect(
						page.getByRole('button', { name: 'Move Smoke Test Renamed', exact: true })
					).toBeAttached();
					await reloadOnceSaved(page);
					await expect(
						page.getByRole('button', { name: 'Smoke Test Renamed', exact: true })
					).toBeVisible();
				}
			);

			await step(
				'an empty group name left by a held mouse press on the Category below it opens that Category, unchanged',
				async () => {
					await page.getByRole('button', { name: 'Everyday', exact: true }).click();
					const groupField = page.getByRole('textbox', { name: 'Category Group name' });
					await groupField.fill(' ');
					const below = page.getByRole('button', { name: 'Groceries', exact: true });
					await below.scrollIntoViewIfNeeded();
					const { x, y } = await centerOf(below);
					await page.mouse.move(x, y);
					await page.mouse.down();
					await settled(page);
					await page.mouse.up();
					const field = page.getByRole('textbox', { name: 'Category name' });
					await expect(field).toBeFocused();
					await expect(field).toHaveValue('Groceries');
					await expect(groupField).toBeHidden();
					await field.press('Escape');
					await reloadOnceSaved(page);
					await expect(groupOf(page, 'Everyday')).toBeVisible();
					await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toBeVisible();
				}
			);

			await step(
				'a name typed while a mouse press on its field is held is not saved by Escape after Tab and Shift+Tab, but is saved when left by Tab and the press ends',
				async () => {
					const field = page.getByRole('textbox', { name: 'Category name' });
					const holdOn = async (target: Locator) => {
						const { x, y } = await centerOf(target);
						await page.mouse.move(x, y);
						await page.mouse.down();
					};

					const groceries = page.getByRole('button', { name: 'Groceries', exact: true });
					await groceries.click();
					await field.fill('Groceries Cancelled');
					await holdOn(field);
					await page.keyboard.press('Tab');
					await expect(
						page.getByRole('button', { name: 'Groceries actions', exact: true })
					).toBeFocused();
					await page.keyboard.press('Shift+Tab');
					await expect(field).toBeFocused();
					await page.keyboard.press('Escape');
					await expect(field).toBeHidden();
					await page.mouse.up();
					await settled(page);
					await expect(groceries).toBeVisible();

					const transit = page.getByRole('button', { name: 'Transit', exact: true });
					await transit.click();
					await field.fill('Transit Held');
					await holdOn(field);
					await page.keyboard.press('Tab');
					await page.mouse.up();
					await expect(
						page.getByRole('button', { name: 'Transit Held', exact: true })
					).toBeVisible();

					await reloadOnceSaved(page);
					await expect(
						page.getByRole('button', { name: 'Transit Held', exact: true })
					).toBeVisible();
					await expect(groceries).toBeVisible();
					await expect(page.getByRole('button', { name: /^Groceries Cancelled/ })).toHaveCount(0);
				}
			);

			await step(
				'on a touch screen, a name scrolled to just above the tab bar and emptied keeps its field and reason clear of the bar, on Enter for a Category and on a tap beside it for a group, and Escape keeps the old names',
				async () => {
					await page.goto('about:blank');
					const stopTouching = await useATouchScreen(page);
					await openCategories(page);
					const emptyName = page.getByRole('alert').filter({ hasText: 'Enter a name.' });

					const carRepairs = page.getByRole('button', { name: 'Car Repairs', exact: true });
					await swipeJustAboveTheTabBar(page, carRepairs);
					await tap(page, carRepairs);
					const field = page.getByRole('textbox', { name: 'Category name' });
					await expect(field).toBeFocused();
					await field.fill('  ');
					await field.press('Enter');
					await expect(emptyName).toBeVisible();
					await expect(field).toBeFocused();
					await expect(field).toHaveValue('  ');
					await expectClearOf(field, tabBarOf(page));
					await expectClearOf(emptyName, tabBarOf(page));
					await field.press('Escape');
					await expect(carRepairs).toBeVisible();

					const savingsGoals = page.getByRole('button', { name: 'Savings Goals', exact: true });
					await swipeJustAboveTheTabBar(page, savingsGoals);
					await tap(page, savingsGoals);
					const groupField = page.getByRole('textbox', { name: 'Category Group name' });
					await expect(groupField).toBeFocused();
					await groupField.fill(' ');
					const { y } = await centerOf(groupField);
					const screen = await touchscreen(page);
					await screen.touch('touchStart', [{ id: 1, x: 6, y }]);
					await screen.touch('touchEnd', []);
					await screen.detach();
					await expect(emptyName).toBeVisible();
					await expect(groupField).not.toBeFocused();
					await expect(groupField).toHaveValue(' ');
					await expectClearOf(groupField, tabBarOf(page));
					await expectClearOf(emptyName, tabBarOf(page));
					await tap(page, groupField);
					await groupField.press('Escape');
					await expect(groupField).toBeHidden();

					await reloadOnceSaved(page);
					await expect(groupOf(page, 'Savings Goals')).toBeVisible();
					await expect(carRepairs).toBeAttached();
					await page.goto('about:blank');
					await stopTouching();
					await openCategories(page);
				}
			);

			await step(
				'a group is renamed in place from its name, saved by a tap on another name',
				async () => {
					await page.getByRole('button', { name: 'Smoke Test Group', exact: true }).click();
					const field = page.getByRole('textbox', { name: 'Category Group name' });
					await field.fill('Smoke Test Shelf');
					await tap(page, page.getByRole('button', { name: 'Smoke Test Renamed', exact: true }));
					const categoryField = page.getByRole('textbox', { name: 'Category name' });
					await expect(categoryField).toBeFocused();
					await expect(categoryField).toHaveValue('Smoke Test Renamed');
					await categoryField.press('Escape');
					await expect(
						page.getByRole('button', { name: 'Move Smoke Test Shelf', exact: true })
					).toBeAttached();
					await reloadOnceSaved(page);
					await expect(groupOf(page, 'Smoke Test Shelf')).toBeVisible();
				}
			);

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

			const moved = await step('open the Categories page at phone width', async () => {
				const held = await holdResponseTo(page, 'categories:move');
				await page.setViewportSize({ width: 320, height: 640 });
				await openCategories(page);
				await expect
					.poll(() => orderIn(everyday))
					.toEqual(['Everyday', 'Groceries', 'Dining Out', 'Coffee', 'Transit']);
				return held;
			});

			await step(
				'two ArrowUp presses on Coffee while its first save is unanswered move it twice at once, and both saves last',
				async () => {
					const handle = everyday.getByRole('button', { name: 'Move Coffee' });
					await handle.focus();
					await page.keyboard.press('ArrowUp');
					await moved.held;
					await page.keyboard.press('ArrowUp');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Coffee', 'Groceries', 'Dining Out', 'Transit']);
					await expect(handle).toBeFocused();
					moved.release();
					await expect(async () => {
						await reloadOnceSaved(page);
						await expect(everyday.getByRole('button', { name: /^Move / })).toHaveCount(5);
						expect(await orderIn(everyday)).toEqual([
							'Everyday',
							'Coffee',
							'Groceries',
							'Dining Out',
							'Transit'
						]);
					}).toPass();
				}
			);

			await step(
				'End and Home move Coffee, and its handle keeps focus at the group edge',
				async () => {
					const handle = everyday.getByRole('button', { name: 'Move Coffee' });
					await handle.focus();
					await page.keyboard.press('End');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Groceries', 'Dining Out', 'Transit', 'Coffee']);
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

			await step(
				'Home moves the Savings Goals group first and End moves it back last, its focused handle clear of the tab bar each time',
				async () => {
					const before = await groupOrder(page);
					const others = before.filter((name) => name !== 'Savings Goals');
					const handle = page.getByRole('button', { name: 'Move Savings Goals' });
					await handle.focus();
					await page.keyboard.press('Home');
					await expect.poll(() => groupOrder(page)).toEqual(['Savings Goals', ...others]);
					await expect(handle).toBeFocused();
					await expectClearOf(handle, tabBarOf(page));
					await page.keyboard.press('End');
					await expect.poll(() => groupOrder(page)).toEqual([...others, 'Savings Goals']);
					await expect(handle).toBeFocused();
					await expectClearOf(handle, tabBarOf(page));
				}
			);

			const coffeeRow = everyday
				.getByRole('listitem')
				.filter({ has: page.getByRole('button', { name: 'Move Coffee', exact: true }) });
			const coffeeHandle = everyday.getByRole('button', { name: 'Move Coffee', exact: true });
			const belowDiningOut = async () => {
				const box = await everyday
					.getByRole('listitem')
					.filter({ has: page.getByRole('button', { name: 'Move Dining Out', exact: true }) })
					.boundingBox();
				if (box === null) throw new Error('Dining Out is not on screen.');
				return box.y + box.height * 0.8;
			};

			await step(
				'a finger drag the browser cancels moves nothing and puts Coffee back',
				async () => {
					await coffeeHandle.scrollIntoViewIfNeeded();
					const rest = await centerOf(coffeeRow);
					const handle = await centerOf(coffeeHandle);
					const to = await belowDiningOut();
					const screen = await touchscreen(page);
					await screen.touch('touchStart', [{ id: 1, x: handle.x, y: handle.y }]);
					for (let at = 1; at <= 6; at++) {
						await screen.touch('touchMove', [
							{ id: 1, x: handle.x, y: handle.y + ((to - handle.y) * at) / 6 }
						]);
					}
					await expect
						.poll(async () => (await centerOf(coffeeRow)).top)
						.toBeGreaterThan(rest.top + 40);
					await screen.touch('touchCancel', []);
					await screen.detach();
					await expect.poll(async () => (await centerOf(coffeeRow)).top).toBe(rest.top);
					expect(await orderIn(everyday)).toEqual([
						'Everyday',
						'Coffee',
						'Groceries',
						'Dining Out',
						'Transit'
					]);
				}
			);

			await step('Escape during a drag moves nothing and puts Coffee back', async () => {
				const rest = await centerOf(coffeeRow);
				const handle = await centerOf(coffeeHandle);
				await page.mouse.move(handle.x, handle.y);
				await page.mouse.down();
				await page.mouse.move(handle.x, await belowDiningOut(), { steps: 6 });
				await expect
					.poll(async () => (await centerOf(coffeeRow)).top)
					.toBeGreaterThan(rest.top + 40);
				await page.keyboard.press('Escape');
				await page.mouse.up();
				await expect.poll(async () => (await centerOf(coffeeRow)).top).toBe(rest.top);
				expect(await orderIn(everyday)).toEqual([
					'Everyday',
					'Coffee',
					'Groceries',
					'Dining Out',
					'Transit'
				]);
			});

			await step(
				"a second finger tapping Coffee's handle mid-drag leaves the first finger to drop it",
				async () => {
					const handle = await centerOf(coffeeHandle);
					const to = await belowDiningOut();
					const first = (y: number): Finger => ({ id: 1, x: handle.x, y });
					const screen = await touchscreen(page);
					await screen.touch('touchStart', [first(handle.y)]);
					await screen.touch('touchMove', [first(handle.y + (to - handle.y) / 2)]);
					const lifted = await centerOf(coffeeHandle);
					const second: Finger = { id: 2, x: lifted.x + 4, y: lifted.y };
					await screen.touch('touchStart', [first(handle.y + (to - handle.y) / 2), second]);
					await screen.touch('touchEnd', [second]);
					for (let at = 3; at <= 6; at++) {
						await screen.touch('touchMove', [first(handle.y + ((to - handle.y) * at) / 6)]);
					}
					await screen.touch('touchEnd', []);
					await screen.detach();
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Groceries', 'Dining Out', 'Coffee', 'Transit']);
				}
			);

			const touchedOrder = await step<string[]>(
				'a finger holding a group near the bottom edge scrolls to a group off screen and drops it last',
				async () => {
					const before = await groupOrder(page);
					const [first] = before;
					if (first === undefined) throw new Error('The fixture has no Category Groups.');
					await page
						.getByRole('heading', { level: 1, name: 'Categories' })
						.scrollIntoViewIfNeeded();
					const lastHandle = page.getByRole('button', { name: /^Move / }).last();
					await expect(lastHandle).not.toBeInViewport();
					await touchDragToTheBottomEdge(
						page,
						page.getByRole('button', { name: `Move ${first}`, exact: true }),
						lastHandle
					);
					const after = [...before.slice(1), first];
					await expect.poll(() => groupOrder(page)).toEqual(after);
					return after;
				}
			);

			await step('dragging Transit by its handle onto the first row puts it first', async () => {
				await page.setViewportSize({ width: 1280, height: 800 });
				await drag(
					page,
					everyday.getByRole('button', { name: 'Move Transit' }),
					everyday.getByRole('listitem').first()
				);
				await expect
					.poll(() => orderIn(everyday))
					.toEqual(['Everyday', 'Transit', 'Groceries', 'Dining Out', 'Coffee']);
			});

			await step('a reload and the Budget keep the new order', async () => {
				await reloadOnceSaved(page);
				await expect
					.poll(() => orderIn(everyday))
					.toEqual(['Everyday', 'Transit', 'Groceries', 'Dining Out', 'Coffee']);
				expect(await groupOrder(page)).toEqual(touchedOrder);
				await openBudget(page);
				const rows = page
					.getByRole('rowgroup')
					.filter({ has: page.getByRole('rowheader', { name: /^Everyday/ }) })
					.locator('[data-category-id]');
				await expect(rows).toHaveText(['Transit', 'Groceries', 'Dining Out', 'Coffee']);
			});

			const refused = "Budge couldn't save that. Try again.";
			const lasts = async (order: () => Promise<string[]>, expected: string[]) => {
				await expect(async () => {
					await reloadOnceSaved(page);
					await expect(everyday.getByRole('button', { name: /^Move / })).toHaveCount(5);
					expect(await order()).toEqual(expected);
				}).toPass();
			};

			await step(
				'a refused Coffee or Everyday move puts it back with its reason beside it and keeps its handle, so the same key tries again and lasts',
				async () => {
					const server = await failFirstCallTo(page, 'categories:move', 'categories:moveGroup');
					await openCategories(page);
					await coffeeHandle.focus();
					await page.keyboard.press('ArrowUp');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Transit', 'Groceries', 'Coffee', 'Dining Out']);
					await server.called('categories:move');
					server.failWithServerError('categories:move');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Transit', 'Groceries', 'Dining Out', 'Coffee']);
					await expect(coffeeRow.getByRole('alert')).toHaveText(refused);
					await expect(coffeeRow.getByRole('alert')).toBeInViewport();
					await expect(coffeeHandle).toBeFocused();
					await page.keyboard.press('ArrowUp');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Transit', 'Groceries', 'Coffee', 'Dining Out']);
					await expect(page.getByRole('alert').filter({ hasText: refused })).toHaveCount(0);
					await expect(coffeeHandle).toBeFocused();

					const everydayHandle = page.getByRole('button', { name: 'Move Everyday' });
					const before = await groupOrder(page);
					const at = before.indexOf('Everyday');
					const [key, to] = at === 0 ? (['ArrowDown', 1] as const) : (['ArrowUp', at - 1] as const);
					const moved = before.toSpliced(at, 1).toSpliced(to, 0, 'Everyday');
					await everydayHandle.focus();
					await page.keyboard.press(key);
					await expect.poll(() => groupOrder(page)).toEqual(moved);
					await server.called('categories:moveGroup');
					server.failWithServerError('categories:moveGroup');
					await expect.poll(() => groupOrder(page)).toEqual(before);
					await expect(everyday.getByRole('alert')).toHaveText(refused);
					await expect(everyday.getByRole('alert')).toBeInViewport();
					await expect(everydayHandle).toBeFocused();
					await page.keyboard.press(key);
					await expect.poll(() => groupOrder(page)).toEqual(moved);
					await expect(page.getByRole('alert').filter({ hasText: refused })).toHaveCount(0);
					await expect(everydayHandle).toBeFocused();

					await lasts(
						async () => [...(await groupOrder(page)), ...(await orderIn(everyday))],
						[...moved, 'Everyday', 'Transit', 'Groceries', 'Coffee', 'Dining Out']
					);
				}
			);

			await step(
				'a move refused after focus went on to the name leaves focus on the name',
				async () => {
					const server = await failFirstCallTo(page, 'categories:move');
					await openCategories(page);
					const coffeeName = coffeeRow.getByRole('button', { name: 'Coffee', exact: true });
					await coffeeHandle.focus();
					await page.keyboard.press('ArrowUp');
					await server.called('categories:move');
					await page.keyboard.press('Tab');
					await expect(coffeeName).toBeFocused();
					server.failWithServerError('categories:move');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Transit', 'Groceries', 'Coffee', 'Dining Out']);
					await expect(coffeeRow.getByRole('alert')).toHaveText(refused);
					await expect(coffeeName).toBeFocused();
				}
			);

			await step(
				'on a phone, a name being typed when its own Category or group move is refused keeps its field, draft and focus in view with the reason, and nothing is renamed until the field is left',
				async () => {
					const server = await failFirstCallTo(page, 'categories:move', 'categories:moveGroup');
					await page.setViewportSize({ width: 320, height: 640 });
					const stopTouching = await useATouchScreen(page);
					await openCategories(page);
					await coffeeHandle.focus();
					await page.keyboard.press('ArrowUp');
					await server.called('categories:move');
					await coffeeRow.getByRole('button', { name: 'Coffee', exact: true }).click();
					const categoryField = page.getByRole('textbox', { name: 'Category name' });
					await categoryField.fill('Morning Coffee');
					server.failWithServerError('categories:move');
					await expect
						.poll(() => orderIn(everyday))
						.toEqual(['Everyday', 'Transit', 'Groceries', 'Coffee', 'Dining Out']);
					await expect(coffeeRow.getByRole('alert')).toHaveText(refused);
					await expect(categoryField).toBeFocused();
					await expect(categoryField).toHaveValue('Morning Coffee');
					await expectClearOf(categoryField, tabBarOf(page));
					await expectClearOf(coffeeRow.getByRole('alert'), tabBarOf(page));
					await categoryField.press('Escape');
					await expect(
						coffeeRow.getByRole('button', { name: 'Coffee', exact: true })
					).toBeVisible();

					await openCategories(page);
					const groups = await groupOrder(page);
					const last = groups.at(-1) ?? '';
					const lastHandle = page.getByRole('button', { name: `Move ${last}`, exact: true });
					await lastHandle.focus();
					await page.keyboard.press('ArrowUp');
					await server.called('categories:moveGroup');
					await expect(lastHandle).toBeFocused();
					await expectClearOf(lastHandle, tabBarOf(page));
					await tap(page, page.getByRole('button', { name: last, exact: true }));
					const groupField = page.getByRole('textbox', { name: 'Category Group name' });
					await groupField.fill('Rainy Day Fund');
					server.failWithServerError('categories:moveGroup');
					const groupRefusal = page
						.getByRole('region')
						.filter({ has: groupField })
						.getByRole('alert');
					await expect(groupRefusal).toHaveText(refused);
					await expect(
						page
							.getByRole('main')
							.getByRole('region')
							.last()
							.getByRole('button', { name: `Move ${last}`, exact: true })
					).toBeVisible();
					await expect(groupField).toBeFocused();
					await expect(groupField).toHaveValue('Rainy Day Fund');
					await expectClearOf(groupField, tabBarOf(page));
					await expectClearOf(groupRefusal, tabBarOf(page));
					await groupField.press('Tab');
					await expect(groupField).toBeHidden();
					await stopTouching();
					const renamed = groups.with(-1, 'Rainy Day Fund');
					await expect.poll(() => groupOrder(page)).toEqual(renamed);

					await reloadOnceSaved(page);
					await expect.poll(() => groupOrder(page)).toEqual(renamed);
					expect(await orderIn(everyday)).toEqual([
						'Everyday',
						'Transit',
						'Groceries',
						'Coffee',
						'Dining Out'
					]);
					await openBudget(page);
					await expect(page.getByRole('rowheader', { name: /^Rainy Day Fund/ })).toBeVisible();
					await expect(
						page
							.getByRole('rowgroup')
							.filter({ has: page.getByRole('rowheader', { name: /^Everyday/ }) })
							.locator('[data-category-id]')
					).toHaveText(['Transit', 'Groceries', 'Coffee', 'Dining Out']);
				}
			);
		}
	},
	'late-rename': {
		title:
			'a rename still on its way neither overwrites a name being typed nor wins over a later rename',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const renamed = await holdResponseTo(page, 'categories:rename');
			const field = page.getByRole('textbox', { name: 'Category name' });
			const named = (name: string) => page.getByRole('button', { name, exact: true });
			const handleOf = (name: string) =>
				page.getByRole('button', { name: `Move ${name}`, exact: true });

			await step('rename Groceries in place and hold the save', async () => {
				await openCategories(page);
				await named('Groceries').click();
				await field.fill('Sample Slow Groceries');
				await field.press('Enter');
				await renamed.held;
				await expect(named('Sample Slow Groceries')).toBeFocused();
			});

			await step(
				'the held save landing while another name is being typed leaves that name in the field',
				async () => {
					await named('Sample Slow Groceries').click();
					await expect(field).toHaveValue('Sample Slow Groceries');
					await field.fill('Sample Typed Groceries');
					renamed.landEarliest();
					await expect(handleOf('Sample Slow Groceries')).toBeVisible();
					await settled(page);
					await expect(field).toHaveValue('Sample Typed Groceries');
					await expect(field).toBeFocused();
					await field.press('Enter');
					await expect(named('Sample Typed Groceries')).toBeFocused();
				}
			);

			await step('rename it again while that save is held', async () => {
				await named('Sample Typed Groceries').click();
				await expect(field).toHaveValue('Sample Typed Groceries');
				await field.fill('Sample Fast Groceries');
				await field.press('Enter');
			});

			await step('the earlier save landing does not bring back its name', async () => {
				renamed.landEarliest();
				await expect(handleOf('Sample Typed Groceries')).toBeVisible();
				await settled(page);
				await expect(named('Sample Fast Groceries')).toBeVisible();
				await expect(named('Sample Typed Groceries')).toHaveCount(0);
			});

			await step('the name typed last stays, after a reload too', async () => {
				renamed.release();
				await expect(named('Sample Fast Groceries')).toBeVisible();
				await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
				await reloadOnceSaved(page);
				await expect(named('Sample Fast Groceries')).toBeVisible();
			});
		}
	},
	'failed-rename': {
		title:
			'a rename the server fails reopens its own name to retry, without taking over a name being typed in another row, at 320 px',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const server = await failFirstCallTo(page, 'categories:rename', 'categories:renameGroup');
			const categoryField = page.getByRole('textbox', { name: 'Category name' });
			const groupField = page.getByRole('textbox', { name: 'Category Group name' });
			const named = (name: string) => page.getByRole('button', { name, exact: true });
			const rowOf = (name: string) =>
				page
					.getByRole('listitem')
					.filter({ has: page.getByRole('button', { name: `Move ${name}`, exact: true }) });
			const failure = "Budge couldn't rename it. Try again.";

			await step(
				'rename the Everyday group; when its save fails the name reopens with it',
				async () => {
					await page.setViewportSize({ width: 320, height: 640 });
					await openCategories(page);
					await named('Everyday').click();
					await groupField.fill('Sample Refused Everyday');
					await groupField.press('Enter');
					await server.called('categories:renameGroup');
					server.failWithServerError('categories:renameGroup');
					await expect(groupField).toHaveValue('Sample Refused Everyday');
					await expect(groupField).toBeFocused();
					await expect(groupField).toHaveAccessibleDescription(failure);
					await groupField.press('Escape');
					await expect(named('Everyday')).toBeFocused();
				}
			);

			await step(
				'rename Groceries, then start typing a name for Coffee before the save answers',
				async () => {
					await named('Groceries').click();
					await categoryField.fill('Sample Refused Groceries');
					await categoryField.press('Enter');
					await server.called('categories:rename');
					await named('Coffee').click();
					await categoryField.fill('Sample Typed Coffee');
				}
			);

			await step(
				'the Groceries save failing keeps the Coffee name being typed and shows the failure on Groceries',
				async () => {
					server.failWithServerError('categories:rename');
					await expect(rowOf('Groceries').getByRole('alert')).toHaveText(failure);
					await expect(named('Groceries')).toBeVisible();
					await expectNothingPastTheRightEdge(page);
					await settled(page);
					await expect(categoryField).toHaveCount(1);
					await expect(categoryField).toHaveValue('Sample Typed Coffee');
					await expect(categoryField).toBeFocused();
				}
			);

			await step('Enter saves the Coffee name; the Groceries failure stays beside it', async () => {
				await categoryField.press('Enter');
				await expect(named('Sample Typed Coffee')).toBeFocused();
				await expect(rowOf('Groceries').getByRole('alert')).toHaveText(failure);
			});

			await step(
				'Groceries reopens with the name that failed, and saving it again works',
				async () => {
					await named('Groceries').click();
					await expect(categoryField).toHaveValue('Sample Refused Groceries');
					await expect(categoryField).toHaveAccessibleDescription(failure);
					await categoryField.press('Enter');
					await expect(named('Sample Refused Groceries')).toBeFocused();
					await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
				}
			);

			await step('a reload keeps both saved names and the group name that failed', async () => {
				await reloadOnceSaved(page);
				await expect(named('Sample Refused Groceries')).toBeVisible();
				await expect(named('Sample Typed Coffee')).toBeVisible();
				await expect(named('Everyday')).toBeVisible();
			});

			await step(
				'a group save failing above a Category name being typed shows the failure without pushing that field under the tab bar',
				async () => {
					const later = await failFirstCallTo(page, 'categories:renameGroup');
					await openCategories(page);
					await tap(page, named('Everyday'));
					await groupField.fill('Sample Refused Again');
					await groupField.press('Enter');
					await later.called('categories:renameGroup');
					await tap(page, named('Sample Refused Groceries'));
					await categoryField.fill('Sample Typed Groceries');
					later.failWithServerError('categories:renameGroup');
					const groupFailure = page
						.getByRole('region')
						.filter({ has: page.getByRole('button', { name: 'Move Everyday', exact: true }) })
						.getByRole('heading')
						.getByRole('alert');
					await expect(groupFailure).toHaveText(failure);
					await expect(categoryField).toBeFocused();
					await expect(categoryField).toHaveValue('Sample Typed Groceries');
					await expectClearOf(categoryField, tabBarOf(page));
					await categoryField.press('Escape');
					await expect(named('Sample Refused Groceries')).toBeFocused();
				}
			);
		}
	}
} satisfies Record<string, Journey>;
