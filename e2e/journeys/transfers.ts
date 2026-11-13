import { expect, type Page } from '@playwright/test';

import { localToday } from '../../src/lib/domain/dates';
import { centsIn, choose, chooseBankFile, openAccount, type Journey } from './journey';

const balance = (page: Page) => () => centsIn(page.getByTestId('account-balance'));

async function importRow(page: Page, bankText: string, type: 'Debit' | 'Credit') {
	const [year, month, day] = localToday().split('-');
	const csv = [
		'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
		`0000,${bankText},${month ?? ''}/${day ?? ''}/${year ?? ''},${type},31.17,100.00`
	].join('\n');
	await page.getByRole('button', { name: 'Import file' }).click();
	const dialog = page.getByRole('dialog', { name: 'Import a bank file' });
	await expect(dialog.getByLabel('Account')).not.toHaveText('Pick an Account');
	await chooseBankFile(page, 'bank.csv', csv);
	await expect(dialog.getByRole('status')).toHaveText(/^1 new Transaction/);
	await dialog.getByRole('button', { name: /^Import \d+ rows?$/ }).click();
	await expect(dialog).toBeHidden();
}

export const transfers = {
	pair: {
		title: 'a Transfer appears in both Accounts, and deleting one side deletes both',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const memo = 'Smoke test Transfer';
			const row = page.getByRole('row').filter({ hasText: memo });
			const dialog = page.getByRole('dialog');

			const before = await step('note the Savings and Checking balances', async () => {
				await page.goto('/');
				await openAccount(page, 'Savings');
				const savings = await balance(page)();
				await openAccount(page, 'Checking');
				return { savings, checking: await balance(page)() };
			});

			await step('a $12.34 Transfer to Savings has no Payee and leaves Checking', async () => {
				await page.getByRole('button', { name: 'Add Transaction' }).click();
				await choose(dialog.getByLabel('Category or Transfer'), 'Transfer: Savings');
				await expect(dialog.getByLabel('Payee')).toBeHidden();
				await dialog.getByLabel('Amount').fill('12.34');
				await dialog.getByLabel('Memo').fill(memo);
				await dialog.getByRole('button', { name: 'Save' }).click();
				await expect(dialog).toBeHidden();
				const otherAccountInPlaceOfACategory = row.getByText('To Savings');
				await expect(otherAccountInPlaceOfACategory.filter({ visible: true })).toBeVisible();
				await expect.poll(balance(page)).toBe(before.checking - 1234);
			});

			await step('it arrives in Savings, from Checking', async () => {
				await openAccount(page, 'Savings');
				expect(await balance(page)()).toBe(before.savings + 1234);
				await expect(row.getByText('From Checking').filter({ visible: true })).toBeVisible();
			});

			await step(
				'deleting from the Savings side takes both sides out and leaves focus on a neighboring row',
				async () => {
					await row.getByRole('button', { name: /^Transfer/ }).click();
					await dialog.getByRole('button', { name: 'Delete' }).click();
					await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
					await expect(row).toHaveCount(0);
					await expect(page.locator('[data-edit]:focus')).toBeVisible();
					await expect.poll(balance(page)).toBe(before.savings);
					await openAccount(page, 'Checking');
					await expect(row).toHaveCount(0);
				}
			);
		}
	},
	'import-link': {
		title: 'a Transfer from an import links the other import instead of a duplicate',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const memo = 'Smoke test linked Transfer';
			const dialog = page.getByRole('dialog');
			const linked = page.getByRole('row').filter({ hasText: memo });
			const leftovers = page.getByRole('row').filter({ hasText: /SAMPLE E2E XFER (IN|OUT)/ });

			await step('import the two sides into Savings and Checking', async () => {
				await page.goto('/');
				await openAccount(page, 'Savings');
				await importRow(page, 'SAMPLE E2E XFER IN', 'Credit');
				await openAccount(page, 'Checking');
				await importRow(page, 'SAMPLE E2E XFER OUT', 'Debit');
			});

			await step(
				"making Checking's import a Transfer offers to link the Savings import",
				async () => {
					await page.getByRole('button', { name: /^SAMPLE E2E XFER OUT/ }).click();
					await choose(dialog.getByLabel('Category or Transfer'), 'Transfer: Savings');
					await expect(
						dialog.getByRole('radio', { name: /^Link the import SAMPLE E2E XFER IN/ })
					).toBeChecked();
					await dialog.getByLabel('Memo').fill(memo);
					await dialog.getByRole('button', { name: 'Save' }).click();
					await expect(dialog).toBeHidden();
					await expect(linked.getByText('To Savings').filter({ visible: true })).toBeVisible();
				}
			);

			await step(
				'the Savings import became the other side, with no Uncategorized duplicate left',
				async () => {
					await openAccount(page, 'Savings');
					await expect(linked).toHaveCount(1);
					await expect(linked.getByText('From Checking').filter({ visible: true })).toBeVisible();
					await expect(leftovers).toHaveCount(0);
				}
			);
		}
	}
} satisfies Record<string, Journey>;
