import { expect } from '@playwright/test';

import { centsIn, openBudget, type Journey } from './journey';

export const creditCards = {
	debt: {
		title:
			'a card\'s Payment Category shows the card debt not yet covered, and "Assign $X" funds it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const seededCardsStartingDebt = 61_248;
			const group = page.getByRole('rowgroup').filter({ hasText: 'Credit Card Payments' });
			const nameButton = group.getByRole('button', { name: 'Card', exact: true });
			const readyToAssign = () => centsIn(page.getByTestId('ready-to-assign'));

			const before = await step(
				'the Credit Card Payments group shows the seeded debt',
				async () => {
					await openBudget(page);
					await expect(nameButton).toBeVisible();
					await expect(
						group.getByText('$612.48 of card debt not yet covered').filter({ visible: true })
					).toBeVisible();
					return await readyToAssign();
				}
			);

			await step(
				'Assign $612.48 covers the debt from Ready to Assign, from the table or the inspector',
				async () => {
					const fromTable = group.getByRole('button', {
						name: 'Assign $612.48 to Card',
						exact: true
					});
					await expect(fromTable).toBeVisible();
					await nameButton.click();
					const inspector = page.getByRole('region', { name: 'Card', exact: true });
					const fromInspector = inspector.getByRole('button', { name: 'Assign $612.48' });
					await fromInspector.focus();
					await page.keyboard.press('Enter');
					await expect(inspector.getByRole('status')).toHaveText(
						'Assigned $612.48 to Card from Ready to Assign.'
					);
					await expect(fromInspector).toHaveCount(0);
					await expect(fromTable).toHaveCount(0);
					await expect(page.getByText('of card debt not yet covered')).toHaveCount(0);
					await expect(inspector).toBeFocused();
					await expect.poll(readyToAssign).toBe(before - seededCardsStartingDebt);
					await page.reload();
					await expect.poll(readyToAssign).toBe(before - seededCardsStartingDebt);
					await expect(page.getByText('of card debt not yet covered')).toHaveCount(0);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
