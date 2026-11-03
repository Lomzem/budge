#!/usr/bin/env bash
set -euo pipefail
bun --no-env-file run - "$@" <<'JS'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium, expect } from '@playwright/test';

import { formatCents, parseCents } from './src/lib/domain/money';

const running = JSON.parse(readFileSync('.local-app/running.json', 'utf8'));
const evidence = resolve('test-results/verify-budge', new Date().toISOString().replaceAll(':', '-'));
mkdirSync(evidence, { recursive: true });
const report = { feature: 'budget', appUrl: running.appUrl, fixture: 'budget-with-accounts', steps: [] };
const browser = await chromium.launch();
let page;
const capture = async (name) => {
	await page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: true });
	writeFileSync(resolve(evidence, `${name}.aria.txt`), await page.locator('body').ariaSnapshot());
	report.steps.push(name);
};
try {
	const context = await browser.newContext({
		baseURL: running.appUrl,
		storageState: process.argv[2] ?? '.local-app/storage-state.json',
		viewport: { width: 1280, height: 800 }
	});
	page = await context.newPage();
	page.setDefaultTimeout(30_000);
	const assigned = page.getByRole('textbox', { name: 'Assigned for Groceries', exact: true });
	const ready = page.getByTestId('ready-to-assign');
	const cents = (text) => {
		const value = parseCents(text ?? '');
		if (value === undefined) throw new Error('Expected an on-screen money amount');
		return value;
	};
	const amount = (value) => formatCents(value).replace('$', '');
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Budget', exact: true })).toBeVisible();
	await expect(assigned).toBeVisible();
	const before = { assigned: cents(await assigned.inputValue()), ready: cents(await ready.textContent()) };
	report.before = before;
	await capture('01-before');
	await assigned.fill(amount(before.assigned + 1000));
	await capture('02-action-draft');
	await assigned.press('Enter');
	await expect(assigned).toHaveValue(amount(before.assigned + 1000));
	await expect.poll(async () => cents(await ready.textContent())).toBe(before.ready - 1000);
	await capture('03-saved');
	await page.reload();
	await expect(assigned).toHaveValue(amount(before.assigned + 1000));
	await expect.poll(async () => cents(await ready.textContent())).toBe(before.ready - 1000);
	await capture('04-reloaded');
	const month = page.locator('header p[aria-live="polite"]');
	const initialMonth = await month.textContent();
	await page.getByRole('button', { name: 'Next month', exact: true }).click();
	await expect(month).not.toHaveText(initialMonth);
	await expect.poll(async () => cents(await ready.textContent())).toBe(before.ready - 1000);
	await capture('05-next-month');
	await page.getByRole('button', { name: 'Previous month', exact: true }).click();
	await expect(month).toHaveText(initialMonth);
	await expect(assigned).toHaveValue(amount(before.assigned + 1000));
	await page.goto('/accounts');
	await page.getByRole('navigation', { name: 'Budget and Accounts' }).getByRole('link', { name: 'Budget', exact: true }).click();
	await expect(assigned).toHaveValue(amount(before.assigned + 1000));
	await capture('06-sidebar');
	await page.setViewportSize({ width: 320, height: 640 });
	await page.goto('/accounts');
	await page.getByRole('button', { name: 'View All Accounts', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Budget', exact: true }).click();
	await expect(assigned).toHaveValue(amount(before.assigned + 1000));
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	await capture('07-mobile');
	await assigned.fill(amount(before.assigned));
	await assigned.press('Enter');
	await expect.poll(async () => cents(await ready.textContent())).toBe(before.ready);
	await capture('08-restored');
	report.result = 'passed';
} catch (error) {
	report.result = 'failed; see error and the steps reached, then rerun doctor before retrying';
	report.error = error instanceof Error ? error.message : String(error);
	process.exitCode = 1;
	if (page) await capture('failure').catch(() => undefined);
} finally {
	try {
		writeFileSync(resolve(evidence, 'result.json'), JSON.stringify(report, null, 2));
		console.log(evidence);
	} finally {
		await browser.close();
	}
}
JS
