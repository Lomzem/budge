import { expect, type Page } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
import type { Journey } from './journey';

const notSetUp = "Bank sync isn't set up on this server.";
const noLogin = 'This Bank Connection has no bank login, so it never syncs.';

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
				await expect(sandbox).toContainText('Synced 2 hours ago.');
			});

			await step('Sync now says it has no bank login', async () => {
				await sandbox.getByRole('button', { name: 'Sync now' }).click();
				await expect(sandbox.getByRole('status')).toHaveText(noLogin);
			});
		}
	},
	'late-sync': {
		title: 'two Sync nows that finish late each report only on their own connection',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const sync = await holdResponseTo(page, 'bankConnections:syncNow');
			const sandbox = card(page, 'Sample Bank (Sandbox)');
			const creditUnion = card(page, 'Sample Credit Union');

			await step('Sync now on the sandbox connection, and hold it', async () => {
				await openBank(page);
				await sandbox.getByRole('button', { name: 'Sync now' }).click();
				await sync.held;
				await expect(sandbox.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
			});

			await step('Sync now on Sample Credit Union while the first is held', async () => {
				await creditUnion.getByRole('button', { name: 'Sync now' }).click();
				await expect(creditUnion.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
				await expect(sandbox.getByRole('status')).toHaveText('');
				await expect(creditUnion.getByRole('status')).toHaveText('');
			});

			await step('releasing both reports each result on its own card', async () => {
				sync.release();
				await expect(sandbox.getByRole('status')).toHaveText(noLogin);
				await expect(creditUnion.getByRole('status')).toHaveText(notSetUp);
			});
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
				await expect(card(page, 'Sample Credit Union')).not.toContainText(needsReconnect);
			});

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
		title: 'a Bank Connection whose consent is ending offers to renew it',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const creditUnion = card(page, 'Sample Credit Union');

			await step('the card says when consent ends', async () => {
				await openBank(page);
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

			await step('renew Sample Credit Union and hold the result', async () => {
				await openBank(page);
				await creditUnion.getByRole('button', { name: 'Reconnect', exact: true }).click();
				await reconnect.held;
				await expect(creditUnion.getByRole('button', { name: 'Reconnecting…' })).toBeDisabled();
				await expect(
					savings.getByRole('button', { name: 'Reconnect', exact: true })
				).toBeDisabled();
				await expect(savings.getByRole('button', { name: 'Sync now' })).toBeEnabled();
			});

			await step('releasing it reports on Sample Credit Union only', async () => {
				reconnect.release();
				await expect(creditUnion.getByRole('status')).toHaveText(notSetUp);
				await expect(savings.getByRole('status')).toHaveText('');
				await expect(savings.getByRole('button', { name: 'Reconnect', exact: true })).toBeEnabled();
			});
		}
	}
} satisfies Record<string, Journey>;
