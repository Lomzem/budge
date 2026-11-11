import { expect, type Page } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
import { openAccount, type Journey } from './journey';

const notSetUp = "Bank sync isn't set up on this server.";
const noLogin = 'A sample connection with no bank login, so it can’t sync or reconnect.';

function card(page: Page, name: string) {
	return page
		.getByRole('list', { name: 'Bank Connections' })
		.getByRole('article', { name, exact: true });
}

async function openBank(page: Page) {
	await page.goto('/bank');
	await expect(page.getByRole('heading', { level: 1, name: 'Bank', exact: true })).toBeVisible();
}

export const plaid = {
	status: {
		title: 'the Bank page shows when each Bank Connection last synced, and Sync now reports back',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const sandbox = card(page, 'Sample Bank (Sandbox)');

			await step('the sandbox connection says when it last synced', async () => {
				await openBank(page);
				await expect(sandbox).toContainText('Last successful sync 2 hours ago.');
			});

			await step('Sync now and Reconnect are unavailable, and say why', async () => {
				for (const name of ['Sync now', 'Reconnect']) {
					const button = sandbox.getByRole('button', { name, exact: true });
					await expect(button).toHaveAttribute('aria-disabled', 'true');
					await expect(button).toHaveAccessibleDescription(noLogin);
				}
				await sandbox.getByRole('button', { name: 'Sync now' }).click({ force: true });
				await expect(sandbox.getByRole('status')).toHaveText('');
			});
		}
	},
	'late-sync': {
		title: 'two Sync nows that finish late each report only on their own connection',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const sync = await holdResponseTo(page, 'bankConnections:syncNow');
			const communityBank = card(page, 'Sample Community Bank');
			const creditUnion = card(page, 'Sample Credit Union');
			const savings = card(page, 'Sample Savings Bank');

			await step('Sync now on Sample Community Bank, and hold it', async () => {
				await openBank(page);
				await communityBank.getByRole('button', { name: 'Sync now' }).click();
				await sync.held;
				await expect(communityBank.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
			});

			await step('Sync now on Sample Credit Union while the first is held', async () => {
				await creditUnion.getByRole('button', { name: 'Sync now' }).click();
				await expect(creditUnion.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
				await expect(communityBank.getByRole('status')).toHaveText('');
				await expect(creditUnion.getByRole('status')).toHaveText('');
			});

			await step(
				'each released result reports on its own card while the other keeps syncing',
				async () => {
					const pressed = [communityBank, creditUnion];
					const answered = pressed[sync.releaseEarliest()];
					const waiting = pressed.find((candidate) => candidate !== answered);
					if (answered === undefined || waiting === undefined) throw new Error('Unknown call');
					await expect(answered.getByRole('status')).toHaveText(notSetUp);
					await expect(waiting.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
					await expect(waiting.getByRole('status')).toHaveText('');

					sync.release();
					await expect(waiting.getByRole('status')).toHaveText(notSetUp);
					await expect(savings.getByRole('status')).toHaveText('');
					await expect(communityBank).toContainText(`${notSetUp} Last successful sync`);
				}
			);
		}
	},
	attention: {
		title:
			'a Bank Connection that needs a reconnect says so, the Budget points to it, and a failed reconnect leaves it asking',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const savings = card(page, 'Sample Savings Bank');
			const needsReconnect = 'Needs you to reconnect before it can sync again.';

			await step('the Budget says the Bank needs you and links there', async () => {
				await page.goto('/');
				await page
					.getByRole('region', { name: 'Needs you' })
					.getByRole('link', { name: /^Bank: \d+ things? needs? you$/ })
					.click();
				await expect(
					page.getByRole('heading', { level: 1, name: 'Bank', exact: true })
				).toBeVisible();
			});

			await step('only Sample Savings Bank asks for a reconnect', async () => {
				await expect(savings).toContainText(needsReconnect);
				await expect(savings).toContainText(
					'Feeds no Budge Account yet. Reconnect to see its accounts and choose where they go.'
				);
				await expect(card(page, 'Sample Credit Union')).not.toContainText(needsReconnect);
			});

			await step(
				'its Sync now is unavailable until it reconnects, and says why, also when pressed',
				async () => {
					const syncNow = savings.getByRole('button', { name: 'Sync now' });
					await expect(syncNow).toHaveAttribute('aria-disabled', 'true');
					await expect(syncNow).toHaveAccessibleDescription(new RegExp(`^${needsReconnect}`));
					await syncNow.click({ force: true });
					await expect(savings.getByRole('status')).toHaveText(
						'Reconnect first. The bank paused syncing until you do.'
					);
				}
			);

			await step('a failed Reconnect reports why and still offers Reconnect', async () => {
				await savings.getByRole('button', { name: 'Reconnect', exact: true }).click();
				await expect(savings.getByRole('status')).toHaveText(notSetUp);
				await expect(savings.getByRole('button', { name: 'Reconnect', exact: true })).toBeEnabled();
				await page.reload();
				await expect(savings).toContainText(needsReconnect);
			});
		}
	},
	consent: {
		title:
			'a Bank Connection whose consent is ending offers to renew it, and its Account links to it',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const creditUnion = card(page, 'Sample Credit Union');

			await step('Checking says why its bank needs you, and that link opens the card', async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				await page
					.getByTestId('account-sync')
					.getByRole('link', { name: /^Consent ends .+: Sample Credit Union$/ })
					.click();
				await expect(
					page.getByRole('heading', { level: 1, name: 'Bank', exact: true })
				).toBeVisible();
				await expect(creditUnion).toBeFocused();
				await expect(creditUnion).toBeInViewport();
			});

			await step('the card says when consent ends', async () => {
				await expect(creditUnion).toContainText(
					/Your consent at the bank ends .+\. Reconnect to renew it\./
				);
			});

			await step('Reconnect reports the failure, and the consent notice returns', async () => {
				await creditUnion.getByRole('button', { name: 'Reconnect', exact: true }).click();
				await expect(creditUnion.getByRole('status')).toHaveText(notSetUp);
				await page.reload();
				await expect(creditUnion).toContainText('Reconnect to renew it.');
			});
		}
	},
	'late-renew': {
		title:
			'a held renew blocks every other Reconnect but not Sync now, and reports on its own connection',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const reconnect = await holdResponseTo(page, 'bankConnections:reconnect');
			const creditUnion = card(page, 'Sample Credit Union');
			const savings = card(page, 'Sample Savings Bank');
			const communityBank = card(page, 'Sample Community Bank');

			await step('renew Sample Credit Union and hold the result', async () => {
				await openBank(page);
				await creditUnion.getByRole('button', { name: 'Reconnect', exact: true }).click();
				await reconnect.held;
				await expect(creditUnion.getByRole('button', { name: 'Reconnecting…' })).toBeDisabled();
				await expect(
					savings.getByRole('button', { name: 'Reconnect', exact: true })
				).toBeDisabled();
				await expect(communityBank.getByRole('button', { name: 'Sync now' })).toBeEnabled();
			});

			await step('releasing it reports on Sample Credit Union only', async () => {
				reconnect.release();
				await expect(creditUnion.getByRole('status')).toHaveText(notSetUp);
				await expect(savings.getByRole('status')).toHaveText('');
				await expect(savings.getByRole('button', { name: 'Reconnect', exact: true })).toBeEnabled();
			});
		}
	},
	remove: {
		title:
			'removing a Bank Connection asks first, waits for bank sync to sign out of the bank, and moves focus to the next card',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const communityBank = card(page, 'Sample Community Bank');
			const sandbox = card(page, 'Sample Bank (Sandbox)');
			const actionsOf = (name: string) =>
				card(page, name).getByRole('button', { name: `${name} actions` });
			const confirmOf = (name: string) =>
				page.getByRole('alertdialog', { name: `Remove ${name}?` });
			const removeConnection = async (name: string) => {
				await actionsOf(name).click();
				await page.getByRole('menuitem', { name: 'Remove connection…' }).click();
				await confirmOf(name).getByRole('button', { name: 'Remove connection' }).click();
			};

			await step('Keep it closes the confirm and leaves the card', async () => {
				await openBank(page);
				await actionsOf('Sample Community Bank').click();
				await page.getByRole('menuitem', { name: 'Remove connection…' }).click();
				await expect(confirmOf('Sample Community Bank')).toContainText(
					'Transactions it already brought in stay'
				);
				await confirmOf('Sample Community Bank').getByRole('button', { name: 'Keep it' }).click();
				await expect(confirmOf('Sample Community Bank')).toBeHidden();
				await expect(actionsOf('Sample Community Bank')).toBeFocused();
				await expect(communityBank).toBeVisible();
			});

			await step(
				'without bank sync set up, a connection with a bank login stays and says why',
				async () => {
					await removeConnection('Sample Community Bank');
					await expect(communityBank.getByRole('status')).toHaveText(
						"Bank sync isn't set up on this server, so Budge can't sign out of this bank yet. Set it up, then remove the connection."
					);
					await expect(communityBank).toBeVisible();
					await expect(communityBank.getByRole('link', { name: 'Savings' })).toBeVisible();
				}
			);

			await step('a connection with no bank login is removed and reported', async () => {
				await removeConnection('Sample Bank (Sandbox)');
				await expect(sandbox).toHaveCount(0);
				await expect(page.getByRole('status').filter({ hasText: /^Sample Bank/ })).toHaveText(
					'Sample Bank (Sandbox): Removed. Its Transactions stay in your Accounts.'
				);
				await expect(page.locator('article:focus')).toHaveCount(1);
			});
		}
	},
	'stop-and-bring-back': {
		title:
			'an Account stops syncing from its bank, and the Bank card brings that bank Account back for setup',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const communityBank = card(page, 'Sample Community Bank');

			await step('Savings stops syncing from Sample Community Bank', async () => {
				await page.goto('/');
				await openAccount(page, 'Savings');
				await page.getByRole('button', { name: 'Savings actions' }).click();
				await page
					.getByRole('menuitem', { name: 'Stop syncing from Sample Community Bank' })
					.click();
				await expect(page.getByRole('status').filter({ hasText: /^Stopped/ })).toHaveText(
					'Stopped syncing from Sample Community Bank. Its Transactions stay; bring it back from the Bank page.'
				);
				await expect(page.getByTestId('account-sync')).not.toContainText('Sample Community Bank');
			});

			await step('the Bank card lists it under Ignored bank Accounts', async () => {
				await openBank(page);
				await expect(communityBank).toContainText('Feeds no Budge Account yet.');
				await expect(
					communityBank.getByRole('region', { name: 'Ignored bank Accounts' })
				).toBeVisible();
			});

			await step('Bring back offers it for setup and focuses Set up', async () => {
				await communityBank
					.getByRole('button', { name: 'Bring back Sample Statement Savings ending 6604' })
					.click();
				await expect(communityBank.getByRole('status')).toHaveText(
					'Brought back. Set it up to choose where its rows go.'
				);
				await expect(
					communityBank.getByRole('region', { name: 'Ignored bank Accounts' })
				).toHaveCount(0);
				await expect(
					communityBank.getByRole('button', { name: 'Set up Sample Statement Savings ending 6604' })
				).toBeFocused();
				await expect(
					communityBank.getByRole('region', { name: 'New bank Accounts' })
				).toContainText('No transactions waiting yet');
			});
		}
	}
} satisfies Record<string, Journey>;
