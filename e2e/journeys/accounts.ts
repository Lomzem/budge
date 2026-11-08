import { expect, type Page } from '@playwright/test';

import { formatCents } from '../../src/lib/domain/money';
import { holdResponseTo } from '../heldResponse';
import { cents, centsIn, openAccount, typed, type Journey } from './journey';

async function openStartingBalance(page: Page, name: string) {
	await page.getByRole('button', { name: `${name} actions` }).click();
	await page.getByRole('menuitem', { name: 'Starting balance' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: `Starting balance for ${name}` })).toBeVisible();
	return dialog;
}

function heldRegion(page: Page) {
	return page.getByRole('region', { name: 'New bank Accounts' });
}

async function openHeld(page: Page, bankAccount: string, waiting?: string) {
	await page.goto('/bank');
	const held = heldRegion(page).getByRole('button', {
		name: `Set up ${bankAccount}`,
		exact: true
	});
	if (waiting !== undefined) {
		const row = heldRegion(page)
			.getByRole('listitem')
			.filter({ has: page.getByRole('button', { name: `Set up ${bankAccount}`, exact: true }) });
		await expect(row).toContainText(waiting);
	}
	await held.click();
	return held;
}

async function confirmStartingBalance(page: Page, label: string, amount: string) {
	const dialog = page.getByRole('dialog', { name: 'Starting balance' });
	await expect(dialog.getByRole('button', { name: 'Suggest again' })).toBeEnabled();
	await dialog.getByLabel(label).fill(amount);
	await dialog.getByRole('button', { name: 'Confirm' }).click();
	await expect(dialog).toBeHidden();
}

