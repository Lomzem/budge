import { expect } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
import {
	cents,
	centsIn,
	expectClearOf,
	expectNothingPastTheRightEdge,
	openBudget,
	typed,
	type Journey
} from './journey';

function monthOf(monthsFromNow: number) {
	const today = new Date();
	return new Date(today.getFullYear(), today.getMonth() + monthsFromNow, 1);
}

function monthName(monthsFromNow: number) {
	return monthOf(monthsFromNow).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export const budget = {
	assign: {
		title:
			'editing Assigned inline moves on to the next Category, changes Ready to Assign, and reloads and other months keep it',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const assigned = page.getByRole('textbox', { name: 'Assigned for Groceries', exact: true });
			const diningOut = page.getByRole('textbox', {
				name: 'Assigned for Dining Out',
				exact: true
			});
			const readyToAssign = () => centsIn(page.getByTestId('ready-to-assign'));

			const before = await step('open the Budget', async () => {
				await openBudget(page);
				await expect(page.getByText(monthName(0), { exact: true })).toBeVisible();
				return {
					assigned: cents(await assigned.inputValue()),
					readyToAssign: await readyToAssign()
				};
			});
			const tenDollarsMore = typed(before.assigned + 1_000);

			await step(
				'assign $10 more to Groceries; Enter moves to the next Assigned field',
				async () => {
					await assigned.fill(tenDollarsMore);
					await assigned.press('Enter');
					await expect(diningOut).toBeFocused();
					await expect(assigned).toHaveValue(tenDollarsMore);
					await expect.poll(readyToAssign).toBe(before.readyToAssign - 1_000);
				}
			);

			await step('ArrowUp and ArrowDown move between Assigned fields', async () => {
				await diningOut.press('ArrowUp');
				await expect(assigned).toBeFocused();
				await assigned.press('ArrowDown');
				await expect(diningOut).toBeFocused();
			});

			await step('a reload keeps Assigned and Ready to Assign', async () => {
				await page.reload();
				await expect(assigned).toHaveValue(tenDollarsMore);
				await expect.poll(readyToAssign).toBe(before.readyToAssign - 1_000);
			});

			await step('Ready to Assign is the same next month', async () => {
				await page.getByRole('button', { name: 'Next month', exact: true }).click();
				await expect(page.getByText(monthName(1), { exact: true })).toBeVisible();
				await expect.poll(readyToAssign).toBe(before.readyToAssign - 1_000);
			});

			await step('back in this month, Groceries keeps its Assigned', async () => {
				await page.getByRole('button', { name: 'Previous month', exact: true }).click();
				await expect(page.getByText(monthName(0), { exact: true })).toBeVisible();
				await expect(assigned).toHaveValue(tenDollarsMore);
			});

			await step(
				'on a 390 px phone an unreadable Assigned shows its hint under the field, clear of the next Category and the tab bar',
				async () => {
					await page.setViewportSize({ width: 390, height: 844 });
					await assigned.fill('abc');
					await assigned.press('Enter');
					const hint = page.getByText('Try 120.00, 100+20 or +5. Esc restores.');
					const tabs = page.getByRole('navigation', { name: 'Sections', exact: true });
					await expectClearOf(hint, page.getByRole('row').filter({ has: diningOut }), tabs);
					await diningOut.scrollIntoViewIfNeeded();
					await expectClearOf(diningOut, hint, tabs);
					await assigned.press('Escape');
					await expect(hint).toHaveCount(0);
					await expect(assigned).toHaveValue(tenDollarsMore);
					await page.setViewportSize({ width: 1280, height: 800 });
				}
			);

			await step(
				'a negative Assigned stays put when the field is only focused, left, or Escaped',
				async () => {
					await assigned.fill('0-20');
					await assigned.press('Enter');
					await expect(assigned).toHaveValue(typed(-2_000));
					const settled = before.readyToAssign + before.assigned + 2_000;
					await expect.poll(readyToAssign).toBe(settled);
					await assigned.focus();
					await assigned.blur();
					await assigned.focus();
					await assigned.press('Escape');
					await assigned.blur();
					await expect(assigned).toHaveValue(typed(-2_000));
					await page.reload();
					await expect(assigned).toHaveValue(typed(-2_000));
					await expect.poll(readyToAssign).toBe(settled);
				}
			);
		}
	},
	'assign-back': {
		title:
			'putting Assigned back while the first save is still on its way saves the amount typed last',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const saving = await holdResponseTo(page, 'budget:setAssigned');
			const assigned = page.getByRole('textbox', { name: 'Assigned for Groceries', exact: true });
			const readyToAssign = () => centsIn(page.getByTestId('ready-to-assign'));

			const before = await step('open the Budget', async () => {
				await openBudget(page);
				return {
					assigned: await assigned.inputValue(),
					readyToAssign: await readyToAssign()
				};
			});

			await step('assign $10 more to Groceries and hold the save', async () => {
				await assigned.fill(typed(cents(before.assigned) + 1_000));
				await assigned.press('Enter');
				await saving.held;
			});

			await step('type the old amount back while the first save is held', async () => {
				await assigned.focus();
				await expect(assigned).toHaveValue(typed(cents(before.assigned) + 1_000));
				await assigned.fill(before.assigned);
				await assigned.press('Enter');
				saving.release();
			});

			await step('Groceries keeps the old amount, after a reload too', async () => {
				await expect(assigned).toHaveValue(before.assigned);
				await expect.poll(readyToAssign).toBe(before.readyToAssign);
				await page.reload();
				await expect(assigned).toHaveValue(before.assigned);
				await expect.poll(readyToAssign).toBe(before.readyToAssign);
			});
		}
	},
	'needs-you': {
		title:
			'each Needs you item leads to what needs the owner: a filtered register or the overspent Category',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const needsYou = page.getByRole('region', { name: 'Needs you', exact: true });
			const rows = page.getByRole('table').getByRole('button', { name: /edit Transaction on/ });
			const chosen = (label: string) =>
				page
					.getByRole('search', { name: 'Search and filter Transactions' })
					.getByLabel(label, { exact: true });

			await step('the first item is painted on screen, not only present in the page', async () => {
				await openBudget(page);
				const first = needsYou.getByRole('listitem').first();
				await expect(first).toBeVisible();
				const clip = await first.boundingBox();
				if (clip === null) throw new Error('The first Needs you item has no box.');
				const painted = await page.screenshot({ clip });
				await first.evaluate((item) => {
					item.style.visibility = 'hidden';
				});
				const blank = await page.screenshot({ clip });
				await first.evaluate((item) => {
					item.style.visibility = '';
				});
				expect(painted.equals(blank)).toBe(false);
			});

			for (const [filter, option] of [
				['Category', 'Uncategorized'],
				['Status', 'Unapproved']
			] as const) {
				await step(`${option} opens the register already narrowed to ${option}`, async () => {
					await openBudget(page);
					const chip = needsYou.getByRole('link', { name: new RegExp(`^\\d+ ${option}$`) });
					const count = Number.parseInt((await chip.textContent()) ?? '', 10);
					expect(count).toBeGreaterThan(0);
					await chip.click();
					await expect(
						page.getByRole('heading', { level: 1, name: 'Accounts', exact: true })
					).toBeVisible();
					await expect(chosen(filter)).toHaveText(option);
					await expect(rows).toHaveCount(count);
					await expect(
						page.getByText(`${String(count)} ${option} Transactions`, { exact: true })
					).toBeVisible();
				});
			}

			const first = await step(
				'the overspent item opens the first overspent Category',
				async () => {
					await openBudget(page);
					await needsYou.getByRole('button', { name: /^\d+ Categories? overspent$/ }).click();
					const opened = page.locator('[aria-controls="category-inspector"]');
					await expect(opened).toHaveCount(1);
					const name = (await opened.textContent())?.trim() ?? '';
					await expect(page.getByRole('region', { name, exact: true })).toContainText(
						'Overspent by'
					);
					return name;
				}
			);

			await step('clicking it again steps to the next overspent Category', async () => {
				await needsYou.getByRole('button', { name: /^\d+ Categories overspent$/ }).click();
				const opened = page.locator('[aria-controls="category-inspector"]');
				await expect(opened).not.toHaveText(first);
				const name = (await opened.textContent())?.trim() ?? '';
				await expect(page.getByRole('region', { name, exact: true })).toContainText('Overspent by');
			});
		}
	},
	'month-jump': {
		title:
			'the month heading jumps to any month and year, keeps the arrows, and cannot reach before the first budget month',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const picker = page.getByRole('button', { name: /, choose a month$/ });
			const months = page.getByRole('dialog').or(page.locator('[data-slot="popover-content"]'));
			const showYear = async (year: number) => {
				const grid = months.getByRole('group');
				let shown = Number(await grid.getAttribute('aria-label'));
				while (shown !== year) {
					const later = shown < year;
					await months.getByRole('button', { name: later ? 'Next year' : 'Previous year' }).click();
					shown += later ? 1 : -1;
					await expect(grid).toHaveAttribute('aria-label', String(shown));
				}
			};

			await step('open the month picker from the heading', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await openBudget(page);
				await expect(picker).toHaveAccessibleName(`${monthName(0)}, choose a month`);
				await picker.click();
				await expect(months.getByRole('button', { name: monthName(0), exact: true })).toBeFocused();
			});

			await step(
				'months before the first budget month cannot be picked, nor any earlier year',
				async () => {
					const firstMonth = monthOf(-2);
					await showYear(firstMonth.getFullYear());
					await expect(months.getByRole('button', { name: 'Previous year' })).toBeDisabled();
					await expect(
						months.getByRole('button', { name: monthName(-2), exact: true })
					).toBeEnabled();
					const monthBefore = monthOf(-3);
					if (monthBefore.getFullYear() === firstMonth.getFullYear()) {
						await expect(
							months.getByRole('button', { name: monthName(-3), exact: true })
						).toBeDisabled();
					}
				}
			);

			await step('Next year, then a month, jumps there and the URL keeps it', async () => {
				await showYear(monthOf(12).getFullYear());
				await months.getByRole('button', { name: monthName(12), exact: true }).click();
				await expect(page.getByText(monthName(12), { exact: true })).toBeVisible();
				await expect(picker).toBeFocused();
				await page.reload();
				await expect(page.getByText(monthName(12), { exact: true })).toBeVisible();
			});

			await step('the arrows still step one month', async () => {
				await page.getByRole('button', { name: 'Previous month', exact: true }).click();
				await expect(page.getByText(monthName(11), { exact: true })).toBeVisible();
				await expectNothingPastTheRightEdge(page);
			});

			await step('arrow keys move across and down the grid, and Enter picks one', async () => {
				const nextYear = String(new Date().getFullYear() + 1);
				await picker.click();
				await showYear(Number(nextYear));
				await months.getByRole('button', { name: `June ${nextYear}`, exact: true }).click();
				await expect(page.getByText(`June ${nextYear}`, { exact: true })).toBeVisible();
				await expect(months).toHaveCount(0);
				await expect(picker).toBeFocused();
				await picker.click();
				await expect(
					months.getByRole('button', { name: `June ${nextYear}`, exact: true })
				).toBeFocused();
				await page.keyboard.press('ArrowLeft');
				await expect(
					months.getByRole('button', { name: `May ${nextYear}`, exact: true })
				).toBeFocused();
				await page.keyboard.press('ArrowDown');
				await expect(
					months.getByRole('button', { name: `August ${nextYear}`, exact: true })
				).toBeFocused();
				await page.keyboard.press('Enter');
				await expect(page.getByText(`August ${nextYear}`, { exact: true })).toBeVisible();
			});
		}
	},
	'phone-groups': {
		title:
			'on a 320 px phone Assigned is edited in the table, and a collapsed group keeps its totals and overspending',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const assigned = page.getByRole('textbox', { name: 'Assigned for Groceries', exact: true });
			const readyToAssign = () => centsIn(page.getByTestId('ready-to-assign'));
			const header = (group: string) =>
				page.getByRole('rowheader', { name: new RegExp(`^${group}`) });
			const toggle = (group: string) =>
				header(group).getByRole('button', { name: new RegExp(`^${group}( \\d+ overspent)?$`) });

			const before = await step('open the Budget on a 320 px phone', async () => {
				await page.setViewportSize({ width: 320, height: 640 });
				await openBudget(page);
				await expect(assigned).toBeVisible();
				await expectNothingPastTheRightEdge(page);
				return { assigned: cents(await assigned.inputValue()), ready: await readyToAssign() };
			});

			await step('Assigned saves from the table without opening the inspector', async () => {
				await assigned.fill(typed(before.assigned + 500));
				await assigned.press('Enter');
				await expect.poll(readyToAssign).toBe(before.ready - 500);
				await expect(page.getByRole('dialog')).toHaveCount(0);
				await page.reload();
				await expect(assigned).toHaveValue(typed(before.assigned + 500));
			});

			const overspentGroup = await step('find a group with an overspent Category', async () => {
				const flagged = page
					.getByRole('rowgroup')
					.filter({ has: page.getByText(/^Overspent by/) })
					.first();
				const name =
					(
						await flagged.getByRole('rowheader').getByRole('button').first().textContent()
					)?.trim() ?? '';
				expect(name).not.toBe('');
				return name;
			});

			await step(
				'collapsing it hides its rows but keeps its totals and an overspent count',
				async () => {
					const row = page.getByRole('rowgroup').filter({ has: header(overspentGroup) });
					const totals = row.getByRole('row').first().getByRole('cell');
					await expect(totals).toHaveText([/^−?\$[\d,]+\.\d\d ?Available ?−?\$[\d,]+\.\d\d$/]);
					const shown = await totals.allTextContents();
					const flagged = await row.getByText(/^Overspent by/).count();
					await toggle(overspentGroup).click();
					await expect(toggle(overspentGroup)).toHaveAttribute('aria-expanded', 'false');
					await expect(row.getByRole('row')).toHaveCount(1);
					await expect(totals).toHaveText(shown);
					await expect(header(overspentGroup)).toContainText(`${String(flagged)} overspent`);
				}
			);

			await step('the collapse lasts through a reload', async () => {
				await page.reload();
				await expect(toggle(overspentGroup)).toHaveAttribute('aria-expanded', 'false');
			});

			await step('the overspent item opens its Category and expands the group', async () => {
				await page
					.getByRole('region', { name: 'Needs you', exact: true })
					.getByRole('button', { name: /overspent$/ })
					.click();
				const dialog = page.getByRole('dialog');
				await expect(dialog).toContainText('Overspent by');
				await page.keyboard.press('Escape');
				await expect(toggle(overspentGroup)).toHaveAttribute('aria-expanded', 'true');
			});
		}
	}
} satisfies Record<string, Journey>;
