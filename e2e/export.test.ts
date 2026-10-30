import { readFile } from 'node:fs/promises';

import { clerk } from '@clerk/testing/playwright';
import { expect, test, type Download } from '@playwright/test';

// Runs on the local backend after CI's `seed:run`, so Checking exists.
const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;

async function text(download: Download) {
	return readFile(await download.path(), 'utf8');
}

test('the owner exports the budget as JSON and as CSV', async ({ page }) => {
	if (!ownerEmail) throw new Error('E2E_CLERK_USER_EMAIL is not set.');

	await page.goto('/sign-in');
	await clerk.signIn({ page, emailAddress: ownerEmail });
	await page.goto('/');

	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByRole('menuitem', { name: 'Export…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export' });

	const jsonDownload = page.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Download JSON' }).click();
	const json = await jsonDownload;
	const date = /^budge-(\d{4}-\d{2}-\d{2})\.json$/.exec(json.suggestedFilename())?.[1];
	if (date === undefined) throw new Error('The JSON file name has no date.');
	const exported = JSON.parse(await text(json)) as Record<string, { name?: string }[]>;
	expect(exported.monthlyTotals).toBeUndefined();
	expect(exported.accounts?.map((account) => account.name)).toContain('Checking');

	const csvDownloads: Download[] = [];
	page.on('download', (download) => csvDownloads.push(download));
	await dialog.getByRole('button', { name: 'Download CSV' }).click();
	await expect
		.poll(() => csvDownloads.map((download) => download.suggestedFilename()).sort())
		.toEqual(
			Object.keys(exported)
				.map((table) => `budge-${date}-${table}.csv`)
				.sort()
		);
	const accountsCsv = csvDownloads.find((download) =>
		download.suggestedFilename().endsWith('-accounts.csv')
	);
	if (!accountsCsv) throw new Error('No accounts CSV was downloaded.');
	expect((await text(accountsCsv)).split('\r\n')[0]).toContain('name');
	expect(await text(accountsCsv)).toContain('Checking');
});
