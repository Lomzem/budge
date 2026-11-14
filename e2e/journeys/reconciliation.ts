import { expect } from '@playwright/test';

import { centsIn, openAccount, typed, type Journey } from './journey';

export const reconciliation = {
	difference: {
		title: 'reconciling the seeded Card records the difference as a locked adjustment',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const dialog = page.getByRole('dialog');
			const adjustment = page.getByRole('row').filter({ hasText: 'Reconciliation Adjustment' });

			await step('open Card, which was never reconciled', async () => {
				await page.goto('/');
				await openAccount(page, 'Card');
				await expect(page.getByTestId('last-reconciled')).toHaveText('Not reconciled yet');
			});

			await step("Reconcile follows the Account's actions in tab order", async () => {
				await page.getByRole('button', { name: 'Card actions' }).focus();
				await page.keyboard.press('Tab');
				await expect(page.getByRole('button', { name: 'Reconcile' })).toBeFocused();
			});

			await step(
				'a bank balance $1.00 more owed shows the difference; Enter records it',
				async () => {
					await page.keyboard.press('Enter');
					const clearedText = dialog.getByTestId('cleared-balance');
					await expect(clearedText).toHaveText(/\$/);
					const cardsClearedBalanceInTheInputsTerms = 'Cleared amount owed';
					await expect(dialog.getByText(cardsClearedBalanceInTheInputsTerms)).toBeVisible();
					const owed = await centsIn(clearedText);
					await expect(dialog.getByLabel('Amount owed, per the bank')).toBeFocused();
					const bankOwedOneDollarMoreThanCleared = owed + 100;
					await page.keyboard.type(typed(bankOwedOneDollarMoreThanCleared));
					await expect(dialog.getByRole('status')).toContainText('differs by −$1.00');
					await expect(
						dialog.getByRole('button', { name: 'Reconcile with −$1.00 adjustment' })
					).toBeVisible();
					await page.keyboard.press('Enter');
					await expect(dialog).toBeHidden();
				}
			);

			await step(
				'the account reads Reconciled, with one locked adjustment to Ready to Assign',
				async () => {
					await expect(page.getByRole('status').filter({ hasText: 'Reconciled,' })).toHaveText(
						'Reconciled, with a Reconciliation Adjustment of −$1.00.'
					);
					await expect(page.getByTestId('last-reconciled')).toContainText(/^Reconciled \w+/);
					await expect(adjustment).toHaveCount(1);
					await expect(
						adjustment.getByText('Reconciled', { exact: true }).filter({ visible: true })
					).toHaveCount(1);
					await expect(
						adjustment.getByText('Ready to Assign').filter({ visible: true })
					).toBeVisible();
				}
			);

			await step(
				"opening it shows the lock; its amount can't be edited until an Unlock is confirmed, which keeps focus in the Transaction",
				async () => {
					await adjustment.getByRole('button', { name: /^Reconciliation Adjustment/ }).click();
					await expect(dialog.getByLabel('Amount')).toBeDisabled();
					await expect(dialog.getByRole('button', { name: 'Delete' })).toHaveCount(0);
					await dialog.getByRole('button', { name: 'Unlock' }).click();
					const confirm = page.getByRole('alertdialog', { name: 'Unlock this Transaction?' });
					await confirm.getByRole('button', { name: 'Keep it locked' }).click();
					await expect(dialog.getByLabel('Amount')).toBeDisabled();
					await dialog.getByRole('button', { name: 'Unlock' }).click();
					await confirm.getByRole('button', { name: 'Unlock' }).click();
					await expect(dialog.getByLabel('Amount')).toBeEnabled();
					await expect(dialog.getByRole('status').filter({ hasText: /^Unlocked/ })).toBeVisible();
					await expect(dialog.and(page.locator(':focus-within'))).toBeVisible();
					await page.keyboard.press('Escape');
					await expect(dialog).toBeHidden();
					await expect(adjustment.getByRole('checkbox', { name: /^Cleared/ })).toBeChecked();
				}
			);

			await step(
				'when the bank shows the cleared balance, one tap reconciles with no new adjustment',
				async () => {
					await page.getByRole('button', { name: 'Reconcile' }).click();
					await expect(dialog.getByTestId('cleared-balance')).toHaveText(/\$/);
					await dialog
						.getByRole('button', { name: /^The bank shows the same: reconcile at/ })
						.click();
					await expect(dialog).toBeHidden();
					await expect(
						page.getByRole('status').filter({ hasText: 'Reconciled. The balances matched.' })
					).toBeVisible();
					await expect(adjustment).toHaveCount(1);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
