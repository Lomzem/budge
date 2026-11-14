import { expect, type Locator, type Page } from '@playwright/test';

import { answerInsteadOfServer, holdResponseTo } from '../heldResponse';
import { expectClearOf, expectNothingPastTheRightEdge, openAccount, type Journey } from './journey';

const notSetUp = "Bank sync isn't set up on this server.";
const syncThatHeldRowsForSetup = { kind: 'synced', added: 1, matched: 0, held: 2 };
const largestReconnect = { kind: 'synced', added: 1000, matched: 1, held: 199 };
const PLAID_LINK_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
const plaidLinkThatSucceedsAtOnce = `window.Plaid = {
	create: (config) => ({
		open: () => config.onSuccess('public-synthetic-not-real', null),
		destroy: () => {}
	})
};`;
const SLOWER_THAN_RECENT_INPUT_MS = 1_000;
const noLogin = 'A sample connection with no bank login, so it can’t sync or reconnect.';

function card(page: Page, name: string) {
	return page
		.getByRole('list', { name: 'Bank Connections' })
		.getByRole('article', { name, exact: true });
}

async function expectUnclipped(text: Locator) {
	const clippedBy = await text.evaluate((element) => {
		const box = element.getBoundingClientRect();
		for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
			if (getComputedStyle(parent).overflow === 'visible') continue;
			const frame = parent.getBoundingClientRect();
			const inside =
				box.top >= frame.top - 0.5 &&
				box.bottom <= frame.bottom + 0.5 &&
				box.left >= frame.left - 0.5 &&
				box.right <= frame.right + 0.5;
			if (!inside || parent.scrollHeight > parent.clientHeight + 1)
				return parent.outerHTML.slice(0, 80);
		}
		return null;
	});
	expect(clippedBy, `${String(text)} is clipped`).toBeNull();
}

async function tap(target: Locator) {
	const box = await target.boundingBox();
	if (box === null) throw new Error(`${String(target)} has no box on screen.`);
	const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
	const touch = await target.page().context().newCDPSession(target.page());
	await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
	await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await touch.detach();
}

