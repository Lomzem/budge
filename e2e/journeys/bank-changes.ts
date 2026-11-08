import { expect, type Page } from '@playwright/test';

import { openAccount, type Journey } from './journey';

function rowOf(page: Page, payee: string) {
	return page
		.getByRole('row')
		.filter({ has: page.getByRole('button', { name: new RegExp(`^${payee}`) }) });
}

async function openBankChange(page: Page, payee: string, flag: string) {
	const row = rowOf(page, payee);
	await expect(row).toContainText(flag);
	await row.getByRole('button', { name: new RegExp(`^${payee}`) }).click();
	return page.getByRole('dialog', { name: 'Edit Transaction' });
}

async function openChecking(page: Page) {
	await page.goto('/');
	await openAccount(page, 'Checking');
}

export const bankChanges = {
	'take-the-banks': {
		title: "taking the bank's version updates a changed row and deletes a removed one",
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			await step('open Checking', () => openChecking(page));

			await step("the changed garden-center row takes the bank's $44.75", async () => {
				const garden = rowOf(page, 'SAMPLE GARDEN CENTER 7720');
				const changed = await openBankChange(
					page,
					'SAMPLE GARDEN CENTER 7720',
					'Bank changed this'
				);
				const banner = changed.getByRole('region', { name: 'Your bank changed this Transaction' });
				await expect(banner).toBeFocused();
				await expect(banner.getByText(/^The bank now says −\$44\.75 on /)).toBeVisible();
				await changed.getByRole('button', { name: "Use the bank's version" }).click();
				await expect(changed).toBeHidden();
				await expect(garden).toContainText('$44.75');
				await expect(garden).not.toContainText('Bank changed this');
			});

			await step('the removed streaming row is deleted', async () => {
				const streaming = rowOf(page, 'SAMPLE STREAMING 4410');
				const removed = await openBankChange(page, 'SAMPLE STREAMING 4410', 'Bank removed this');
				const banner = removed.getByRole('region', { name: 'Your bank removed this Transaction' });
				await expect(banner).toBeFocused();
				await expect(banner.getByText(/^The bank removed it\./)).toBeVisible();
				await removed.getByRole('button', { name: 'Delete it' }).click();
				const confirm = page.getByRole('alertdialog', { name: 'Delete this Transaction too?' });
				await confirm.getByRole('button', { name: 'Delete' }).click();
				await expect(confirm).toBeHidden();
				await expect(removed).toBeHidden();
				await expect(streaming).toHaveCount(0);
			});
		}
	},
	'keep-mine': {
		title: 'keeping mine clears the bank flag and leaves my Transaction as I edited it',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			await step('open Checking', () => openChecking(page));

			await step('the changed garden-center row keeps my $40.00', async () => {
				const garden = rowOf(page, 'SAMPLE GARDEN CENTER 7720');
				const changed = await openBankChange(
					page,
					'SAMPLE GARDEN CENTER 7720',
					'Bank changed this'
				);
				await changed.getByRole('button', { name: 'Keep mine' }).click();
				await expect(changed).toBeHidden();
				await expect(garden).toContainText('$40.00');
				await expect(garden).not.toContainText('Bank changed this');
			});

			await step('the removed streaming row stays, with my memo', async () => {
				const streaming = rowOf(page, 'SAMPLE STREAMING 4410');
				const removed = await openBankChange(page, 'SAMPLE STREAMING 4410', 'Bank removed this');
				await removed.getByRole('button', { name: 'Keep mine' }).click();
				await expect(removed).toBeHidden();
				await expect(streaming).toContainText('Shared family plan');
				await expect(streaming).not.toContainText('Bank removed this');
			});
		}
	}
} satisfies Record<string, Journey>;
