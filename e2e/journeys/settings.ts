import { expect, type Page } from '@playwright/test';

import {
	addDays,
	dayOfMonth,
	formatDate,
	formatMonth,
	localToday,
	monthOf
} from '../../src/lib/domain/dates';
import {
	centsIn,
	chooseBankFile,
	expectClearOf,
	expectNothingPastTheRightEdge,
	openAccount,
	openBudget,
	typed,
	type Journey
} from './journey';

function inventedCapitalOneCheckingCsv(rows: { date: string; description: string }[]) {
	return [
		'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
		...rows.map(({ date, description }) => {
			const [year, month, day] = date.split('-');
			return `0000,${description},${month ?? ''}/${day ?? ''}/${year ?? ''},Debit,12.00,100.00`;
		})
	].join('\n');
}

function cutoverRegion(page: Page) {
	return page.getByRole('region', { name: 'Cutover date', exact: true });
}

async function expectCutover(page: Page, date: string) {
	await expect(cutoverRegion(page).locator(`time[datetime="${date}"]`)).toBeVisible();
}

function previewDialog(page: Page, date: string) {
	return page.getByRole('dialog', { name: `Start on ${formatDate(date)}?` });
}

async function saveCutover(page: Page, date: string) {
	const region = cutoverRegion(page);
	await region.getByLabel('Cutover date').fill(date);
	await region.getByRole('button', { name: 'Save' }).click();
}

