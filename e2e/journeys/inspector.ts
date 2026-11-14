import { expect } from '@playwright/test';

import { pausableSync } from '../heldResponse';
import { cents, centsIn, choicesOf, choose, openBudget, typed, type Journey } from './journey';

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
				}
			);

			await step('swapped back, From Coffee moves it back', async () => {
				await region.getByRole('button', { name: 'Swap From and To' }).click();
				await move();
				await expect.poll(() => assigned('Groceries')).toBe(before.groceries);
				await expect.poll(() => assigned('Coffee')).toBe(before.coffee);
			});

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
					const shortfall = cents(await inspector.getByLabel('Amount').inputValue());
					expect(shortfall).toBeGreaterThan(0);
					const richest = (await choicesOf(from))
						.map((label) => ({ label, available: cents(/\((.*)\)$/.exec(label)?.[1] ?? '') }))
						.sort((a, b) => b.available - a.available)[0];
					if (richest === undefined || richest.available < shortfall) {
						throw new Error('The fixture has no Category that can cover the shortfall.');
					}
					await choose(from, richest.label);
					await inspector.getByLabel('Amount').press('Enter');
					await expect(inspector).not.toContainText('Overspent by');
					await expect(
						inspector.getByRole('button', { name: 'Cover from another Category' })
					).toHaveCount(0);
					expect(await readyToAssign()).toBe(before);
					await page.reload();
					await page.getByRole('button', { name: overspent, exact: true }).click();
					await expect(inspector).not.toContainText('Overspent by');
				}
			);

			await step('Rename in the inspector edits its heading in place', async () => {
				await page.getByRole('button', { name: 'Groceries', exact: true }).click();
				await inspector.getByRole('button', { name: 'Groceries actions' }).click();
				await page.getByRole('menuitem', { name: 'Rename' }).click();
				const field = inspector.getByRole('textbox', { name: 'Category name' });
				await expect(field).toBeFocused();
				await field.fill('Sample Market');
				await field.press('Enter');
				await expect(inspector.getByRole('heading', { name: 'Sample Market' })).toBeVisible();
				await expect(
					inspector.getByRole('button', { name: 'Sample Market actions' })
				).toBeFocused();
				await expect(
					rowgroup('Everyday').getByRole('button', { name: 'Sample Market', exact: true })
				).toBeVisible();
			});

			await step('Move to group puts it in Savings Goals and keeps it open', async () => {
				await inspector.getByRole('button', { name: 'Sample Market actions' }).click();
				await page.getByRole('menuitem', { name: 'Move to group' }).click();
				await page.getByRole('menuitem', { name: 'Savings Goals' }).click();
				await expect(
					rowgroup('Savings Goals').getByRole('button', { name: 'Sample Market', exact: true })
				).toBeVisible();
				await expect(inspector.getByRole('heading', { name: 'Sample Market' })).toBeVisible();
			});

			await step('Hide from budget closes the inspector and lists it as hidden', async () => {
				await inspector.getByRole('button', { name: 'Sample Market actions' }).click();
				await page.getByRole('menuitem', { name: 'Hide from budget' }).click();
				await expect(inspector).toHaveCount(0);
				await expect(page.locator('#main')).toBeFocused();
				const hidden = page.getByRole('region', { name: 'Hidden Categories' });
				await expect(hidden).toContainText('Sample Market');
				await page.reload();
				await expect(hidden).toContainText('Sample Market');
				await expect(page.getByRole('button', { name: 'Sample Market', exact: true })).toHaveCount(
					0
				);
			});

			await step('Delete… moves its history to the Category picked, then it is gone', async () => {
				await page.getByRole('button', { name: 'Dining Out', exact: true }).click();
				await inspector.getByRole('button', { name: 'Dining Out actions' }).click();
				await page.getByRole('menuitem', { name: 'Delete…' }).click();
				const dialog = page.getByRole('dialog', { name: 'Delete Dining Out' });
				await choose(dialog.getByLabel('Move its history to'), 'Coffee');
				await dialog.getByRole('button', { name: 'Delete Category' }).click();
				await expect(dialog).toBeHidden();
				await expect(inspector).toHaveCount(0);
				await expect(page.locator('#main')).toBeFocused();
				await page.reload();
				await expect(page.getByRole('button', { name: 'Dining Out', exact: true })).toHaveCount(0);
			});
		}
	}
} satisfies Record<string, Journey>;
