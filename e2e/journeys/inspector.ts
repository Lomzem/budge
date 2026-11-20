import { expect, type Page } from '@playwright/test';

import { formatCents } from '../../src/lib/domain/money';
import { failFirstCallTo, holdResponseTo, pausableSync } from '../heldResponse';
import {
	cents,
	centsIn,
	choicesOf,
	choose,
	openBudget,
	tap,
	typed,
	useATouchScreen,
	reloadOnceSaved,
	type Journey
} from './journey';

export const inspector = {
	'move-money': {
		title:
			'the inspector moves money by keyboard, and opens as a dialog on a phone that steps between Categories',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const readyToAssign = () => centsIn(page.getByTestId('ready-to-assign'));
			const assigned = async (name: string) =>
				cents(await page.getByRole('textbox', { name: `Assigned for ${name}` }).inputValue());
			const groceries = page.getByRole('button', { name: 'Groceries', exact: true });
			const region = page.getByRole('region', { name: 'Groceries' });
			const sync = await pausableSync(page);

			await step('Enter on Groceries opens its inspector, focused', async () => {
				await openBudget(page);
				await groceries.focus();
				await page.keyboard.press('Enter');
				await expect(region).toBeFocused();
				await expect(region.getByText('Left over from last month')).toBeVisible();
			});

			const before = {
				readyToAssign: await readyToAssign(),
				groceries: await assigned('Groceries'),
				coffee: await assigned('Coffee')
			};
			const move = async () => {
				await choose(region.getByRole('button', { name: /^(From|To)$/ }), /^Coffee \(/);
				await expect(region.getByLabel('Amount')).toBeFocused();
				await region.getByLabel('Amount').fill(typed(1_000));
				await region.getByLabel('Amount').press('Enter');
			};

			await step('Move money reads From another Category To this one, then swaps', async () => {
				await expect(region.getByRole('button', { name: 'From', exact: true })).toBeVisible();
				await expect(region.getByLabel('To', { exact: true })).toHaveText('Groceries');
				await region.getByRole('button', { name: 'Swap From and To' }).click();
				await expect(region.getByLabel('From', { exact: true })).toHaveText('Groceries');
				await expect(region.getByRole('button', { name: 'To', exact: true })).toBeVisible();
			});

			await step(
				'the To picker is searchable, and moving $10 to Coffee leaves Ready to Assign alone',
				async () => {
					await region.getByRole('button', { name: 'To', exact: true }).click();
					await page.getByRole('combobox', { name: 'Search Categories' }).fill('cof');
					await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
					await page.keyboard.press('Escape');
					await move();
					await expect.poll(() => assigned('Groceries')).toBe(before.groceries - 1_000);
					await expect.poll(() => assigned('Coffee')).toBe(before.coffee + 1_000);
					expect(await readyToAssign()).toBe(before.readyToAssign);
					await expect(region.getByRole('status')).toHaveText(
						'Moved $10.00 from Groceries to Coffee.'
					);
				}
			);

			await step('swapped back, From Coffee moves it back', async () => {
				await region.getByRole('button', { name: 'Swap From and To' }).click();
				await move();
				await expect.poll(() => assigned('Groceries')).toBe(before.groceries);
				await expect.poll(() => assigned('Coffee')).toBe(before.coffee);
			});

			await step(
				'a move still on its way keeps the From, To and amount it was sent with through a swap, and a newer amount typed meanwhile',
				async () => {
					const send = region.getByRole('button', { name: 'Move', exact: true });
					await region.getByRole('button', { name: 'Swap From and To' }).click();
					await choose(region.getByRole('button', { name: 'To', exact: true }), /^Coffee \(/);
					await region.getByLabel('Amount').fill(typed(1_000));
					sync.pause();
					await region.getByLabel('Amount').press('Enter');
					await expect(send).toBeDisabled();
					await region.getByRole('button', { name: 'Swap From and To' }).click();
					await expect(region.getByLabel('To', { exact: true })).toHaveText('Groceries');
					await region.getByLabel('Amount').fill('7.00');
					sync.resume();
					await expect(region.getByRole('status')).toHaveText(
						'Moved $10.00 from Groceries to Coffee.'
					);
					await expect(send).toBeEnabled();
					await expect(region.getByLabel('Amount')).toHaveValue('7.00');
					await expect.poll(() => assigned('Groceries')).toBe(before.groceries - 1_000);
					await expect.poll(() => assigned('Coffee')).toBe(before.coffee + 1_000);
					await reloadOnceSaved(page);
					await expect.poll(() => assigned('Groceries')).toBe(before.groceries - 1_000);
					await expect.poll(() => assigned('Coffee')).toBe(before.coffee + 1_000);
					await groceries.click();
					await expect(region).toBeFocused();
					await move();
					await expect(region.getByRole('status')).toHaveText(
						'Moved $10.00 from Coffee to Groceries.'
					);
					await expect.poll(() => assigned('Groceries')).toBe(before.groceries);
					await expect.poll(() => assigned('Coffee')).toBe(before.coffee);
				}
			);

			await step(
				'a click on Coffee while the inspector menu is open only closes the menu, and the started move stays',
				async () => {
					await region.getByLabel('Amount').fill('13.25');
					await region.getByRole('button', { name: 'Groceries actions' }).click();
					await expect(page.getByRole('menu')).toBeVisible();
					await page.getByRole('button', { name: 'Coffee', exact: true }).click();
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(page.getByRole('region', { name: 'Coffee' })).toHaveCount(0);
					await expect(region.getByLabel('Amount')).toHaveValue('13.25');
				}
			);

			await step(
				'an Escape still inside the inspector as Delete opens closes only Delete, and the started move stays',
				async () => {
					const actions = region.getByRole('button', { name: 'Groceries actions' });
					await actions.click();
					await page.getByRole('menuitem', { name: 'Delete…' }).click();
					const deleting = page.getByRole('dialog', { name: 'Delete Groceries' });
					await expect(deleting).toBeVisible();
					await actions.dispatchEvent('keydown', { key: 'Escape', bubbles: true });
					await expect(deleting).toHaveCount(0);
					await expect(region).toBeVisible();
					await expect(region.getByLabel('Amount')).toHaveValue('13.25');
				}
			);

			await step('a Category with no amount is refused and nothing moves', async () => {
				await region.getByLabel('Amount').fill('');
				await region.getByLabel('Amount').press('Enter');
				await expect(region.getByRole('alert')).toHaveText(
					'Enter an amount above zero, such as 25.00.'
				);
				await expect(region.getByLabel('Amount')).toBeFocused();
				expect(await assigned('Coffee')).toBe(before.coffee);
			});

			await step(
				'Escape clears a started move and leaves the inspector open; Clear does the same by pointer',
				async () => {
					const from = region.getByRole('button', { name: 'From', exact: true });
					await region.getByLabel('Amount').fill('5.00');
					await region.getByLabel('Amount').press('Escape');
					await expect(region).toBeVisible();
					await expect(region.getByLabel('Amount')).toHaveValue('');
					await expect(from).toContainText('Pick a Category');
					await expect(from).toBeFocused();
					await expect(region.getByRole('alert')).toHaveCount(0);
					await choose(from, /^Coffee \(/);
					await region.getByLabel('Amount').fill('5.00');
					await region.getByRole('button', { name: 'Clear', exact: true }).click();
					await expect(region.getByLabel('Amount')).toHaveValue('');
					await expect(from).toContainText('Pick a Category');
					await expect(from).toBeFocused();
					await expect(region.getByRole('button', { name: 'Clear', exact: true })).toHaveCount(0);
					expect(await assigned('Coffee')).toBe(before.coffee);
				}
			);

			await step(
				'while the next month loads, the inspector takes no input, then takes it again',
				async () => {
					const amount = region.getByLabel('Amount');
					sync.pause();
					await page.getByRole('button', { name: 'Next month', exact: true }).click();
					await amount.focus();
					await expect(amount).not.toBeFocused();
					sync.resume();
					await expect(async () => {
						await amount.focus();
						await expect(amount).toBeFocused({ timeout: 100 });
					}).toPass();
					await page.getByRole('button', { name: 'Previous month', exact: true }).click();
				}
			);

			await step('on a phone the same inspector opens as a dialog over the Budget', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				const dialog = page.getByRole('dialog', { name: 'Groceries' });
				await expect(dialog).toBeVisible();
				await expect(dialog.getByRole('region', { name: 'Groceries' })).toBeVisible();
				await dialog.getByRole('button', { name: 'Close Groceries' }).click();
				await expect(dialog).toBeHidden();
				await expect(groceries).toBeFocused();
			});

			await step('Escape closes the phone inspector and returns to Groceries', async () => {
				await groceries.click();
				await expect(region).toBeFocused();
				await page.keyboard.press('Escape');
				await expect(region).toBeHidden();
				await expect(groceries).toBeFocused();
			});

			await step(
				'on a phone, Escape clears a started move and keeps the inspector open; a second Escape closes it',
				async () => {
					const dialog = page.getByRole('dialog', { name: 'Groceries' });
					const from = dialog.getByRole('button', { name: 'From', exact: true });
					const amount = dialog.getByLabel('Amount');
					await groceries.click();
					await choose(from, /^Coffee \(/);
					await amount.press('Enter');
					await expect(dialog.getByRole('alert')).toHaveText(
						'Enter an amount above zero, such as 25.00.'
					);
					await amount.fill('5.00');
					await amount.press('Escape');
					await expect(dialog).toBeVisible();
					await expect(amount).toHaveValue('');
					await expect(from).toContainText('Pick a Category');
					await expect(dialog.getByRole('alert')).toHaveCount(0);
					await expect(from).toBeFocused();
					await expect(dialog.getByRole('region', { name: 'Groceries' })).toBeVisible();
					await page.keyboard.press('Escape');
					await expect(dialog).toBeHidden();
					await expect(groceries).toBeFocused();
					expect(await assigned('Coffee')).toBe(before.coffee);
				}
			);

			await step(
				'on a phone, a click on Move with the inspector ⋯ menu open only closes the menu, and the started move stays',
				async () => {
					const dialog = page.getByRole('dialog', { name: 'Groceries' });
					const amount = dialog.getByLabel('Amount');
					await groceries.click();
					await choose(dialog.getByRole('button', { name: 'From', exact: true }), /^Coffee \(/);
					await amount.fill('5.00');
					const move = await dialog
						.getByRole('button', { name: 'Move', exact: true })
						.boundingBox();
					if (!move) throw new Error('Move has no box');
					const actions = dialog.getByRole('button', { name: 'Groceries actions' });
					await actions.click();
					await expect(page.getByRole('menu')).toBeVisible();
					await page.mouse.click(move.x + move.width / 2, move.y + move.height / 2);
					await expect(page.getByRole('menu')).toHaveCount(0);
					await expect(actions).toBeFocused();
					await expect(amount).toHaveValue('5.00');
					expect(await assigned('Coffee')).toBe(before.coffee);
					await amount.press('Escape');
					await page.keyboard.press('Escape');
					await expect(dialog).toBeHidden();
				}
			);

			await step(
				'the phone inspector steps to the next Category and focuses its Assigned field',
				async () => {
					await groceries.click();
					await page
						.getByRole('dialog')
						.getByRole('button', { name: 'Next Category: Dining Out' })
						.click();
					const stepped = page.getByRole('dialog', { name: 'Dining Out' });
					await expect(stepped.getByLabel('Assigned this month')).toBeFocused();
					await stepped.getByRole('button', { name: 'Previous Category: Groceries' }).click();
					await expect(
						page.getByRole('dialog', { name: 'Groceries' }).getByLabel('Assigned this month')
					).toBeFocused();
				}
			);
		}
	},
	'cover-and-manage': {
		title:
			'the inspector covers overspending from another Category and renames, regroups, hides and deletes its Category in place',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const readyToAssign = () => centsIn(page.getByTestId('ready-to-assign'));
			const opened = page.locator('[aria-controls="category-inspector"]');
			const inspector = page.locator('#category-inspector');
			const rowgroup = (group: string) =>
				page
					.getByRole('rowgroup')
					.filter({ has: page.getByRole('rowheader', { name: new RegExp(`^${group}`) }) });
			const cellsOf = (name: string) =>
				page
					.getByRole('row')
					.filter({ has: page.getByRole('button', { name, exact: true }) })
					.getByRole('cell');
			const activity = (name: string) => centsIn(cellsOf(name).nth(2));
			const available = (name: string) => centsIn(cellsOf(name).nth(3));
			const sync = await pausableSync(page);
			const expectEveryday = async (names: string[], gone: string[]) => {
				const everyday = rowgroup('Everyday');
				for (const name of names) {
					await expect(everyday.getByRole('button', { name, exact: true })).toBeVisible();
				}
				for (const name of gone) {
					await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
				}
			};

			const overspent = await step('open the first overspent Category', async () => {
				await openBudget(page);
				await page
					.getByRole('region', { name: 'Needs you', exact: true })
					.getByRole('button', { name: /overspent$/ })
					.click();
				await expect(opened).toHaveCount(1);
				const name = (await opened.textContent())?.trim() ?? '';
				await expect(inspector).toContainText('Overspent by');
				return name;
			});
			const before = await readyToAssign();

			await step(
				'Cover from another Category fills the shortfall and asks where it comes from',
				async () => {
					await expect(
						inspector.getByRole('button', { name: /^Cover .* from Ready to Assign$/ })
					).toBeVisible();
					await inspector.getByRole('button', { name: 'Cover from another Category' }).click();
					const from = inspector.getByRole('button', { name: 'From', exact: true });
					await expect(from).toBeFocused();
					const overspentBy = await available(overspent);
					expect(overspentBy).toBeLessThan(0);
					const shortfall = cents(await inspector.getByLabel('Amount').inputValue());
					expect(shortfall).toBe(-overspentBy);
					const richest = (await choicesOf(from))
						.map((label) => ({ label, available: cents(/\((.*)\)$/.exec(label)?.[1] ?? '') }))
						.sort((a, b) => b.available - a.available)[0];
					if (richest === undefined || richest.available < shortfall) {
						throw new Error('The fixture has no Category that can cover the shortfall.');
					}
					const donor = richest.label.replace(/ \(.*\)$/, '');
					const donorBefore = await available(donor);
					await choose(from, richest.label);
					await inspector.getByLabel('Amount').press('Enter');
					await expect(inspector).not.toContainText('Overspent by');
					await expect.poll(() => available(overspent)).toBe(0);
					await expect.poll(() => available(donor)).toBe(donorBefore - shortfall);
					await expect(inspector.getByRole('status')).toHaveText(
						`Moved ${formatCents(shortfall)} from ${donor} to ${overspent}.`
					);
					await expect(
						inspector.getByRole('button', { name: 'Cover from another Category' })
					).toHaveCount(0);
					expect(await readyToAssign()).toBe(before);
					await reloadOnceSaved(page);
					await page.getByRole('button', { name: overspent, exact: true }).click();
					await expect(inspector).not.toContainText('Overspent by');
				}
			);

			await step(
				'Cover from Ready to Assign takes the shortfall the server finds, after another tab spent $5 more, and says how much',
				async () => {
					await page
						.getByRole('region', { name: 'Needs you', exact: true })
						.getByRole('button', { name: /overspent$/ })
						.first()
						.click();
					const name = (await opened.textContent())?.trim() ?? '';
					const shortfall = -(await available(name));
					expect(shortfall).toBeGreaterThan(0);
					const ready = await readyToAssign();
					const assignedField = (shown: Page) =>
						shown.getByRole('textbox', { name: `Assigned for ${name}`, exact: true });
					const assigned = cents(await assignedField(page).inputValue());

					sync.pause();
					const otherTab = await page.context().newPage();
					await openBudget(otherTab);
					await assignedField(otherTab).fill(typed(assigned - 500));
					await assignedField(otherTab).press('Enter');
					await expect
						.poll(() =>
							centsIn(
								otherTab
									.getByRole('row')
									.filter({ has: otherTab.getByRole('button', { name, exact: true }) })
									.getByRole('cell')
									.nth(3)
							)
						)
						.toBe(-(shortfall + 500));
					await otherTab.close();

					await inspector
						.getByRole('button', { name: `Cover ${formatCents(shortfall)} from Ready to Assign` })
						.click();
					sync.resume();
					await expect(inspector.getByRole('status')).toHaveText(
						`Covered ${formatCents(shortfall + 500)} for ${name} from Ready to Assign.`
					);
					await expect.poll(() => available(name)).toBe(0);
					await expect(assignedField(page)).toHaveValue(typed(assigned + shortfall));
					await expect.poll(() => readyToAssign()).toBe(ready - shortfall);
					await reloadOnceSaved(page);
					await expect(assignedField(page)).toHaveValue(typed(assigned + shortfall));
					await expect.poll(() => available(name)).toBe(0);
					expect(await readyToAssign()).toBe(ready - shortfall);
				}
			);

			await step(
				'a name left by clicking another Category goes to the Category it was typed for, also after a refusal, and the clicked one opens untouched',
				async () => {
					const server = await failFirstCallTo(page, 'categories:rename');
					await openBudget(page);
					await page.getByRole('button', { name: 'Groceries', exact: true }).click();
					await inspector.getByRole('button', { name: 'Groceries actions' }).click();
					await page.getByRole('menuitem', { name: 'Rename' }).click();
					const field = inspector.getByRole('textbox', { name: 'Category name' });
					await field.fill('Sample Groceries');
					await field.press('Enter');
					await server.called('categories:rename');
					server.failWithServerError('categories:rename');
					await expect(inspector.getByRole('alert')).toBeVisible();
					await expect(field).toHaveValue('Sample Groceries');
					await field.click();
					await page.getByRole('button', { name: 'Coffee', exact: true }).click();
					await expect(inspector.getByRole('heading', { name: 'Coffee' })).toBeVisible();
					await expect(inspector).toBeFocused();
					await expect(inspector.getByRole('textbox', { name: 'Category name' })).toHaveCount(0);
					await expectEveryday(['Sample Groceries', 'Coffee'], ['Groceries']);
					await reloadOnceSaved(page);
					await expectEveryday(['Sample Groceries', 'Coffee'], ['Groceries']);
				}
			);

			await step(
				'on a phone, a name left by tapping Next Category goes to the Category it was typed for, and the next one opens untouched',
				async () => {
					await page.setViewportSize({ width: 320, height: 640 });
					const stopTouching = await useATouchScreen(page);
					await tap(page, page.getByRole('button', { name: 'Sample Groceries', exact: true }));
					const dialog = page.getByRole('dialog');
					await expect(dialog).toHaveAccessibleName('Sample Groceries');
					await tap(page, dialog.getByRole('button', { name: 'Sample Groceries actions' }));
					await tap(page, page.getByRole('menuitem', { name: 'Rename' }));
					const field = dialog.getByRole('textbox', { name: 'Category name' });
					await expect(field).toBeFocused();
					await field.fill('Sample Grocer');
					await tap(page, dialog.getByRole('button', { name: 'Next Category: Dining Out' }));
					const stepped = page.getByRole('dialog', { name: 'Dining Out' });
					await expect(stepped.getByLabel('Assigned this month')).toBeFocused();
					await expect(stepped.getByRole('textbox', { name: 'Category name' })).toHaveCount(0);
					await stopTouching();
					await page.setViewportSize({ width: 1280, height: 800 });
					await reloadOnceSaved(page);
					await expectEveryday(['Sample Grocer', 'Coffee', 'Dining Out'], ['Sample Groceries']);
				}
			);

			await step(
				'Rename in the inspector edits its heading in place, and keeps it named',
				async () => {
					await page.getByRole('button', { name: 'Sample Grocer', exact: true }).click();
					await inspector.getByRole('button', { name: 'Sample Grocer actions' }).click();
					await page.getByRole('menuitem', { name: 'Rename' }).click();
					const field = inspector.getByRole('textbox', { name: 'Category name' });
					await expect(field).toBeFocused();
					await expect(
						page.getByRole('region', { name: 'Sample Grocer', exact: true }).getByRole('textbox', {
							name: 'Category name'
						})
					).toBeFocused();
					await field.fill('Sample Market');
					await field.press('Enter');
					await expect(inspector.getByRole('heading', { name: 'Sample Market' })).toBeVisible();
					await expect(
						inspector.getByRole('button', { name: 'Sample Market actions' })
					).toBeFocused();
					await expect(
						rowgroup('Everyday').getByRole('button', { name: 'Sample Market', exact: true })
					).toBeVisible();
				}
			);

			await step(
				'Move to group into a collapsed Savings Goals opens that group to show it, and keeps it open',
				async () => {
					const savingsToggle = rowgroup('Savings Goals')
						.getByRole('rowheader')
						.getByRole('button', { name: /^Savings Goals(?! actions)/ });
					await savingsToggle.click();
					await expect(savingsToggle).toHaveAttribute('aria-expanded', 'false');
					const actions = inspector.getByRole('button', { name: 'Sample Market actions' });
					await actions.click();
					await page.getByRole('menuitem', { name: 'Move to group' }).click();
					await page.getByRole('menuitem', { name: 'Savings Goals' }).click();
					await expect(savingsToggle).toHaveAttribute('aria-expanded', 'true');
					await expect(
						rowgroup('Savings Goals').getByRole('button', { name: 'Sample Market', exact: true })
					).toBeVisible();
					await expect(inspector.getByRole('heading', { name: 'Sample Market' })).toBeVisible();
					await expect(actions).toBeFocused();
				}
			);

			await step(
				'Hide closes the inspector, lists it as hidden, and leaves focus on the Category beside it',
				async () => {
					await inspector.getByRole('button', { name: 'Sample Market actions' }).click();
					await page.getByRole('menuitem', { name: 'Hide', exact: true }).click();
					await expect(inspector).toHaveCount(0);
					await expect(
						page.getByRole('button', { name: 'Car Repairs', exact: true })
					).toBeFocused();
					const hidden = page.getByRole('region', { name: 'Hidden' });
					await expect(hidden).toContainText('Sample Market');
					await reloadOnceSaved(page);
					await expect(hidden).toContainText('Sample Market');
					await expect(
						page.getByRole('button', { name: 'Sample Market', exact: true })
					).toHaveCount(0);
				}
			);

			await step(
				'a Hide answered after another Category opened hides the first and leaves the one opened with its draft and focus',
				async () => {
					const server = await holdResponseTo(page, 'categories:setHidden');
					await openBudget(page);
					await page.getByRole('button', { name: 'Transit', exact: true }).click();
					await inspector.getByRole('button', { name: 'Transit actions' }).click();
					await page.getByRole('menuitem', { name: 'Hide', exact: true }).click();
					await server.held;
					await page.getByRole('button', { name: 'Coffee', exact: true }).click();
					await inspector.getByRole('button', { name: 'Coffee actions' }).click();
					await page.getByRole('menuitem', { name: 'Rename' }).click();
					const field = inspector.getByRole('textbox', { name: 'Category name' });
					await field.fill('Coffee Draft');
					server.release();
					await expect(page.getByRole('region', { name: 'Hidden' })).toContainText('Transit');
					await page.keyboard.type(' Kept');
					await expect(field).toBeFocused();
					await expect(field).toHaveValue('Coffee Draft Kept');
					await field.press('Escape');
					await expect(inspector.getByRole('heading', { name: 'Coffee' })).toBeVisible();
				}
			);

			await step(
				'Delete… moves its history to the Category picked, then it is gone and focus is on the Category beside it',
				async () => {
					const diningOut = await activity('Dining Out');
					expect(diningOut).not.toBe(0);
					const coffee = await activity('Coffee');
					await page.getByRole('button', { name: 'Dining Out', exact: true }).click();
					await inspector.getByRole('button', { name: 'Dining Out actions' }).click();
					await page.getByRole('menuitem', { name: 'Delete…' }).click();
					const dialog = page.getByRole('dialog', { name: 'Delete Dining Out' });
					await choose(dialog.getByLabel('Move its history to'), 'Coffee');
					await dialog.getByRole('button', { name: 'Delete Category' }).click();
					await expect(dialog).toBeHidden();
					await expect(inspector).toHaveCount(0);
					await expect(page.getByRole('button', { name: 'Coffee', exact: true })).toBeFocused();
					await reloadOnceSaved(page);
					await expect(page.getByRole('button', { name: 'Dining Out', exact: true })).toHaveCount(
						0
					);
					await expect.poll(() => activity('Coffee')).toBe(coffee + diningOut);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
