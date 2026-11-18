import { expect, type Page } from '@playwright/test';

import { addDays, formatDate, localToday } from '../../src/lib/domain/dates';
import { choose, expectNothingPastTheRightEdge, reloadOnceSaved, type Journey } from './journey';

async function openAllAccounts(page: Page) {
	await page.goto('/transactions');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Transactions', exact: true })
	).toBeVisible();
}

async function listedDates(page: Page) {
	return await page
		.getByRole('table')
		.getByRole('button', { name: /edit Transaction on/ })
		.evaluateAll((buttons) =>
			buttons.map((button) => (button.getAttribute('aria-label') ?? '').split(' on ').at(-1) ?? '')
		);
}

async function listedRows(page: Page) {
	return await page
		.getByRole('table')
		.getByRole('button', { name: /edit Transaction on/ })
		.evaluateAll((buttons) =>
			buttons.map((button) => ({
				payee: button.firstElementChild?.textContent.trim() ?? '',
				date: (button.getAttribute('aria-label') ?? '').split(' on ').at(-1) ?? ''
			}))
		);
}

async function datesOnceListed(
	page: Page,
	expected: (rows: { payee: string; date: string }[]) => boolean
) {
	let dates: string[] = [];
	await expect
		.poll(async () => {
			const rows = await listedRows(page);
			dates = rows.map((row) => row.date);
			return expected(rows);
		})
		.toBe(true);
	return dates;
}

async function listedPayees(page: Page) {
	return await page
		.getByRole('table')
		.getByRole('button', { name: /edit Transaction on/ })
		.evaluateAll((buttons) =>
			buttons.map((button) => button.firstElementChild?.textContent.trim() ?? '')
		);
}

