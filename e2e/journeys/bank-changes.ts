import { expect, type Page } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
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
		title:
			"taking the bank's version updates a changed row in its editor and deletes a removed one from its row",
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

			await step('the removed streaming row is deleted from its row', async () => {
				const streaming = rowOf(page, 'SAMPLE STREAMING 4410');
				await expect(streaming).toContainText('Bank removed this');
				await streaming
					.getByRole('button', { name: /^Delete it: SAMPLE STREAMING 4410, / })
					.click();
				const confirm = page.getByRole('alertdialog', { name: 'Delete this Transaction too?' });
				await expect(confirm).toContainText('The bank removed SAMPLE STREAMING 4410.');
				await confirm.getByRole('button', { name: 'Delete' }).click();
				await expect(confirm).toBeHidden();
				await expect(streaming).toHaveCount(0);
				await expect(page.locator('[data-edit]:focus')).toHaveCount(1);
			});
		}
	},
	'late-delete': {
		title:
			'a delete that finishes after its confirmation was dismissed leaves the next confirmation open',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const deleting = await holdResponseTo(page, 'imports:resolveBankChange');
			const confirm = page.getByRole('alertdialog', { name: 'Delete this Transaction too?' });
			const streaming = rowOf(page, 'SAMPLE STREAMING 4410');
			const gym = rowOf(page, 'SAMPLE GYM 5521');

			await step('open Checking', () => openChecking(page));

			await step('delete the streaming row, hold the delete, and dismiss', async () => {
				await streaming
					.getByRole('button', { name: /^Delete it: SAMPLE STREAMING 4410, / })
					.click();
				await confirm.getByRole('button', { name: 'Delete' }).click();
				await deleting.held;
				await page.keyboard.press('Escape');
				await expect(confirm).toBeHidden();
			});

			await step('from the keyboard, confirm the gym row, then release', async () => {
				await gym.getByRole('button', { name: /^Delete it: SAMPLE GYM 5521, / }).focus();
				await page.keyboard.press('Enter');
				await expect(confirm).toContainText('The bank removed SAMPLE GYM 5521.');
				deleting.release();
				await expect(streaming).toHaveCount(0);
			});

			await step('the gym confirmation stays open and deletes its own row', async () => {
				await expect(confirm).toBeVisible();
				await expect(confirm).toContainText('The bank removed SAMPLE GYM 5521.');
				await confirm.getByRole('button', { name: 'Delete' }).click();
				await expect(confirm).toBeHidden();
				await expect(gym).toHaveCount(0);
			});
		}
	},
	'keep-mine': {
		title:
			'keeping mine, from the row or its editor, clears the bank flag and leaves my Transaction as I edited it',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			await step('open Checking', () => openChecking(page));

			await step('the changed garden-center row keeps my $40.00 from its row', async () => {
				const garden = rowOf(page, 'SAMPLE GARDEN CENTER 7720');
				await expect(garden).toContainText('Bank changed this');
				await expect(
					garden.getByRole('button', {
						name: /^Use the bank's −\$44\.75: SAMPLE GARDEN CENTER 7720, /
					})
				).toBeVisible();
				await garden
					.getByRole('button', { name: /^Keep mine: SAMPLE GARDEN CENTER 7720, / })
					.click();
				await expect(garden).toContainText('$40.00');
				await expect(garden).not.toContainText('Bank changed this');
				await expect(garden.getByRole('button', { name: /^Keep mine/ })).toHaveCount(0);
				await expect(
					garden.getByRole('button', { name: /^SAMPLE GARDEN CENTER 7720/ })
				).toBeFocused();
			});

			await step('the removed streaming row stays, with my memo', async () => {
				const streaming = rowOf(page, 'SAMPLE STREAMING 4410');
				const removed = await openBankChange(page, 'SAMPLE STREAMING 4410', 'Bank removed this');
				const banner = removed.getByRole('region', { name: 'Your bank removed this Transaction' });
				await expect(banner).toBeFocused();
				await expect(banner).toContainText('Bank Text: SAMPLE STREAMING 4410');
				await removed.getByRole('button', { name: 'Keep mine' }).click();
				await expect(removed).toBeHidden();
				await expect(streaming).toContainText('Shared family plan');
				await expect(streaming).not.toContainText('Bank removed this');
			});
		}
	}
} satisfies Record<string, Journey>;
