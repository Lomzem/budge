import { expect } from '@playwright/test';

import { openBudget, type Journey } from './journey';

export const creditCards = {
	debt: {
		title: "a card's Payment Category shows the card debt not yet covered",
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await step('the Credit Card Payments group shows the seeded debt', async () => {
				await openBudget(page);
				const seededCardsStartingDebtNothingHasCovered = '$612.48 of card debt not yet covered';
				const group = page.getByRole('rowgroup').filter({ hasText: 'Credit Card Payments' });
				await expect(group.getByRole('button', { name: 'Card', exact: true })).toBeVisible();
				await expect(
					group.getByText(seededCardsStartingDebtNothingHasCovered).filter({ visible: true })
				).toBeVisible();
			});
		}
	}
} satisfies Record<string, Journey>;
