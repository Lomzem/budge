import { expect } from '@playwright/test';

import { cents, centsIn, choose, openBudget, typed, type Journey } from './journey';

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
			const move = async (direction: 'Move to' | 'Take from') => {
				await region.getByLabel(direction).check();
				const category = region.getByLabel(
					direction === 'Move to' ? 'To Category' : 'From Category'
				);
				await choose(category, /^Coffee \(/);
				await region.getByLabel('Amount').fill(typed(1_000));
				await region.getByLabel('Amount').press('Enter');
			};

			await step(
				'Move to Coffee moves $10 of Assigned and leaves Ready to Assign alone',
				async () => {
					await move('Move to');
					await expect.poll(() => assigned('Groceries')).toBe(before.groceries - 1_000);
					await expect.poll(() => assigned('Coffee')).toBe(before.coffee + 1_000);
					expect(await readyToAssign()).toBe(before.readyToAssign);
				}
			);

			await step('Take from Coffee moves it back', async () => {
				await move('Take from');
				await expect.poll(() => assigned('Groceries')).toBe(before.groceries);
				await expect.poll(() => assigned('Coffee')).toBe(before.coffee);
			});

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
	}
} satisfies Record<string, Journey>;
