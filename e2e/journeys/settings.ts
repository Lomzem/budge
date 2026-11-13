import { expect, type Page } from '@playwright/test';

import { addDays, formatMonth, localToday, monthOf } from '../../src/lib/domain/dates';
import { openBudget, type Journey } from './journey';

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
				await importing.getByLabel('File').setInputFiles({
					name: 'checking.csv',
					mimeType: 'text/csv',
					buffer: Buffer.from(
						inventedCapitalOneCheckingCsv([
							{ date: '2026-10-31', description: 'SAMPLE E2E BEFORE START' },
							{ date: start, description: 'SAMPLE E2E ON START' }
						])
					)
				});
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
			'the first cutover date gates Add Account, survives reload and cancel, bounds the months, and refuses to pass a Transaction',
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

			await step('moving the date past a Starting Balance is refused', async () => {
				await page.getByRole('main').getByRole('button', { name: 'Add Account' }).click();
				const dialog = page.getByRole('dialog', { name: 'Add Account' });
				await dialog.getByLabel('Name').fill('Research Checking');
				await dialog.getByLabel('Cash, such as checking or savings').check();
				await dialog.getByLabel('Current balance').fill('100');
				await dialog.getByRole('button', { name: 'Add Account' }).click();
				await expect(
					page.getByRole('heading', { level: 1, name: 'Research Checking' })
				).toBeVisible();
				await page.goto('/settings');
				await region.getByRole('button', { name: 'Change' }).click();
				await saveCutover(page, cutover);
				await expect(region.getByRole('alert')).toHaveText('A Transaction is dated before that.');
				await page.reload();
				await expectCutover(page, dayEarlier);
			});
		}
	}
} satisfies Record<string, Journey>;
