import { readFile } from 'node:fs/promises';

import { expect, type Download } from '@playwright/test';

import type { Journey } from './journey';

const tablesABackupRestores = [
	'accounts',
	'assignments',
	'bankConnections',
	'categories',
	'categoryGroups',
	'connectionAccounts',
	'imports',
	'payeeRenames',
	'payees',
	'settings',
	'transactionSplits',
	'transactions'
];

const downloadsChromiumAllowsInABurst = 10;

export const exportJourneys = {
	files: {
		title:
			'exports every table as JSON and paced CSV downloads, past Chromium’s ten-file burst limit',
		fixture: 'budget-with-accounts',
		run: async (page, { step, keepAsEvidence }) => {
			const dialog = page.getByRole('dialog', { name: 'Export' });
			const text = async (download: Download) => readFile(await keepAsEvidence(download), 'utf8');

			await step('open Export from Settings', async () => {
				await page.goto('/settings');
				await page.getByRole('button', { name: 'Export…' }).click();
			});

			const date = await step(
				'Download JSON saves every table but the rebuildable caches and provider secrets',
				async () => {
					const jsonDownload = page.waitForEvent('download');
					await dialog.getByRole('button', { name: 'Download JSON' }).click();
					const json = await jsonDownload;
					const date = /^budge-(\d{4}-\d{2}-\d{2})\.json$/.exec(json.suggestedFilename())?.[1];
					if (date === undefined) throw new Error('The JSON file name has no date.');
					const exported = JSON.parse(await text(json)) as Record<
						string,
						Record<string, unknown>[]
					>;
					expect(Object.keys(exported).sort()).toEqual([...tablesABackupRestores].sort());
					expect(exported.accounts?.map((account) => account.name)).toContain('Checking');
					expect(exported.bankConnections?.length).toBeGreaterThan(0);
					for (const connection of exported.bankConnections ?? []) {
						expect(connection).not.toHaveProperty('provider');
					}
					await expect(dialog.getByRole('status')).toHaveText(`Downloaded budge-${date}.json.`);
					return date;
				}
			);

			await step('Download CSV saves one file per table', async () => {
				expect(tablesABackupRestores.length).toBeGreaterThan(downloadsChromiumAllowsInABurst);
				const csvDownloads: Download[] = [];
				page.on('download', (download) => csvDownloads.push(download));
				await dialog.getByRole('button', { name: 'Download CSV' }).click();
				await expect
					.poll(() => csvDownloads.map((download) => download.suggestedFilename()).sort(), {
						timeout: 15_000
					})
					.toEqual(tablesABackupRestores.map((table) => `budge-${date}-${table}.csv`).sort());
				const csvs = new Map(
					await Promise.all(
						csvDownloads.map(
							async (download) => [download.suggestedFilename(), await text(download)] as const
						)
					)
				);
				const accountsCsv = csvs.get(`budge-${date}-accounts.csv`) ?? '';
				expect(accountsCsv.split('\r\n')[0]).toContain('name');
				expect(accountsCsv).toContain('Checking');
			});
		}
	}
} satisfies Record<string, Journey>;