export const settings = {
	start: {
		title:
			'the Budget and the Bank page propose the first of the local month, not the UTC one, on each side of a month boundary, and a file import starts there',
		fixture: 'empty-budget',
		run: async (page, { step }) => {
			const octobersLastLocalMinuteButNovemberInUtc = new Date('2026-11-01T06:59:00Z');
			const novembersFirstLocalMinute = new Date('2026-11-01T07:01:00Z');
			const region = cutoverRegion(page);
			const start = '2026-11-01';

			await step(
				'a minute before the month turns, last month’s first day is proposed',
				async () => {
					await page.clock.setFixedTime(octobersLastLocalMinuteButNovemberInUtc);
					await openBudget(page);
					await expect(region.getByLabel('Cutover date')).toHaveValue('2026-10-01');
				}
			);

			await step(
				'a minute after, the Bank page proposes the new month’s first day and saves it',
				async () => {
					await page.clock.setFixedTime(novembersFirstLocalMinute);
					await page.goto('/bank');
					await expect(region.getByLabel('Cutover date')).toHaveValue(start);
					await region.getByRole('button', { name: 'Save' }).click();
					await expectCutover(page, start);
					await expect(region.getByRole('button', { name: 'Change' })).toBeFocused();
				}
			);

			await step('a bank file into a new Account brings in only rows from the start', async () => {
				await openBudget(page);
				await page.getByRole('main').getByRole('button', { name: 'Add Account' }).click();
				const addAccount = page.getByRole('dialog', { name: 'Add Account' });
				await addAccount.getByLabel('Name').fill('Start Checking');
				await addAccount.getByLabel('Cash, such as checking or savings').check();
				await addAccount.getByLabel('Current balance').fill('100');
				await addAccount.getByRole('button', { name: 'Add Account' }).click();
				await expect(page.getByRole('heading', { level: 1, name: 'Start Checking' })).toBeVisible();

				await page.getByRole('button', { name: 'Import file' }).click();
				const importing = page.getByRole('dialog', { name: 'Import a bank file' });
				await chooseBankFile(
					page,
					'checking.csv',
					inventedCapitalOneCheckingCsv([
						{ date: '2026-10-31', description: 'SAMPLE E2E BEFORE START' },
						{ date: start, description: 'SAMPLE E2E ON START' }
					])
				);
				await expect(importing.getByRole('status')).toHaveText(/^1 new Transaction, 0 Matches/);
				await expect(importing.getByText('SAMPLE E2E BEFORE START')).toHaveCount(0);
				await importing.getByRole('button', { name: 'Import 1 row' }).click();
				await expect(importing).toBeHidden();
				await expect(
					page
						.getByRole('navigation', { name: 'Sections and Accounts' })
						.getByRole('link', { name: 'Accounts 1 Unapproved' })
				).toBeVisible();
			});
		}
	},
	cutover: {
		title:
			'the first cutover date gates Add Account, survives reload and cancel, bounds the months, and moves later through a preview when nothing is dated before',
		fixture: 'empty-budget',
		run: async (page, { step }) => {
			const cutover = addDays(localToday(), -40);
			const dayEarlier = addDays(cutover, -1);
			const region = cutoverRegion(page);

			await step('before a date, there is no Cancel and Add Account points to Budget', async () => {
				await openBudget(page);
				await expect(region.getByLabel('Cutover date')).toBeVisible();
				await expect(region.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
				await page.getByRole('complementary').getByRole('button', { name: 'Add Account' }).click();
				const dialog = page.getByRole('dialog', { name: 'Add Account' });
				await expect(dialog).toContainText('Set the cutover date first');
				await expect(dialog.getByLabel('Name')).toHaveCount(0);
				await page.keyboard.press('Escape');
				await expect(dialog).toBeHidden();
			});

			await step('saving the first date keeps it on the Budget, then in Settings', async () => {
				await saveCutover(page, cutover);
				await expectCutover(page, cutover);
				await page.reload();
				await expect(region).toHaveCount(0);
				await page.goto('/settings');
				await expectCutover(page, cutover);
			});

			await step(
				'a change cancelled by button or Escape keeps the date; a saved one moves it',
				async () => {
					await region.getByRole('button', { name: 'Change' }).click();
					await region.getByLabel('Cutover date').fill(dayEarlier);
					await region.getByRole('button', { name: 'Cancel' }).click();
					await expectCutover(page, cutover);
					await region.getByRole('button', { name: 'Change' }).click();
					await region.getByLabel('Cutover date').fill(dayEarlier);
					await page.keyboard.press('Escape');
					await expectCutover(page, cutover);
					await expect(region.getByRole('button', { name: 'Change' })).toBeFocused();
					await region.getByRole('button', { name: 'Change' }).click();
					await saveCutover(page, dayEarlier);
					await expectCutover(page, dayEarlier);
					await page.reload();
					await expectCutover(page, dayEarlier);
				}
			);

			await step('Previous month stops at the cutover month', async () => {
				await openBudget(page);
				const previous = page.getByRole('button', { name: 'Previous month' });
				const cutoverMonth = page.getByText(formatMonth(monthOf(dayEarlier)), { exact: true });
				for (let back = 0; back < 3 && !(await cutoverMonth.isVisible()); back++) {
					await previous.click();
				}
				await expect(cutoverMonth).toBeVisible();
				await expect(previous).toBeDisabled();
			});

			await step(
				'a later date with nothing dated before it moves through its preview',
				async () => {
					await page.goto('/settings');
					await region.getByRole('button', { name: 'Change' }).click();
					await saveCutover(page, cutover);
					const preview = previewDialog(page, cutover);
					await expect(preview).toContainText(
						`Nothing is dated before ${formatDate(cutover)}, so moving the date changes no balance and no Transaction.`
					);
					await preview.getByRole('button', { name: 'Move start date' }).click();
					await expect(preview).toBeHidden();
					await expectCutover(page, cutover);
					await expect(region.getByRole('button', { name: 'Change' })).toBeFocused();
					await page.reload();
					await expectCutover(page, cutover);
				}
			);
		}
	},
	'later-start': {
		title:
			'a later cutover date opens a preview of the Starting Balances and budget it would leave; Cancel and Escape change nothing',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const region = cutoverRegion(page);
			const today = localToday();
			const firstOfThisMonth = dayOfMonth(monthOf(today), 1);
			const preview = previewDialog(page, firstOfThisMonth);
			let saved = '';

			await step('a later date opens a readable preview', async () => {
				await page.goto('/settings');
				saved = (await region.locator('time').getAttribute('datetime')) ?? '';
				expect(saved < firstOfThisMonth).toBe(true);
				await region.getByRole('button', { name: 'Change' }).click();
				await saveCutover(page, firstOfThisMonth);
				await expect(preview).toContainText(
					`A preview of moving the cutover date from ${formatDate(saved)}. Nothing changes until you move it.`
				);
				await expect(
					preview.getByRole('heading', {
						name: `Starting Balances on ${formatDate(firstOfThisMonth)}`
					})
				).toBeVisible();
				for (const name of ['Checking', 'Savings', 'Card']) {
					await expect(preview.getByRole('region', { name, exact: true })).toBeVisible();
				}
				const checking = preview.getByRole('region', { name: 'Checking', exact: true });
				await expect(checking).toContainText(
					new RegExp(`Its Starting Balance of \\$[\\d,.]+ on ${formatDate(saved)}, plus`)
				);
				await checking.getByText(/Transactions? that fold in/).click();
				await expect(checking.getByRole('listitem').first()).toBeVisible();
				const budget = preview.getByRole('region', {
					name: `${formatMonth(monthOf(firstOfThisMonth))} budget`
				});
				await expect(budget.getByRole('row', { name: /^Ready to Assign/ })).toBeVisible();
				await expect(budget).toContainText('starts with nothing carried over');
			});

			await step('halfway down the preview, its Cancel button is wholly on screen', async () => {
				const body = preview.locator('[data-slot="dialog-body"]');
				const scrolledHalfway = await body.evaluate((scroller) => {
					scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
					return scroller.scrollTop > 0;
				});
				expect(scrolledHalfway).toBe(true);
				await expectClearOf(preview.getByRole('button', { name: 'Cancel' }));
			});

			await step('Cancel and Escape close it and keep the date', async () => {
				await preview.getByRole('button', { name: 'Cancel' }).click();
				await expect(preview).toBeHidden();
				await expect(region.getByLabel('Cutover date')).toBeFocused();
				await region.getByRole('button', { name: 'Save' }).click();
				await expect(preview).toBeVisible();
				await page.keyboard.press('Escape');
				await expect(preview).toBeHidden();
				await expect(region.getByLabel('Cutover date')).toBeFocused();
				await page.keyboard.press('Escape');
				await expectCutover(page, saved);
				await page.reload();
				await expectCutover(page, saved);
			});

			await step('a date after today says why it has no preview', async () => {
				const tomorrow = addDays(today, 1);
				await region.getByRole('button', { name: 'Change' }).click();
				await saveCutover(page, tomorrow);
				const unsupported = previewDialog(page, tomorrow);
				await expect(unsupported).toContainText(
					'Pick today or an earlier date. Budge can only work out a Starting Balance for a day that has come.'
				);
				await unsupported.getByRole('button', { name: 'Cancel' }).click();
				await expect(unsupported).toBeHidden();
				await page.keyboard.press('Escape');
				await expectCutover(page, saved);
			});

			await step(
				'on a 320 px phone, the preview with every list open stays within the screen',
				async () => {
					await page.setViewportSize({ width: 320, height: 640 });
					await region.getByRole('button', { name: 'Change' }).click();
					await saveCutover(page, firstOfThisMonth);
					await expect(preview).toBeVisible();
					const lists = preview.locator('details');
					await expect(lists.first()).toBeVisible();
					for (const list of await lists.all()) {
						await list.locator('summary').click();
						await expect(list).toHaveAttribute('open', '');
					}
					await expectNothingPastTheRightEdge(page);
					await preview.getByRole('button', { name: 'Cancel' }).click();
					await page.keyboard.press('Escape');
					await expectCutover(page, saved);
				}
			);
		}
	},
	'later-move': {
		title:
			'confirming a later cutover date with Reconciled history needs its unlock, folds the history in, and Settings undoes it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const region = cutoverRegion(page);
			const firstOfThisMonth = dayOfMonth(monthOf(localToday()), 1);
			const firstOfLastMonth = dayOfMonth(monthOf(addDays(firstOfThisMonth, -1)), 1);
			const preview = previewDialog(page, firstOfThisMonth);
			const undo = region.getByRole('button', { name: 'Undo move' });
			let saved = '';

			await step('reconcile Card and leave one earlier Checking row uncleared', async () => {
				await page.setViewportSize({ width: 1280, height: 800 });
				await page.goto('/');
				await openAccount(page, 'Card');
				await page.getByRole('button', { name: 'Reconcile' }).click();
				const reconcile = page.getByRole('dialog');
				const cleared = reconcile.getByTestId('cleared-balance');
				await expect(cleared).toHaveText(/\$/);
				const owed = await centsIn(cleared);
				await reconcile.getByLabel('Amount owed, per the bank').fill(typed(owed));
				await reconcile.getByRole('button', { name: 'Reconcile', exact: true }).click();
				await expect(reconcile).toBeHidden();
				await openAccount(page, 'Checking');
				const earlier = page
					.getByRole('checkbox', {
						name: new RegExp(`^Cleared: .+, ${formatDate(firstOfLastMonth)}$`)
					})
					.first();
				await earlier.click();
				await expect(earlier).not.toBeChecked();
			});

			await step(
				'the preview names the cleared-balance change and asks for the unlock',
				async () => {
					await page.goto('/settings');
					saved = (await region.locator('time').getAttribute('datetime')) ?? '';
					await region.getByRole('button', { name: 'Change' }).click();
					await saveCutover(page, firstOfThisMonth);
					await expect(preview).toContainText(
						/Checking: 1 Transaction \((\S+)\) that haven't cleared count in the Starting Balance as if they had, so the cleared balance changes by \1\./
					);
					await expect(preview).toContainText(/Card: \d+ Transactions \(\S+\) you reconciled/);
					const move = preview.getByRole('button', { name: 'Move start date' });
					await expect(move).toBeDisabled();
					const unlock = preview.getByRole('checkbox', { name: 'Unlock the Reconciled history' });
					await unlock.focus();
					await page.keyboard.press('Space');
					await expect(unlock).toBeChecked();
					await expect(move).toBeEnabled();
				}
			);

			await step(
				'Move start date folds the history in and Settings offers the undo on return',
				async () => {
					await preview.getByRole('button', { name: 'Move start date' }).click();
					await expect(preview).toBeHidden();
					await expect(region.getByRole('button', { name: 'Change' })).toBeFocused();
					await expectCutover(page, firstOfThisMonth);
					await openAccount(page, 'Checking');
					await expect(
						page.getByRole('checkbox', {
							name: new RegExp(`^Cleared: .+, ${formatDate(firstOfLastMonth)}$`)
						})
					).toHaveCount(0);
					await page.goto('/settings');
					await expectCutover(page, firstOfThisMonth);
					await expect(region).toContainText(
						`Starts on ${formatDate(firstOfThisMonth)}, moved from ${formatDate(saved)}.`
					);
					await expect(undo).toHaveAccessibleDescription(
						`Puts the start date back on ${formatDate(saved)}, with the Transactions before ${formatDate(firstOfThisMonth)} back in their Accounts.`
					);
				}
			);

			await step('on a 320 px phone, the undo stays within the screen', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await expect(undo).toBeVisible();
				await expectNothingPastTheRightEdge(page);
			});

			await step('Undo move by keyboard puts the date and the history back', async () => {
				await page.setViewportSize({ width: 1280, height: 800 });
				await page.goto('/settings');
				await undo.focus();
				await page.keyboard.press('Enter');
				await expect(region.getByRole('status')).toHaveText(
					`The start date is back on ${formatDate(saved)}, with its history.`
				);
				await expectCutover(page, saved);
				await expect(undo).toHaveCount(0);
				await expect(region.getByRole('button', { name: 'Change' })).toBeFocused();
				await page.reload();
				await expectCutover(page, saved);
				await expect(undo).toHaveCount(0);
				await openAccount(page, 'Checking');
				await expect(
					page.getByRole('checkbox', {
						name: new RegExp(`^Cleared: .+, ${formatDate(firstOfLastMonth)}$`)
					})
				).not.toHaveCount(0);
			});
		}
	}
} satisfies Record<string, Journey>;
