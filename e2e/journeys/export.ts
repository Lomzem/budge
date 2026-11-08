import { readFile } from 'node:fs/promises';

import { expect, type Download } from '@playwright/test';

import { openBudget, type Journey } from './journey';

async function text(download: Download) {
	return readFile(await download.path(), 'utf8');
}

export const exportJourneys = {
	files: {
		title:
			'exports every table as JSON and paced CSV downloads, past Chromium’s ten-file burst limit',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const dialog = page.getByRole('dialog', { name: 'Export' });

			await step('open Export from the menu', async () => {
				await openBudget(page);
				await page.getByRole('button', { name: 'Menu' }).click();
				await page.getByRole('menuitem', { name: 'Export…' }).click();
			});

			const { date, tables } = await step(
				'Download JSON saves every table but the derived totals',
				async () => {
					const jsonDownload = page.waitForEvent('download');
					await dialog.getByRole('button', { name: 'Download JSON' }).click();
					const json = await jsonDownload;
					const date = /^budge-(\d{4}-\d{2}-\d{2})\.json$/.exec(json.suggestedFilename())?.[1];
					if (date === undefined) throw new Error('The JSON file name has no date.');
					const exported = JSON.parse(await text(json)) as Record<string, { name?: string }[]>;
					expect(exported.monthlyTotals).toBeUndefined();
					expect(exported.accounts?.map((account) => account.name)).toContain('Checking');
					return { date, tables: Object.keys(exported) };
				}
			);

			await step('Download CSV saves one file per table', async () => {
				const csvDownloads: Download[] = [];
				page.on('download', (download) => csvDownloads.push(download));
				await dialog.getByRole('button', { name: 'Download CSV' }).click();
				await expect
					.poll(() => csvDownloads.map((download) => download.suggestedFilename()).sort(), {
						timeout: 15_000
					})
					.toEqual(tables.map((table) => `budge-${date}-${table}.csv`).sort());
				const accountsCsv = csvDownloads.find((download) =>
					download.suggestedFilename().endsWith('-accounts.csv')
				);
				if (!accountsCsv) throw new Error('No accounts CSV was downloaded.');
				expect((await text(accountsCsv)).split('\r\n')[0]).toContain('name');
				expect(await text(accountsCsv)).toContain('Checking');
			});
		}
	}
} satisfies Record<string, Journey>;
