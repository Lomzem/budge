import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from '@playwright/test';

import { formatCents, parseCents } from '../src/lib/domain/money';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

interface SyncMessage {
	type?: string;
	requestId?: number;
	udfPath?: string;
}

async function delayFromMutationResponse(page: Page, udfPath: RegExp) {
	const delayed: (() => void)[] = [];
	let watched: number | undefined;
	let state: 'waiting' | 'delaying' | 'released' = 'waiting';
	await page.routeWebSocket(/\/api\/[^/]+\/sync$/, (client) => {
		const server = client.connectToServer();
		client.onMessage((message) => {
			const parsed = JSON.parse(String(message)) as SyncMessage;
			if (
				watched === undefined &&
				parsed.type === 'Mutation' &&
				udfPath.test(parsed.udfPath ?? '')
			) {
				watched = parsed.requestId;
			}
			server.send(message);
		});
		server.onMessage((message) => {
			const parsed = JSON.parse(String(message)) as SyncMessage;
			if (
				state === 'waiting' &&
				parsed.type === 'MutationResponse' &&
				parsed.requestId === watched
			) {
				state = 'delaying';
			}
			if (state !== 'delaying') {
				client.send(message);
				return;
			}
			delayed.push(() => {
				client.send(message);
			});
		});
	});
	return {
		delaying: () => state === 'delaying',
		release: () => {
			state = 'released';
			for (const send of delayed.splice(0)) send();
		}
	};
}

async function openAccount(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: new RegExp(`^${name}`) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function openStartingBalance(page: Page, name: string) {
	await page.getByRole('button', { name: `${name} actions` }).click();
	await page.getByRole('menuitem', { name: 'Starting balance' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: `Starting balance for ${name}` })).toBeVisible();
	return dialog;
}

function centsIn(text: string | null) {
	const cents = parseCents((text ?? '').replace(/^Now /, '').replace('−', '-'));
	if (cents === undefined) throw new Error(`${String(text)} is not an amount.`);
	return cents;
}

test("a starting balance saved from a dismissed dialog lands, and leaves the next Account's dialog alone", async ({
	page
}) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.setViewportSize({ width: 1280, height: 800 });
	const network = await delayFromMutationResponse(page, /^accounts(\.js)?:setStartingBalance$/);
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	await openAccount(page, 'Checking');
	const balanceBefore = centsIn(await page.getByTestId('account-balance').textContent());
	const checking = await openStartingBalance(page, 'Checking');
	const startBefore = centsIn(await checking.getByTestId('current-starting-balance').textContent());
	const startAfter = startBefore + 10_000;
	await checking.getByLabel('Starting balance').fill(formatCents(startAfter).replace('$', ''));
	await checking.getByRole('button', { name: 'Confirm' }).click();
	await expect.poll(network.delaying).toBe(true);
	await page.keyboard.press('Escape');
	await expect(checking).toBeHidden();

	await openAccount(page, 'Savings');
	const savings = await openStartingBalance(page, 'Savings');
	const savingsEntry = '9,999.99';
	await savings.getByLabel('Starting balance').fill(savingsEntry);

	network.release();
	await expect(
		page
			.getByRole('navigation', { name: 'Budget and Accounts' })
			.getByRole('link', { name: /^Checking/ })
	).toContainText(formatCents(balanceBefore - startBefore + startAfter));

	await expect(
		savings.getByRole('heading', { name: 'Starting balance for Savings' })
	).toBeVisible();
	await expect(savings.getByLabel('Starting balance')).toHaveValue(savingsEntry);
	await expect(savings.getByRole('button', { name: 'Confirm' })).toBeEnabled();
	await savings.getByRole('button', { name: 'Cancel' }).click();
	await expect(savings).toBeHidden();

	await openAccount(page, 'Checking');
	const reopened = await openStartingBalance(page, 'Checking');
	await expect(reopened.getByTestId('current-starting-balance')).toHaveText(
		`Now ${formatCents(startAfter)}`
	);
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('account-balance')).toHaveText(
		formatCents(balanceBefore - startBefore + startAfter)
	);
});