export const accounts = {
	'start-late-save': {
		title:
			"a starting balance saved from a dismissed dialog lands, and leaves the next Account's dialog alone",
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const network = await holdResponseTo(page, 'accounts:setStartingBalance');
			const savingsEntry = '9,999.99';

			const before = await step(
				'save $100 more on Checking, hold the save, and dismiss',
				async () => {
					await page.goto('/');
					await openAccount(page, 'Checking');
					const balance = await centsIn(page.getByTestId('account-balance'));
					const checking = await openStartingBalance(page, 'Checking');
					const start = cents(
						(await checking.getByTestId('current-starting-balance').textContent())?.replace(
							/^Now /,
							''
						) ?? null
					);
					await checking.getByLabel('Starting balance').fill(typed(start + 10_000));
					await checking.getByRole('button', { name: 'Confirm' }).click();
					await network.held;
					await page.keyboard.press('Escape');
					await expect(checking).toBeHidden();
					return { balance, start };
				}
			);
			const startAfter = before.start + 10_000;
			const balanceAfter = formatCents(before.balance - before.start + startAfter);

			const savings = await step(
				"type into Savings' dialog, then release the held save",
				async () => {
					await openAccount(page, 'Savings');
					const dialog = await openStartingBalance(page, 'Savings');
					await dialog.getByLabel('Starting balance').fill(savingsEntry);
					network.release();
					return dialog;
				}
			);

			await step("Checking's balance moves, and Savings' dialog keeps what was typed", async () => {
				await expect(
					page
						.getByRole('navigation', { name: 'Budget and Accounts' })
						.getByRole('link', { name: /^Checking/ })
				).toContainText(balanceAfter);
				await expect(
					savings.getByRole('heading', { name: 'Starting balance for Savings' })
				).toBeVisible();
				await expect(savings.getByLabel('Starting balance')).toHaveValue(savingsEntry);
				await expect(savings.getByRole('button', { name: 'Confirm' })).toBeEnabled();
				await savings.getByRole('button', { name: 'Cancel' }).click();
				await expect(savings).toBeHidden();
			});

			await step("Checking's dialog and balance show the new starting balance", async () => {
				await openAccount(page, 'Checking');
				const reopened = await openStartingBalance(page, 'Checking');
				await expect(reopened.getByTestId('current-starting-balance')).toHaveText(
					`Now ${formatCents(startAfter)}`
				);
				await page.keyboard.press('Escape');
				await expect(page.getByTestId('account-balance')).toHaveText(balanceAfter);
			});
		}
	},
	'start-edit': {
		title: 'editing a starting balance offers only the edits it allows, and saving it still works',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const dialog = page.getByRole('dialog', { name: 'Edit Transaction' });

			await step("open Checking's Starting Balance Transaction", async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				await page.getByRole('button', { name: /^Starting Balance/ }).click();
			});

			await step(
				'Account and Payee are locked, and Category offers no split or Transfer',
				async () => {
					await expect(dialog.getByLabel('Account')).toBeDisabled();
					await expect(dialog.getByLabel('Payee')).toBeDisabled();
					await expect(dialog.getByLabel('Payee')).toHaveValue('Starting Balance');
					const category = dialog.getByLabel('Category', { exact: true });
					await expect(category.getByRole('option', { name: 'Groceries' })).toHaveCount(1);
					await expect(
						category.getByRole('option', { name: 'Split across Categories' })
					).toHaveCount(0);
					await expect(category.getByRole('option', { name: /^Transfer:/ })).toHaveCount(0);
				}
			);

			await step('saving it still works', async () => {
				await dialog.getByRole('button', { name: 'Save' }).click();
				await expect(dialog).toBeHidden();
				await expect(page.getByRole('button', { name: /^Starting Balance/ })).toBeVisible();
			});
		}
	},
	'held-map': {
		title:
			'a held bank Account brought into an existing Account adds its rows and resets its Starting Balance',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			await step(
				'bring Sample Savings Plus into Savings with a $1,000.00 Starting Balance',
				async () => {
					const held = await openHeld(page, 'Sample Savings Plus ending 4417', '2 rows waiting');
					const choose = page.getByRole('dialog', { name: 'Sample Savings Plus ending 4417' });
					await choose.getByRole('radio', { name: 'Into Savings' }).check();
					await choose.getByRole('button', { name: 'Bring in its rows' }).click();
					await confirmStartingBalance(page, 'Starting balance', '1,000.00');
					await expect(held).toBeHidden();
				}
			);

			await step('Savings lists its rows and the new Starting Balance', async () => {
				await openAccount(page, 'Savings');
				await expect(page.getByRole('button', { name: /^SAMPLE INTEREST PAID/ })).toBeVisible();
				await expect(page.getByRole('button', { name: /^SAMPLE TRANSFER IN 5512/ })).toBeVisible();
				await expect(
					page
						.getByRole('row')
						.filter({ has: page.getByRole('button', { name: /^Starting Balance/ }) })
				).toContainText('$1,000.00');
			});
		}
	},
	'held-new-card': {
		title:
			'a held card becomes a new credit-card Account whose Starting Balance is the amount owed',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			await step('bring Sample Rewards Card in as a new credit card owing $100.00', async () => {
				const held = await openHeld(page, 'Sample Rewards Card ending 9021');
				const choose = page.getByRole('dialog', { name: 'Sample Rewards Card ending 9021' });
				await choose.getByRole('radio', { name: 'Into a new Account' }).check();
				await expect(choose.getByLabel('Name')).toHaveValue('Sample Rewards Card');
				await choose.getByLabel('Name').fill('Rewards Card');
				await choose.getByRole('radio', { name: 'Credit card' }).check();
				await choose.getByRole('button', { name: 'Bring in its rows' }).click();
				await confirmStartingBalance(page, 'Amount owed on the cutover date', '100.00');
				await expect(held).toBeHidden();
			});

			await step('Rewards Card lists its rows and owes the amount plus their charges', async () => {
				await openAccount(page, 'Rewards Card');
				await expect(page.getByRole('button', { name: /^SAMPLE BISTRO 0817/ })).toBeVisible();
				await expect(page.getByRole('button', { name: /^SAMPLE BOOK NOOK 3306/ })).toBeVisible();
				await expect
					.poll(() => centsIn(page.getByTestId('account-balance')))
					.toBe(-10_000 - 3_629 - 2_108);
			});
		}
	},
	'held-ignore': {
		title: 'an ignored held bank Account leaves the list and stays gone',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const held = await step('ignore Sample Holiday Club', async () => {
				const button = await openHeld(page, 'Sample Holiday Club ending 1180');
				const choose = page.getByRole('dialog', { name: 'Sample Holiday Club ending 1180' });
				await choose.getByRole('radio', { name: 'Nowhere: ignore this bank Account' }).check();
				await expect(
					choose.getByText("Its rows are dropped, and Budge won't ask about it again.")
				).toBeVisible();
				await choose.getByRole('button', { name: 'Ignore' }).click();
				await expect(choose).toBeHidden();
				await expect(button).toBeHidden();
				return button;
			});

			await step('after a reload, the other held Accounts remain and it stays gone', async () => {
				await page.reload();
				await expect(
					heldRegion(page).getByRole('button', { name: 'Set up Sample Savings Plus ending 4417' })
				).toBeVisible();
				await expect(held).toBeHidden();
			});
		}
	}
} satisfies Record<string, Journey>;
