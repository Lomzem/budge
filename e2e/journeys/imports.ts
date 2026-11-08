import { expect, type Page } from '@playwright/test';

import { localToday } from '../../src/lib/domain/dates';
import { holdResponseTo } from '../heldResponse';
import { openAccount, type Journey } from './journey';

function inventedCapitalOneCheckingAndSavingsCsv(description: string, amount: string) {
	const [year, month, day] = localToday().split('-');
	return [
		'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
		`0000,${description},${month ?? ''}/${day ?? ''}/${year ?? ''},Debit,${amount},100.00`
	].join('\n');
}

async function chooseFile(page: Page, csv: string) {
	const dialog = page.getByRole('dialog', { name: 'Import a bank file' });
	await dialog.getByLabel('File').setInputFiles({
		name: 'savings.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv)
	});
	await expect(dialog.getByRole('status')).toHaveText(/^1 new Transaction, 0 Matches/);
}

export const imports = {
	approve: {
		title: 'an imported row arrives Unapproved and Approve clears it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const dialog = page.getByRole('dialog', { name: 'Import a bank file' });
			const approve = page.getByRole('button', { name: /^Approve SAMPLE E2E BOOKSHOP/ });

			await step('the sidebar counts Unapproved Transactions; open Savings', async () => {
				await page.goto('/');
				const sidebar = page.getByRole('navigation', { name: 'Budget and Accounts' });
				await expect(
					sidebar.getByRole('link', { name: /^Accounts\s*,?\s*\d+ Unapproved$/ })
				).toBeVisible();
				await openAccount(page, 'Savings');
			});

			await step('importing a one-row file previews and saves it', async () => {
				await page.getByRole('button', { name: 'Import file' }).click();
				await expect(dialog.getByLabel('Account')).toHaveValue(/.+/);
				await chooseFile(
					page,
					inventedCapitalOneCheckingAndSavingsCsv('SAMPLE E2E BOOKSHOP', '23.45')
				);
				await dialog.getByRole('button', { name: 'Save' }).click();
				await expect(dialog).toBeHidden();
			});

			await step('the row arrives Unapproved, and Approve clears it', async () => {
				await expect(approve).toBeVisible();
				await approve.click();
				await expect(approve).toBeHidden();
				await expect(page.getByRole('button', { name: /^SAMPLE E2E BOOKSHOP/ })).toBeVisible();
			});
		}
	},
	'late-save': {
		title: 'an import save that finishes after the dialog was closed leaves the next opening alone',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const commit = await holdResponseTo(page, 'imports:commit');
			const dialog = page.getByRole('dialog', { name: 'Import a bank file' });

			await step('save an import into Savings, hold its response, and cancel', async () => {
				await page.goto('/');
				await openAccount(page, 'Savings');
				await page.getByRole('button', { name: 'Import file' }).click();
				await chooseFile(
					page,
					inventedCapitalOneCheckingAndSavingsCsv('SAMPLE E2E SLOW CAFE', '9.87')
				);
				await dialog.getByRole('button', { name: 'Save' }).click();
				await commit.held;
				await dialog.getByRole('button', { name: 'Cancel' }).click();
				await expect(dialog).toBeHidden();
			});

			await step('reopen Import file, then release the held save', async () => {
				await page.getByRole('button', { name: 'Import file' }).click();
				await expect(dialog.getByLabel('File')).toHaveValue('');
				await expect(dialog.getByLabel('File')).toBeEnabled();
				commit.release();
			});

			await step(
				'the import lands in the list, and the reopened dialog stays empty and usable',
				async () => {
					await expect(
						page.getByRole('button', { name: /^SAMPLE E2E SLOW CAFE/ }).first()
					).toBeVisible();
					await expect(dialog.getByLabel('File')).toBeEnabled();
					await expect(dialog).toHaveAttribute('data-state', 'open');
					await expect(dialog.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
