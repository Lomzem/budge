import { expect } from '@playwright/test';

import { cents, centsIn, openBudget, typed, type Journey } from './journey';

export const inspector = {
	'move-money': {
		title: 'the inspector moves money by keyboard, and opens under its row on a phone',
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
				const coffee = await category
					.locator('option', { hasText: /^Coffee / })
					.getAttribute('value');
				await category.selectOption(coffee ?? '');
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

			await step('on a phone the same inspector opens in a row under Groceries', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await expect(region).toBeVisible();
				await expect(page.getByRole('row').filter({ has: region })).toBeVisible();
				await region.getByRole('button', { name: 'Close Groceries' }).click();
				await expect(region).toBeHidden();
				await expect(groceries).toBeFocused();
			});
		}
	}
} satisfies Record<string, Journey>;
