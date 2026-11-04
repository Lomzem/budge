import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Page } from './test';

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

test.use({ fixture: 'bank-sync' });

async function openChecking(page: Page) {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');
	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');
	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: /^Checking/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Checking' })).toBeVisible();
}

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

test("taking the bank's version updates a changed row and deletes a removed one", async ({
	page
}) => {
	await openChecking(page);

	const garden = rowOf(page, 'SAMPLE GARDEN CENTER 7720');
	const changed = await openBankChange(page, 'SAMPLE GARDEN CENTER 7720', 'Bank changed this');
	await expect(changed.getByText(/^Bank changed this: −\$44\.75 on /)).toBeVisible();
	await changed.getByRole('button', { name: "Use the bank's version" }).click();
	await expect(changed).toBeHidden();
	await expect(garden).toContainText('$44.75');
	await expect(garden).not.toContainText('Bank changed this');

	const streaming = rowOf(page, 'SAMPLE STREAMING 4410');
	const removed = await openBankChange(page, 'SAMPLE STREAMING 4410', 'Bank removed this');
	await expect(removed.getByText('Bank removed this.')).toBeVisible();
	await removed.getByRole('button', { name: 'Delete it' }).click();
	const confirm = page.getByRole('alertdialog', { name: 'Delete this Transaction too?' });
	await confirm.getByRole('button', { name: 'Delete' }).click();
	await expect(confirm).toBeHidden();
	await expect(removed).toBeHidden();
	await expect(streaming).toHaveCount(0);
});

test('keeping mine clears the bank flag and leaves my Transaction as I edited it', async ({
	page
}) => {
	await openChecking(page);

	const garden = rowOf(page, 'SAMPLE GARDEN CENTER 7720');
	const changed = await openBankChange(page, 'SAMPLE GARDEN CENTER 7720', 'Bank changed this');
	await changed.getByRole('button', { name: 'Keep mine' }).click();
	await expect(changed).toBeHidden();
	await expect(garden).toContainText('$40.00');
	await expect(garden).not.toContainText('Bank changed this');

	const streaming = rowOf(page, 'SAMPLE STREAMING 4410');
	const removed = await openBankChange(page, 'SAMPLE STREAMING 4410', 'Bank removed this');
	await removed.getByRole('button', { name: 'Keep mine' }).click();
	await expect(removed).toBeHidden();
	await expect(streaming).toContainText('Shared family plan');
	await expect(streaming).not.toContainText('Bank removed this');
});
