import { expect, type Locator, type Page } from '@playwright/test';

import type { FixtureName } from '../../scripts/app/fixtures';
import { formatCents, parseCents } from '../../src/lib/domain/money';

export interface JourneyContext {
	step: <T>(name: string, body: () => Promise<T>) => Promise<T>;
}

export interface Journey {
	title: string;
	fixture: FixtureName;
	run: (page: Page, context: JourneyContext) => Promise<void>;
}

export function cents(text: string | null) {
	const amount = parseCents((text ?? '').trim());
	if (amount === undefined) throw new Error(`${String(text)} is not an amount.`);
	return amount;
}

export async function centsIn(locator: Locator) {
	return cents(await locator.textContent());
}

export function typed(amountInCents: number) {
	return formatCents(amountInCents).replace('$', '');
}

export async function openAccount(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Budget and Accounts' })
		.getByRole('link', { name: new RegExp(`^${name}`) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

export async function openBudget(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Budget', exact: true })).toBeVisible();
}
