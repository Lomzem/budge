import { expect, type Page } from '@playwright/test';

import { formatCents } from '../../src/lib/domain/money';
import { holdResponseTo } from '../heldResponse';
import { cents, centsIn, choicesOf, openAccount, typed, type Journey } from './journey';

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

function bankCard(page: Page, name: string) {
	return page
		.getByRole('list', { name: 'Bank Connections' })
		.getByRole('article', { name, exact: true });
}

function feedOf(page: Page, connection: string, bankAccount: string) {
	return bankCard(page, connection)
		.getByRole('list', { name: `Where ${connection} goes` })
		.getByRole('listitem')
		.filter({ hasText: `from ${bankAccount}` });
}

const unconfirmed = 'Starting balance not confirmed';

async function confirmStartingBalance(page: Page, label: string | RegExp, amount: string) {
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
						.getByRole('navigation', { name: 'Sections and Accounts' })
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
					const choices = await choicesOf(category);
					expect(choices).toContain('Groceries');
					expect(choices).not.toContain('Split across Categories');
					expect(choices.filter((name) => name.startsWith('Transfer:'))).toEqual([]);
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
					const held = await openHeld(
						page,
						'Sample Savings Plus ending 4417',
						'2 transactions waiting'
					);
					const choose = page.getByRole('dialog', { name: 'Sample Savings Plus ending 4417' });
					const savings = choose.getByRole('radio', { name: 'Into Savings' });
					await expect(savings).toHaveAccessibleDescription('Already fed by Sample Community Bank');
					await savings.check();
					await choose.getByRole('button', { name: 'Import its transactions' }).click();
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
			await step(
				'Sample Rewards Card refuses a cash Account, then comes in as a new credit card owing $100.00',
				async () => {
					const held = await openHeld(page, 'Sample Rewards Card ending 9021');
					const choose = page.getByRole('dialog', { name: 'Sample Rewards Card ending 9021' });
					await expect(choose).toContainText('2 transactions waiting.');
					await choose.getByRole('radio', { name: 'Into Checking' }).check();
					const importIt = choose.getByRole('button', { name: 'Import its transactions' });
					await expect(importIt).toHaveAttribute('aria-disabled', 'true');
					await expect(importIt).toHaveAccessibleDescription(
						/^The bank says this is a credit card, but Checking is a cash Account/
					);
					await choose.getByRole('radio', { name: 'Into a new Account' }).check();
					await expect(choose.getByLabel('Name')).toHaveValue('Sample Rewards Card');
					await choose.getByLabel('Name').fill('Rewards Card');
					await choose.getByRole('radio', { name: 'Credit card' }).check();
					await choose.getByRole('button', { name: 'Import its transactions' }).click();
					await confirmStartingBalance(page, /^Amount owed on /, '100.00');
					await expect(held).toBeHidden();
				}
			);

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
	'held-unknown-kind': {
		title:
			'a held bank Account the bank never described asks for its type instead of assuming cash',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const choose = page.getByRole('dialog', { name: 'An unnamed bank Account' });
			const type = choose.getByRole('radiogroup').filter({ has: page.getByLabel('Credit card') });
			const importIt = choose.getByRole('button', { name: 'Import its transactions' });

			const held = await step(
				'a new Account for it has no type until the owner picks one',
				async () => {
					const button = await openHeld(page, 'An unnamed bank Account', '1 transaction waiting');
					await expect(choose.getByRole('radio', { name: 'Into a new Account' })).toBeChecked();
					await choose.getByLabel('Name').fill('Service Account');
					await expect(choose.getByRole('radio', { name: /^Cash/ })).not.toBeChecked();
					await expect(choose.getByRole('radio', { name: 'Credit card' })).not.toBeChecked();
					await importIt.click();
					await expect(choose.getByRole('alert')).toHaveText(
						"Choose this Account's type: cash or credit card."
					);
					await expect(choose.getByRole('radio', { name: /^Cash/ })).toBeFocused();
					await expect(type).toHaveAttribute('aria-invalid', 'true');
					await expect(type).toHaveAccessibleDescription(
						"Choose this Account's type: cash or credit card."
					);
					return button;
				}
			);

			await step('choosing Checking says the bank gave no kind to check against', async () => {
				await choose.getByRole('radio', { name: 'Into Checking' }).check();
				await expect(choose).toContainText(
					"The bank didn't say what kind of account this is, so make sure it is a cash Account like Checking."
				);
				await expect(importIt).not.toHaveAttribute('aria-disabled', 'true');
			});

			await step('as a new credit card, its row lands there', async () => {
				await choose.getByRole('radio', { name: 'Into a new Account' }).check();
				await choose.getByRole('radio', { name: 'Credit card' }).check();
				await importIt.click();
				await confirmStartingBalance(page, /^Amount owed on /, '0.00');
				await expect(held).toBeHidden();
				await openAccount(page, 'Service Account');
				await expect(page.getByRole('button', { name: /^SAMPLE SERVICE FEE/ })).toBeVisible();
				await expect.poll(() => centsIn(page.getByTestId('account-balance'))).toBe(-5_00);
			});
		}
	},
	'held-legacy-name': {
		title:
			'a held bank Account recorded with a name but no kind is never preselected into the same-named Account',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const choose = page.getByRole('dialog', { name: 'Savings ending 6630' });
			const intoSavings = choose.getByRole('radio', { name: 'Into Savings' });

			const held = await step('it opens on a new Account, not Savings', async () => {
				const button = await openHeld(page, 'Savings ending 6630', '1 transaction waiting');
				await expect(choose.getByRole('radio', { name: 'Into a new Account' })).toBeChecked();
				await expect(intoSavings).not.toBeChecked();
				return button;
			});

			await step('choosing Savings asks the owner to check its kind', async () => {
				await intoSavings.check();
				await expect(choose).toContainText(
					"The bank didn't say what kind of account this is, so make sure it is a cash Account like Savings."
				);
				await choose.getByRole('button', { name: 'Import its transactions' }).click();
				await confirmStartingBalance(page, 'Starting balance', '1,000.00');
				await expect(held).toBeHidden();
			});

			await step('Savings lists its row', async () => {
				await openAccount(page, 'Savings');
				await expect(page.getByRole('button', { name: /^SAMPLE DIVIDEND 0630/ })).toBeVisible();
			});
		}
	},
	'setup-check': {
		title:
			"a mapped bank Account's starting balance stays unconfirmed until the owner confirms it, and its basis says what is unknown",
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const savings = feedOf(page, 'Sample Community Bank', 'Sample Statement Savings ending 6604');
			const check = savings.getByRole('button', { name: "Check Savings's starting balance" });
			const dialog = page.getByRole('dialog', { name: 'Starting balance for Savings' });

			await step(
				'the Bank card says Savings comes from Sample Statement Savings, its starting balance not confirmed',
				async () => {
					await page.goto('/bank');
					await expect(savings.getByRole('link', { name: 'Savings' })).toBeVisible();
					await expect(savings).toContainText(unconfirmed);
				}
			);

			await step(
				'its basis names the bank Account and calls what Budge cannot know unknown',
				async () => {
					await check.click();
					await expect(dialog.getByRole('button', { name: 'Suggest again' })).toBeEnabled();
					await expect(dialog).toHaveAccessibleDescription(
						/^Budge records it on [A-Z][a-z]{2} 1, \d{4}, the cutover date\. Confirm or correct it\./
					);
					await dialog.getByText('What it’s based on').click();
					await expect(dialog).toContainText(
						'Sample Statement Savings ending 6604 at Sample Community Bank'
					);
					await expect(dialog.getByTestId('bank-balance')).toHaveText(/^Unknown\. /);
					await expect(dialog.getByTestId('imported-since')).toHaveText('None');
					await expect(dialog).toContainText('Unknown. Not available to Budge.');
					await expect(dialog).toContainText("Unknown. The bank doesn't say whether");
					await expect(dialog).toContainText("A working connection doesn't prove it either.");
				}
			);

			await step('Cancel leaves it unconfirmed', async () => {
				await dialog.getByRole('button', { name: 'Cancel' }).click();
				await expect(dialog).toBeHidden();
				await expect(check).toBeFocused();
				await expect(savings).toContainText(unconfirmed);
			});

			await step(
				'confirming it clears the problem, after a reload too, and points to categorizing',
				async () => {
					await check.click();
					await confirmStartingBalance(page, 'Starting balance', '1,000.00');
					const confirmed = page.getByRole('status').filter({ hasText: /^Savings/ });
					await expect(confirmed).toHaveText(
						"Savings's starting balance is confirmed. Categorize its Transactions"
					);
					await expect(savings).not.toContainText(unconfirmed);
					await confirmed.getByRole('link', { name: 'Categorize its Transactions' }).click();
					await expect(
						page.getByRole('heading', { level: 1, name: 'Accounts', exact: true })
					).toBeVisible();
					const filters = page.getByRole('search', { name: 'Search and filter Transactions' });
					await expect(filters.getByLabel('Account', { exact: true })).toHaveText('Savings');
					await expect(filters.getByLabel('Category', { exact: true })).toHaveText('Uncategorized');
					await page.goto('/bank');
					await expect(savings.getByRole('link', { name: 'Savings' })).toBeVisible();
					await expect(savings).not.toContainText(unconfirmed);
					await expect(savings.getByRole('button', { name: /starting balance$/ })).toHaveCount(0);
				}
			);
		}
	},
	'setup-correct': {
		title:
			'a bank Account set up in the wrong Account is moved through Stop syncing and Bring back, confirmed in its new one, and its earlier Transactions are shown still in the old one',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const creditUnion = bankCard(page, 'Sample Credit Union');
			const intoSavings = feedOf(page, 'Sample Credit Union', 'Sample Savings Plus ending 4417');

			await step(
				'set Sample Savings Plus up into Savings and skip its starting balance',
				async () => {
					await openHeld(page, 'Sample Savings Plus ending 4417');
					const choose = page.getByRole('dialog', { name: 'Sample Savings Plus ending 4417' });
					await choose.getByRole('radio', { name: 'Into Savings' }).check();
					await choose.getByRole('button', { name: 'Import its transactions' }).click();
					const starting = page.getByRole('dialog', { name: 'Starting balance' });
					await expect(starting.getByRole('button', { name: 'Suggest again' })).toBeEnabled();
					await starting.getByRole('button', { name: 'Skip' }).click();
					await expect(starting).toBeHidden();
				}
			);

			await step('the card says it goes into Savings, starting balance not confirmed', async () => {
				await expect(intoSavings.getByRole('link', { name: 'Savings' })).toBeVisible();
				await expect(intoSavings).toContainText(unconfirmed);
			});

			await step('stop syncing it into Savings, and bring it back for setup', async () => {
				await creditUnion.getByRole('button', { name: 'Sample Credit Union actions' }).click();
				await page
					.getByRole('menuitem', { name: 'Stop syncing Sample Savings Plus ending 4417' })
					.click();
				await expect(intoSavings).toHaveCount(0);
				await expect(creditUnion.getByRole('status')).toHaveText(
					'Stopped syncing Sample Savings Plus ending 4417. Its Transactions stay in Savings.'
				);
				await creditUnion
					.getByRole('button', { name: 'Bring back Sample Savings Plus ending 4417' })
					.click();
				await expect(creditUnion.getByRole('status')).toHaveText(
					'Brought back. Set it up to choose where its new transactions go.'
				);
				await expect(
					creditUnion.getByRole('button', { name: 'Set up Sample Savings Plus ending 4417' })
				).toBeFocused();
			});

			const plus = feedOf(page, 'Sample Credit Union', 'Sample Savings Plus ending 4417');
			const stillInSavings =
				'Its earlier Transactions are still in Savings. Only new ones come to Savings Plus.';

			await step(
				'set it up as a new Account and confirm its starting balance: the card and the status say its earlier Transactions are still in Savings',
				async () => {
					await creditUnion
						.getByRole('button', { name: 'Set up Sample Savings Plus ending 4417' })
						.click();
					const choose = page.getByRole('dialog', { name: 'Sample Savings Plus ending 4417' });
					await choose.getByRole('radio', { name: 'Into a new Account' }).check();
					await choose.getByLabel('Name').fill('Savings Plus');
					await choose.getByRole('button', { name: 'Import its transactions' }).click();
					await confirmStartingBalance(page, 'Starting balance', '500.00');
					await expect(plus.getByRole('link', { name: 'Savings Plus' })).toBeVisible();
					await expect(plus).not.toContainText(unconfirmed);
					await expect(plus).toContainText(stillInSavings);
					await expect(page.getByRole('status').filter({ hasText: /^Savings Plus/ })).toHaveText(
						"Savings Plus's starting balance is confirmed. Its bank Account's earlier Transactions are still in Savings. Open Savings"
					);
					await page.reload();
					await expect(plus).toContainText(stillInSavings);
				}
			);

			await step('its earlier Transactions are in Savings, and not in Savings Plus', async () => {
				await plus.getByRole('link', { name: 'Savings', exact: true }).click();
				await expect(
					page.getByRole('heading', { level: 1, name: 'Savings', exact: true })
				).toBeVisible();
				const earlier = [/^SAMPLE INTEREST PAID/, /^SAMPLE TRANSFER IN 5512/];
				for (const row of earlier) {
					await expect(page.getByRole('button', { name: row })).toBeVisible();
				}
				await openAccount(page, 'Savings Plus');
				await expect(page.getByRole('button', { name: /^Starting Balance/ })).toBeVisible();
				for (const row of earlier) {
					await expect(page.getByRole('button', { name: row })).toHaveCount(0);
				}
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
					choose.getByText(/^Its transactions are dropped, and Budge stops asking\./)
				).toBeVisible();
				await choose.getByRole('button', { name: 'Ignore' }).click();
				await expect(choose).toBeHidden();
				await expect(button).toBeHidden();
				return button;
			});

			await step(
				'brought back on the same page, it offers Set up again, and ignoring it again hides it',
				async () => {
					await page
						.getByRole('button', { name: 'Bring back Sample Holiday Club ending 1180' })
						.click();
					await expect(held).toBeFocused();
					await held.click();
					const choose = page.getByRole('dialog', { name: 'Sample Holiday Club ending 1180' });
					await choose.getByRole('radio', { name: 'Nowhere: ignore this bank Account' }).check();
					await choose.getByRole('button', { name: 'Ignore' }).click();
					await expect(choose).toBeHidden();
					await expect(held).toBeHidden();
				}
			);

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
