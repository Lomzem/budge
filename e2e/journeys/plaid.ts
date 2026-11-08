import { expect } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
import type { Journey } from './journey';

const unreachable = "Couldn't reach the bank; try again later.";

export const plaid = {
	status: {
		title: 'the sidebar shows when each Bank Connection last synced',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const seededSandboxConnection = page
				.getByRole('list', { name: 'Bank Connections' })
				.getByRole('button', { name: /Sample Bank \(Sandbox\): Synced 2 hours ago/ });
			const dialog = page.getByRole('dialog', { name: 'Sample Bank (Sandbox)' });

			await step('the sidebar says when the sandbox connection last synced', async () => {
				await page.goto('/');
				await expect(seededSandboxConnection).toBeVisible();
			});

			await step(
				'its dialog shows the last sync, and Sync now says it has no bank login',
				async () => {
					await seededSandboxConnection.click();
					await expect(dialog.getByText(/^Last synced /)).toBeVisible();
					await dialog.getByRole('button', { name: 'Sync now' }).click();
					await expect(dialog.getByRole('status')).toHaveText(
						'This Bank Connection has no bank login, so it never syncs.'
					);
				}
			);
		}
	},
	'late-sync': {
		title:
			"a Sync now that finishes after its dialog closed leaves the next Bank Connection's dialog alone",
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const sync = await holdResponseTo(page, 'bankConnections:syncNow');
			const connections = page.getByRole('list', { name: 'Bank Connections' });
			const creditUnion = page.getByRole('dialog', { name: 'Sample Credit Union' });

			await step('Sync now on the sandbox connection, hold it, and close the dialog', async () => {
				await page.goto('/');
				await connections.getByRole('button', { name: /^Sample Bank \(Sandbox\): / }).click();
				const sandbox = page.getByRole('dialog', { name: 'Sample Bank (Sandbox)' });
				await sandbox.getByRole('button', { name: 'Sync now' }).click();
				await sync.held;
				await page.keyboard.press('Escape');
				await expect(sandbox).toBeHidden();
			});

			await step(
				'open Sample Credit Union, watch for the leak, and release the held sync',
				async () => {
					await connections.getByRole('button', { name: /^Sample Credit Union: / }).click();
					await expect(creditUnion.getByRole('button', { name: 'Sync now' })).toBeEnabled();
					await page.evaluate((leak) => {
						new MutationObserver(() => {
							if (document.body.textContent.includes(leak)) document.body.dataset.leaked = leak;
						}).observe(document.body, { subtree: true, childList: true, characterData: true });
					}, 'This Bank Connection has no bank login');
					sync.release();
				}
			);

			await step(
				"its own Sync now reports its own result, and the sandbox's never shows",
				async () => {
					await creditUnion.getByRole('button', { name: 'Sync now' }).click();
					await expect(creditUnion.getByRole('status')).toHaveText(unreachable);
					await expect(page.locator('body')).not.toHaveAttribute('data-leaked');
				}
			);
		}
	},
	attention: {
		title:
			'a Bank Connection that needs a reconnect says so, and a failed reconnect keeps the notice',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const notice = page.getByText('Sample Savings Bank needs you to reconnect', { exact: true });

			await step('only Sample Savings Bank asks for a reconnect', async () => {
				await page.goto('/');
				await expect(notice).toBeVisible();
				await expect(page.getByText('Sample Credit Union needs you to reconnect')).toHaveCount(0);
			});

			await step('a failed Reconnect keeps the notice', async () => {
				await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
				await expect(page.getByRole('status')).toHaveText(unreachable);
				await expect(notice).toBeVisible();
			});

			await step('its dialog says why the last sync failed', async () => {
				await page
					.getByRole('list', { name: 'Bank Connections' })
					.getByRole('button', { name: /Sample Savings Bank: / })
					.click();
				const dialog = page.getByRole('dialog', { name: 'Sample Savings Bank' });
				await expect(dialog.getByText('Sample Savings Bank needs you to reconnect.')).toBeVisible();
				await expect(dialog.getByRole('alert')).toHaveText(
					/failed: The bank needs you to reconnect \(ITEM_LOGIN_REQUIRED\)\.$/
				);
			});
		}
	},
	consent: {
		title: 'a Bank Connection whose consent is ending offers to renew it',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const consent = page
				.getByRole('list', { name: 'Bank Connections' })
				.getByText(/^Consent ends .+, renew$/);

			await step('the sidebar says when consent ends', async () => {
				await page.goto('/');
				await expect(consent).toBeVisible();
			});

			await step(
				'renew opens the connection, reports the failure, and keeps the consent notice',
				async () => {
					await consent.getByRole('button', { name: 'renew' }).click();
					const dialog = page.getByRole('dialog', { name: 'Sample Credit Union' });
					await expect(dialog.getByRole('status')).toHaveText(unreachable);
					await expect(dialog.getByText('Your consent at the bank ends')).toContainText(
						'Reconnect to renew it.'
					);
				}
			);
		}
	},
	'late-renew': {
		title:
			'a renew result that arrives while another Bank Connection is open waits for its own Bank Connection',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const reconnect = await holdResponseTo(page, 'bankConnections:reconnect');
			const connections = page.getByRole('list', { name: 'Bank Connections' });
			const savings = page.getByRole('dialog', { name: 'Sample Savings Bank' });
			const syncNow = savings.getByRole('button', { name: 'Sync now' });

			await step('renew, hold the result, and open Sample Savings Bank', async () => {
				await page.goto('/');
				await connections.getByRole('button', { name: 'renew' }).click();
				await reconnect.held;
				await connections.getByRole('button', { name: /Sample Savings Bank: / }).click();
				await expect(syncNow).toBeDisabled();
			});

			await step('releasing it frees Sync now and shows nothing here', async () => {
				reconnect.release();
				await expect(syncNow).toBeEnabled();
				await expect(savings.getByRole('status')).toHaveCount(0);
				await page.keyboard.press('Escape');
				await expect(savings).toBeHidden();
			});

			await step('Sample Credit Union shows its own renew result', async () => {
				await connections.getByRole('button', { name: /Sample Credit Union: / }).click();
				const creditUnion = page.getByRole('dialog', { name: 'Sample Credit Union' });
				await expect(creditUnion.getByRole('status')).toHaveText(unreachable);
			});
		}
	}
} satisfies Record<string, Journey>;