export const search = {
	filters: {
		title:
			'search finds Transactions by Bank Text and split memo, and searchable Payee, Category and date-range filters narrow the list',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const searchbox = page.getByRole('searchbox', { name: 'Search' });
			let landlordId = '';

			await step(
				'search finds a Transaction by its Bank Text and a split by its line memo',
				async () => {
					await openAllAccounts(page);
					const numberOnlyInTheMatchedCoffeesBankText = '0042';
					await searchbox.fill(numberOnlyInTheMatchedCoffeesBankText);
					await expect.poll(() => listedPayees(page)).toEqual(['Sample Coffee Shop']);
					await searchbox.fill('birthday');
					await expect.poll(() => listedPayees(page)).toEqual(['Sample Warehouse Club']);
				}
			);

			await step(
				'typing on the Payee filter searches the Payees, and the pick narrows to that exact Payee while the search box stays empty',
				async () => {
					await searchbox.fill('');
					const payee = page.getByLabel('Payee', { exact: true });
					await payee.focus();
					await page.keyboard.type('land');
					const payeeSearch = page.getByRole('combobox', { name: 'Search Payees' });
					await expect(payeeSearch).toHaveValue('land');
					await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
						'Sample Landlord'
					]);
					await page.keyboard.press('Enter');
					await expect(payee).toHaveText('Sample Landlord');
					await expect(searchbox).toHaveValue('');
					await expect.poll(() => new URL(page.url()).searchParams.get('payee')).toMatch(/.+/);
					expect(new URL(page.url()).searchParams.get('q')).toBeNull();
					landlordId = new URL(page.url()).searchParams.get('payee') ?? '';
					await expect
						.poll(async () => new Set(await listedPayees(page)))
						.toEqual(new Set(['Sample Landlord']));
				}
			);

			await step(
				'the Category filter searches too; the split has no Category of its own, so its Gifts line lists it under Gifts',
				async () => {
					await choose(page.getByLabel('Payee', { exact: true }), 'Any Payee');
					const category = page.getByLabel('Category', { exact: true });
					await category.click();
					await page.getByRole('combobox', { name: 'Search Categories' }).fill('gif');
					await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['Gifts']);
					await page.keyboard.press('Enter');
					await expect(category).toHaveText('Gifts');
					await expect.poll(() => listedPayees(page)).toContain('Sample Warehouse Club');
				}
			);

			await step(
				'Last 30 days fills From and To with local dates and lists only rows inside them; a typed From reads as custom dates',
				async () => {
					const today = localToday();
					const inRange = new Set(
						Array.from({ length: 30 }, (_, back) => formatDate(addDays(today, -back)))
					);
					await choose(page.getByLabel('Category', { exact: true }), 'Any Category');
					const unapprovedAndUncategorizedSoNeverAGiftsRow = 'SAMPLE BOOKSHOP 0193';
					const everyDate = await datesOnceListed(
						page,
						(rows) =>
							rows.some((row) => row.payee === unapprovedAndUncategorizedSoNeverAGiftsRow) &&
							rows.some((row) => !inRange.has(row.date))
					);
					await choose(page.getByLabel('Dates', { exact: true }), 'Last 30 days');
					await expect(page.getByLabel('From', { exact: true })).toHaveValue(addDays(today, -29));
					await expect(page.getByLabel('To', { exact: true })).toHaveValue(today);
					await datesOnceListed(
						page,
						(rows) => rows.length > 0 && rows.every((row) => inRange.has(row.date))
					);
					await page.getByLabel('From', { exact: true }).fill(addDays(today, -3));
					await expect(page.getByLabel('Dates', { exact: true })).toHaveText('Custom dates');
					await choose(page.getByLabel('Dates', { exact: true }), 'Any dates');
					await expect(page.getByLabel('From', { exact: true })).toHaveValue('');
					await expect.poll(() => listedDates(page)).toEqual(everyDate);
				}
			);

			await step('Clear search and filters resets them', async () => {
				await choose(page.getByLabel('Category', { exact: true }), 'Gifts');
				await page.getByRole('button', { name: 'Clear search and filters' }).click();
				await expect(page.getByLabel('Category', { exact: true })).toHaveText('Any Category');
			});

			await step(
				'a link whose filters name nothing Budge offers drops them and lists every Transaction',
				async () => {
					expect(landlordId).toBeTruthy();
					await page.goto(`/transactions?account=${landlordId}&category=123&payee=xyz&q=`);
					await expect(page.getByLabel('Payee', { exact: true })).toHaveText('Any Payee');
					await expect.poll(async () => (await listedPayees(page)).length).toBeGreaterThan(3);
					await expect(page).toHaveURL(/\/transactions$/);
					await expect(page.getByText("Budge couldn't load Transactions")).toHaveCount(0);
				}
			);

			await step(
				'after a reload, the filter chosen last is the one Back returns to from another Section',
				async () => {
					const payee = page.getByLabel('Payee', { exact: true });
					await choose(payee, 'Sample Landlord');
					await reloadOnceSaved(page);
					await expect(payee).toHaveText('Sample Landlord');
					await choose(payee, 'Sample Coffee Shop');
					await expect
						.poll(async () => new Set(await listedPayees(page)))
						.toEqual(new Set(['Sample Coffee Shop']));

					await page
						.getByRole('navigation', { name: 'Sections and Accounts' })
						.getByRole('link', { name: /^Budget/ })
						.click();
					await expect(
						page.getByRole('heading', { level: 1, name: 'Budget', exact: true })
					).toBeVisible();
					await page.goBack();
					await expect(payee).toHaveText('Sample Coffee Shop');
					await expect
						.poll(async () => new Set(await listedPayees(page)))
						.toEqual(new Set(['Sample Coffee Shop']));
				}
			);
		}
	},
	phone: {
		title:
			'the search and filters are labeled and fit a 320 px screen, and folded filters stay in view as removable chips',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 320, height: 640 });

			await step('Filters opens every labeled filter under the search', async () => {
				await openAllAccounts(page);
				const toggle = page.getByRole('button', { name: 'Filters', exact: true });
				await expect(page.getByLabel('Payee', { exact: true })).toBeHidden();
				await toggle.click();
				await expect(toggle).toHaveAttribute('aria-expanded', 'true');
				for (const label of ['Search', 'Account', 'Category', 'Payee', 'Dates', 'From', 'To']) {
					await expect(page.getByLabel(label, { exact: true })).toBeVisible();
				}
			});

			await step('search works with nothing scrolling sideways', async () => {
				await page.getByRole('searchbox', { name: 'Search' }).fill('0042');
				await expect.poll(() => listedPayees(page)).toEqual(['Sample Coffee Shop']);
				await expectNothingPastTheRightEdge(page);
				await page.getByRole('searchbox', { name: 'Search' }).fill('');
			});

			await step(
				'with Filters folded, each active filter stays in view as a chip that the Filters count matches',
				async () => {
					await choose(page.getByLabel('Payee', { exact: true }), 'Sample Landlord');
					await choose(page.getByLabel('Dates', { exact: true }), 'This year');
					const toggle = page.getByRole('button', { name: /^Filters\b/ });
					await toggle.click();
					await expect(toggle).toHaveAttribute('aria-expanded', 'false');
					await expect(page.getByLabel('Payee', { exact: true })).toBeHidden();
					const chips = page.getByRole('list', { name: 'Active filters' }).getByRole('button');
					await expect(chips).toHaveCount(2);
					await expect(chips.nth(0)).toHaveAccessibleName('Remove Payee: Sample Landlord');
					await expect(chips.nth(1)).toHaveAccessibleName('Remove Dates: This year');
					await expect(toggle).toHaveText(/2$/);
					await expect
						.poll(async () => new Set(await listedPayees(page)))
						.toEqual(new Set(['Sample Landlord']));
					await expectNothingPastTheRightEdge(page);
				}
			);

			await step(
				'removing a chip drops just that filter and moves focus to the next chip, then to Filters',
				async () => {
					const chips = page.getByRole('list', { name: 'Active filters' }).getByRole('button');
					const toggle = page.getByRole('button', { name: /^Filters\b/ });
					await chips.first().click();
					await expect(chips).toHaveCount(1);
					await expect(chips.first()).toHaveAccessibleName('Remove Dates: This year');
					await expect(chips.first()).toBeFocused();
					await expect.poll(() => new URL(page.url()).searchParams.get('payee')).toBeNull();
					await expect.poll(async () => new Set(await listedPayees(page)).size).toBeGreaterThan(1);
					await page.keyboard.press('Enter');
					await expect(page.getByRole('list', { name: 'Active filters' })).toBeHidden();
					await expect(toggle).toBeFocused();
					await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBeNull();
					await expect(
						page.getByRole('button', { name: 'Clear search and filters' })
					).toBeDisabled();
				}
			);
		}
	}
} satisfies Record<string, Journey>;