async function fakePlaidLinkOnceTheCachedPageLoaded(page: Page) {
	await page.route(PLAID_LINK_SCRIPT, (route) =>
		route.fulfill({ contentType: 'text/javascript', body: plaidLinkThatSucceedsAtOnce })
	);
	return () => page.unroute(PLAID_LINK_SCRIPT);
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
		title:
			'two Sync nows that finish late each report only on their own connection, and the result moves nothing',
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
					await page.waitForTimeout(SLOWER_THAN_RECENT_INPUT_MS);
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
	'sync-waiting': {
		title:
			'a Sync now that leaves rows waiting for setup says so in full, Set up comes next by keyboard, and the largest Reconnect result keeps its summary whole with its matches under Details (the answers stand in for Plaid, which the local server cannot reach)',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const bank = await answerInsteadOfServer(
				page,
				'bankConnections:syncNow',
				'bankConnections:reconnect',
				'bankConnections:syncAfterReconnect'
			);
			const creditUnion = card(page, 'Sample Credit Union');
			const waiting = '1 Transaction added. 2 wait for setup below.';
			const tabBar = page.getByRole('navigation', { name: 'Sections', exact: true });

			for (const width of [320, 390, 1280]) {
				await step(
					`at ${String(width)} px, the result names what waits and stays whole`,
					async () => {
						await page.goto('about:blank');
						await page.setViewportSize({ width, height: width < 640 ? 740 : 800 });
						await openBank(page);
						const syncNow = creditUnion.getByRole('button', { name: 'Sync now' });
						await syncNow.click();
						await bank.called('bankConnections:syncNow');
						await expect(creditUnion.getByRole('button', { name: 'Syncing…' })).toBeFocused();
						await bank.answer('bankConnections:syncNow', syncThatHeldRowsForSetup);
						await expect(creditUnion.getByRole('status')).toHaveText(waiting);
						const shown = creditUnion.getByRole('paragraph').getByText(waiting, { exact: true });
						await expect(shown).toBeVisible();
						await expectUnclipped(shown);
						await shown.scrollIntoViewIfNeeded();
						await expectClearOf(shown, ...(width < 640 ? [tabBar] : []));
						await expectNothingPastTheRightEdge(page);
					}
				);

				await step(`at ${String(width)} px, Tab from Sync now reaches Set up`, async () => {
					await page.keyboard.press('Tab');
					const setUp = creditUnion.getByRole('button', { name: /^Set up / }).first();
					await expect(setUp).toBeFocused();
					const name = (await setUp.getAttribute('aria-label'))?.replace(/^Set up /, '') ?? '';
					await page.keyboard.press('Enter');
					const dialog = page.getByRole('dialog', { name, exact: true });
					await expect(dialog).toBeVisible();
					await page.keyboard.press('Escape');
					await expect(dialog).toBeHidden();
				});
			}

			for (const width of [320, 390]) {
				await step(
					`at ${String(width)} px, the largest Reconnect result reads whole, and Details opens by touch and by keyboard`,
					async () => {
						await page.goto('about:blank');
						await page.setViewportSize({ width, height: 740 });
						await openBank(page);
						const stopFakingPlaidLink = await fakePlaidLinkOnceTheCachedPageLoaded(page);
						const reconnect = creditUnion.getByRole('button', { name: 'Reconnect', exact: true });
						await reconnect.click();
						await bank.answer('bankConnections:reconnect', {
							linkToken: 'link-synthetic-not-real'
						});
						await bank.answer('bankConnections:syncAfterReconnect', largestReconnect);
						const summary = 'Reconnected. 1000 Transactions added. 199 wait for setup below.';
						const matched = '1 matched a Transaction you entered.';
						await expect(creditUnion.getByRole('status')).toHaveText(`${summary} ${matched}`);
						const shown = creditUnion.getByRole('paragraph').getByText(summary, { exact: true });
						await expect(shown).toBeVisible();
						await expectUnclipped(shown);
						await shown.scrollIntoViewIfNeeded();
						await expectClearOf(
							shown,
							tabBar,
							reconnect,
							creditUnion.getByRole('button', { name: 'Sync now' })
						);

						const details = creditUnion.getByRole('button', { name: 'Details' });
						const detail = creditUnion.getByText(matched, { exact: true });
						await expect(details).toHaveAttribute('aria-expanded', 'false');
						await expect(detail).toBeHidden();
						await tap(details);
						await expect(details).toHaveAttribute('aria-expanded', 'true');
						await expect(detail).toBeVisible();
						await detail.scrollIntoViewIfNeeded();
						await expectClearOf(detail, tabBar);
						await expectNothingPastTheRightEdge(page);

						await details.focus();
						await page.keyboard.press('Enter');
						await expect(detail).toBeHidden();
						await page.keyboard.press('Space');
						await expect(detail).toBeVisible();
						await stopFakingPlaidLink();
					}
				);
			}
		}
	},
	'superseded-sync': {
		title:
			'a Sync now that finishes after a newer Stop syncing or Bring back leaves their report and focus, and its late failure still shows (the answers stand in for Plaid)',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const bank = await answerInsteadOfServer(page, 'bankConnections:syncNow');
			const communityBank = card(page, 'Sample Community Bank');
			const label = 'Sample Statement Savings ending 6604';
			const stopped = `Stopped syncing ${label}. Its Transactions stay in Savings.`;
			const broughtBack = 'Brought back. Set it up to choose where its new transactions go.';
			const status = communityBank.getByRole('status');
			const syncNow = communityBank.getByRole('button', { name: /^(Sync now|Syncing…)$/ });
			const actions = communityBank.getByRole('button', { name: 'Sample Community Bank actions' });
			const setUp = communityBank.getByRole('button', { name: `Set up ${label}` });
			const shown = (text: string) =>
				communityBank.getByRole('paragraph').getByText(text, { exact: true });

			await step('Sync now, then Stop syncing while it runs', async () => {
				await openBank(page);
				await syncNow.click();
				await bank.called('bankConnections:syncNow');
				await actions.click();
				await page.getByRole('menuitem', { name: `Stop syncing ${label}` }).click();
				await expect(status).toHaveText(stopped);
				await expect(actions).toBeFocused();
			});

			await step(
				'the older Sync now succeeds late and leaves the Stop syncing report',
				async () => {
					await bank.answer('bankConnections:syncNow', {
						kind: 'synced',
						added: 3,
						matched: 0,
						held: 0
					});
					await expect(syncNow).toHaveText('Sync now');
					await expect(syncNow).toBeEnabled();
					await expect(status).toHaveText(stopped);
					await expect(shown(stopped)).toBeVisible();
					await expect(actions).toBeFocused();
				}
			);

			await step('Sync now again, then Bring back while it runs', async () => {
				await syncNow.click();
				await bank.called('bankConnections:syncNow');
				await communityBank.getByRole('button', { name: `Bring back ${label}` }).click();
				await expect(status).toHaveText(broughtBack);
				await expect(setUp).toBeFocused();
			});

			await step(
				'the older Sync now fails late: the Bring back report and focus stay, and the failure shows',
				async () => {
					await bank.refuse('bankConnections:syncNow', {
						code: 'BANK_SYNC_UNAVAILABLE',
						message: notSetUp
					});
					await expect(syncNow).toHaveText('Sync now');
					await expect(status).toHaveText(broughtBack);
					await expect(shown(broughtBack)).toBeVisible();
					await expect(setUp).toBeFocused();
					await expect(
						communityBank.getByRole('listitem').filter({ hasText: `Sync now failed: ${notSetUp}` })
					).toBeVisible();
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

			await step('Savings stops syncing Sample Statement Savings', async () => {
				await page.goto('/');
				await openAccount(page, 'Savings');
				await page.getByRole('button', { name: 'Savings actions' }).click();
				await page
					.getByRole('menuitem', { name: 'Stop syncing Sample Statement Savings ending 6604' })
					.click();
				await expect(page.getByRole('status').filter({ hasText: /^Stopped/ })).toHaveText(
					'Stopped syncing Sample Statement Savings ending 6604. Its Transactions stay in Savings. Bring it back from the Bank page.'
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
					'Brought back. Set it up to choose where its new transactions go.'
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
