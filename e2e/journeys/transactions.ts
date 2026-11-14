import { expect, type Locator } from '@playwright/test';

import { addDays, formatDate, localToday } from '../../src/lib/domain/dates';
import { holdResponseTo, withholdQueryResult } from '../heldResponse';
import {
	centsIn,
	choicesOf,
	choose,
	chooseBankFile,
	expectClearOf,
	expectNothingPastTheRightEdge,
	openAccount,
	type Journey
} from './journey';

export const transactions = {
	create: {
		title: 'adding a Transaction changes the Account balance',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const balance = () => centsIn(page.getByTestId('account-balance'));

			const before = await step('open Checking', async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				return balance();
			});

			const dialog = page.getByRole('dialog', { name: 'Add Transaction' });

			await step(
				'Add Transaction on an Account opens on Payee, Enter in Payee moves to Amount, and Save without an amount says why until one is typed',
				async () => {
					await page.getByRole('button', { name: 'Add Transaction' }).click();
					await expect(dialog.getByLabel('Payee')).toBeFocused();
					await dialog.getByLabel('Payee').pressSequentially('Smoke Test Bakery');
					await page.keyboard.press('Enter');
					await expect(dialog.getByLabel('Amount')).toBeFocused();
					await dialog.getByRole('button', { name: 'Save' }).click();
					const error = dialog.getByRole('alert').filter({ hasText: /\S/ });
					await expect(error).toHaveCount(1);
					await dialog.getByLabel('Amount').fill('12.34');
					await expect(error).toHaveCount(0);
				}
			);

			await step(
				'Escape asks before throwing the typing away, and Keep editing keeps it',
				async () => {
					await page.keyboard.press('Escape');
					const discard = page.getByRole('alertdialog', { name: 'Discard your changes?' });
					await discard.getByRole('button', { name: 'Keep editing' }).click();
					await expect(discard).toBeHidden();
					await expect(dialog.getByLabel('Amount')).toHaveValue('12.34');
					await expect(dialog.getByLabel('Payee')).toHaveValue('Smoke Test Bakery');
				}
			);

			await step('save the $12.34 outflow, and the balance drops by it', async () => {
				await dialog.getByRole('button', { name: 'Save' }).click();
				await expect(dialog).toBeHidden();
				await expect(
					page.getByRole('button', { name: /^Smoke Test Bakery/ }).first()
				).toBeVisible();
				await expect.poll(balance).toBe(before - 1234);
			});

			await step(
				'columns drop as the list narrows, so nothing scrolls sideways at the narrowest width',
				async () => {
					await page.setViewportSize({ width: 320, height: 640 });
					await expect(page.getByRole('columnheader', { name: 'Memo' })).toBeHidden();
					const fits = await page.getByRole('table').evaluate((table) => {
						const box = table.parentElement;
						return box !== null && box.scrollWidth <= box.clientWidth;
					});
					expect(fits).toBe(true);
				}
			);
		}
	},
	'late-save': {
		title: 'a save that finishes after the dialog was closed leaves the next opening alone',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const create = await holdResponseTo(page, 'transactions:create');
			const slowPayee = 'Smoke Test Slow Bakery';
			const adding = page.getByRole('dialog', { name: 'Add Transaction' });
			const editing = page.getByRole('dialog', { name: 'Edit Transaction' });

			await step('save a new Transaction, hold its response, and close the dialog', async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				await page.getByRole('button', { name: 'Add Transaction' }).click();
				await adding.getByLabel('Payee').fill(slowPayee);
				await adding.getByLabel('Amount').fill('7.00');
				await adding.getByRole('button', { name: 'Save' }).click();
				await create.held;
				await page.keyboard.press('Escape');
				await expect(adding).toBeHidden();
			});

			await step('open another Transaction, then release the held save', async () => {
				await page
					.getByRole('button', { name: /^Sample Landlord/ })
					.first()
					.click();
				await expect(editing.getByLabel('Payee')).toHaveValue('Sample Landlord');
				create.release();
			});

			await step('the save lands in the list, and the open dialog stays as it was', async () => {
				await expect(
					page.getByRole('button', { name: new RegExp(`^${slowPayee}`) }).first()
				).toBeVisible();
				await expect(editing.getByRole('button', { name: 'Save' })).toBeEnabled();
				await expect(editing).toHaveAttribute('data-state', 'open');
				await expect(editing.getByLabel('Payee')).toHaveValue('Sample Landlord');
				await expect(editing.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
			});
		}
	},
	categorize: {
		title:
			'a Category or Transfer is searched for and saved from its row, by keyboard and on a 320 px phone, survives reload, and leaves the row Unapproved',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			const categoryOf = (payee: string) =>
				page.getByRole('button', { name: new RegExp(`Category of ${payee} on `) }).first();
			const unapproved = (payee: string) =>
				page.getByRole('button', { name: new RegExp(`^${payee}, Unapproved, edit Transaction`) });
			const listbox = page.getByRole('listbox');
			const options = () => listbox.getByRole('option').allInnerTexts();

			await step(
				'typing on an Unapproved row’s Category opens a search that finds Groceries, and Enter saves it',
				async () => {
					await page.goto('/accounts');
					const category = categoryOf('SAMPLE HARDWARE 2208');
					await expect(category).toHaveAccessibleName(/^Uncategorized, /);
					await category.focus();
					await page.keyboard.type('groc');
					await expect(page.getByRole('combobox', { name: 'Search Categories' })).toHaveValue(
						'groc'
					);
					await expect.poll(options).toEqual(['Groceries']);
					await page.keyboard.press('Enter');
					await expect(listbox).toBeHidden();
					await expect(category).toHaveAccessibleName(/^Groceries, /);
					await expect(category).toBeFocused();
					await expect(unapproved('SAMPLE HARDWARE 2208')).toBeVisible();
				}
			);

			await step('after reload the row keeps Groceries and stays Unapproved', async () => {
				await page.reload();
				await expect(categoryOf('SAMPLE HARDWARE 2208')).toHaveAccessibleName(/^Groceries, /);
				await expect(unapproved('SAMPLE HARDWARE 2208')).toBeVisible();
			});

			await step(
				'a Checking outflow offers Ready to Assign with the Categories and its Transfers in their own section, and Transfer: Card pays the card',
				async () => {
					const cardBalance = await (async () => {
						await openAccount(page, 'Card');
						return centsIn(page.getByTestId('account-balance'));
					})();
					await openAccount(page, 'Checking');
					const id = await categoryOf('Sample Landlord').getAttribute('data-category');
					const category = page
						.getByRole('button')
						.and(page.locator(`[data-category="${String(id)}"]`));
					await category.click();
					const all = await options();
					expect(all.slice(0, 2)).toEqual(['Uncategorized', 'Ready to Assign']);
					await expect(
						listbox.getByRole('group', { name: 'Transfer to or from' }).getByRole('option')
					).toHaveText(['Transfer: Savings', 'Transfer: Card']);
					await page.keyboard.type('card');
					await expect.poll(options).toEqual(['Transfer: Card']);
					await page.keyboard.press('Enter');
					await expect(category).toHaveAccessibleName(/^To Card, /);
					await openAccount(page, 'Card');
					await expect(
						page.getByRole('button', { name: /^From Checking, Category of / }).first()
					).toBeVisible();
					await expect
						.poll(() => centsIn(page.getByTestId('account-balance')))
						.toBeGreaterThan(cardBalance);
				}
			);

			await step(
				'on a 320 px phone the Category opens above the tab bar, fits the screen, and saves a search',
				async () => {
					await page.setViewportSize({ width: 320, height: 640 });
					await page.goto('/accounts');
					const category = categoryOf('Sample Coffee Shop');
					await category.scrollIntoViewIfNeeded();
					await expectClearOf(
						category,
						page.getByRole('navigation', { name: 'Sections', exact: true })
					);
					await category.click();
					await expectClearOf(
						listbox,
						page.getByRole('navigation', { name: 'Sections', exact: true })
					);
					await expectNothingPastTheRightEdge(page);
					await page.getByRole('combobox', { name: 'Search Categories' }).fill('coff');
					await listbox.getByRole('option', { name: 'Coffee', exact: true }).click();
					await expect(category).toHaveAccessibleName(/^Coffee, /);
					await expect(unapproved('Sample Coffee Shop')).toBeVisible();
				}
			);
		}
	},
	'categorize-late': {
		title:
			'a Category picked while the row’s earlier pick is still saving, or still looking for a Transfer to link, wins, and the earlier pick finishing late does not put it back',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const categorize = await holdResponseTo(page, 'transactions:categorize');
			const category = page
				.getByRole('button', { name: /Category of Sample Utility Co on / })
				.first();

			await step('pick Coffee for a Checking row and hold its save', async () => {
				await page.goto('/');
				await openAccount(page, 'Checking');
				await choose(category, 'Coffee');
				await categorize.held;
				await expect(category).toHaveAccessibleName(/^Saving, /);
				await expect(category).toHaveText('Coffee');
			});

			await step(
				'pick Dining Out, then let the Coffee save land: the row still shows Dining Out',
				async () => {
					await choose(category, 'Dining Out');
					await expect(category).toHaveText('Dining Out');
					categorize.landEarliest();
					await expect(category).toHaveAccessibleName(/^Saving, /);
					await expect(category).toHaveText('Dining Out');
				}
			);

			await step('let the Dining Out save land, and it is kept after reload', async () => {
				categorize.release();
				await expect(category).toHaveAccessibleName(/^Dining Out, /);
				await page.reload();
				await expect(category).toHaveAccessibleName(/^Dining Out, /);
			});

			const lookup = await withholdQueryResult(page, 'transactions:transferCandidates');

			const imported = await step(
				'reload so searches for a Transfer to link are held, then on an imported row pick Transfer: Savings and, while its search is held, Groceries, which saves',
				async () => {
					await page.reload();
					const id = await page
						.getByRole('button', { name: /Category of SAMPLE PET SUPPLY 0311 on / })
						.first()
						.getAttribute('data-category');
					const picker = page
						.getByRole('button')
						.and(page.locator(`[data-category="${String(id)}"]`));
					await choose(picker, 'Transfer: Savings');
					await expect(picker).toHaveAccessibleName(/^Saving, /);
					await choose(picker, 'Groceries');
					await expect(picker).toHaveAccessibleName(/^Groceries, /);
					return picker;
				}
			);

			await step(
				'the search lands with nothing to link, a later save on another row lands, and the imported row keeps Groceries after reload',
				async () => {
					lookup.release();
					await lookup.dropped;
					await choose(category, 'Coffee');
					await expect(category).toHaveAccessibleName(/^Coffee, /);
					await expect(imported).toHaveAccessibleName(/^Groceries, /);
					await page.reload();
					await expect(imported).toHaveAccessibleName(/^Groceries, /);
				}
			);
		}
	},
	'approve-all-undo': {
		title:
			'Unapproved Transactions come first under their own heading, and Approve all or Approve shown can be undone',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const approveAll = page.getByRole('button', { name: /^Approve (all )?\d/ });
			const waitingHeading = page.getByRole('rowheader', { name: 'Unapproved', exact: true });
			const unapprovedRows = () =>
				page
					.getByRole('button', { name: /, Unapproved, edit Transaction on / })
					.evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? '').sort());

			const label = await step(
				'Accounts heads the Unapproved rows apart from the Approved ones',
				async () => {
					await page.goto('/accounts');
					await expect(waitingHeading).toBeVisible();
					await expect(
						page.getByRole('rowheader', { name: 'Approved', exact: true })
					).toBeVisible();
					return approveAll.textContent();
				}
			);
			const total = Number(/\d+/.exec(label ?? '')?.[0]);
			const allUnapproved = async () => {
				await expect.poll(async () => (await unapprovedRows()).length).toBe(total);
				return unapprovedRows();
			};

			await step(
				"a row's Approve offers Undo, which puts it back and focuses its Approve again",
				async () => {
					const rowApprove = page.getByRole('button', { name: /^Approve SAMPLE BOOKSHOP 0193,/ });
					await rowApprove.click();
					await expect(page.getByText('Approved SAMPLE BOOKSHOP 0193.')).toBeVisible();
					await expect(rowApprove).toHaveCount(0);
					await page.getByRole('button', { name: 'Undo', exact: true }).click();
					await expect(rowApprove).toBeFocused();
					await expect(approveAll).toHaveText(label ?? '');
				}
			);

			await step(
				'a search approves only the Unapproved rows it shows and leaves the rest Unapproved; its Undo hides while the filters differ and puts them back once the search returns',
				async () => {
					const outside = (await allUnapproved()).find((name) => !name.includes('BOOKSHOP'));
					if (outside === undefined) throw new Error('every Unapproved row is a bookshop');
					await page.getByRole('searchbox', { name: 'Search' }).fill('BOOKSHOP');
					const shown = page.getByRole('button', { name: /^Approve \d+ shown$/ });
					const counted = Number(/\d+/.exec((await shown.textContent()) ?? '')?.[0]);
					await expect(
						page.getByRole('button', { name: /^SAMPLE BOOKSHOP.*, Unapproved/ })
					).toHaveCount(counted);
					await shown.click();
					await expect(
						page.getByText(`Approved ${String(counted)} Transaction${counted === 1 ? '' : 's'}.`)
					).toBeVisible();
					await expect(
						page.getByRole('button', { name: 'Approve shown', exact: true })
					).toHaveAttribute('aria-disabled', 'true');
					const undo = page.getByRole('button', { name: 'Undo', exact: true });
					await page.getByRole('button', { name: 'Clear search and filters' }).click();
					await expect(page.getByRole('button', { name: outside, exact: true })).toBeVisible();
					await expect(undo).toHaveCount(0);
					await page.getByRole('searchbox', { name: 'Search' }).fill('BOOKSHOP');
					await undo.click();
					await expect(shown).toHaveText(`Approve ${String(counted)} shown`);
					await page.getByRole('button', { name: 'Clear search and filters' }).click();
					await expect(approveAll).toHaveText(label ?? '');
				}
			);

			const waiting = await step('Approve all approves them and offers Undo', async () => {
				const before = await allUnapproved();
				await approveAll.click();
				await expect(
					page.getByText(`Approved ${String(total)} Transaction${total === 1 ? '' : 's'}.`)
				).toBeVisible();
				await expect(waitingHeading).toHaveCount(0);
				return before;
			});

			await step('Undo puts exactly those back to Unapproved', async () => {
				await page.getByRole('button', { name: 'Undo', exact: true }).click();
				await expect(approveAll).toHaveText(label ?? '');
				await expect.poll(unapprovedRows).toEqual(waiting);
				await expect(waitingHeading).toBeVisible();
				await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
			});

			await step(
				'with rows selected, the button approves only the selected Unapproved ones, and Undo puts them back',
				async () => {
					const [first, , third] = waiting;
					if (first === undefined || third === undefined)
						throw new Error('fewer than three Unapproved rows');
					const selectBox = (name: string) =>
						page.getByRole('checkbox', {
							name: `Select ${name.replace(', Unapproved, edit Transaction on', ',')}`,
							exact: true
						});
					await selectBox(first).check();
					await selectBox(third).check();
					await page
						.getByRole('checkbox', { name: /^Select Sample Coffee Shop,/ })
						.last()
						.check();
					const selected = page.getByRole('button', { name: 'Approve 2 selected', exact: true });
					await selected.click();
					await expect(page.getByText('Approved 2 Transactions.')).toBeVisible();
					await expect(page.getByRole('checkbox', { name: /^Select /, checked: true })).toHaveCount(
						0
					);
					await expect
						.poll(unapprovedRows)
						.toEqual(waiting.filter((name) => name !== first && name !== third));
					await page.getByRole('button', { name: 'Undo', exact: true }).click();
					await expect.poll(unapprovedRows).toEqual(waiting);
					await expect(approveAll).toHaveText(label ?? '');
				}
			);
		}
	},
	'select-categorize': {
		title:
			'Transactions picked one by one, across Payees and within one, take a Category, and approval only when asked; Undo puts back what changed and a search keeps only the checked rows it shows',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			const selectBoxes = page.getByRole('checkbox', { name: /^Select / });
			const picked = page.getByRole('checkbox', { name: /^Select /, checked: true });
			const rowOf = (box: Locator) => box.locator('xpath=ancestor::tr[1]');
			const categoryIn = (box: Locator) =>
				rowOf(box).getByRole('button', { name: /, Category of / });
			const bulk = page.getByRole('button', { name: /^Category for \d+ selected Transactions?$/ });
			const undo = page.getByRole('button', { name: 'Undo', exact: true });
			const bookshop = page.getByRole('checkbox', { name: /^Select SAMPLE BOOKSHOP 0193,/ });
			const hardware = page.getByRole('checkbox', { name: /^Select SAMPLE HARDWARE 2208,/ });
			const coffee = page.getByRole('checkbox', { name: /^Select Sample Coffee Shop,/ });
			const chosen = [bookshop, coffee.nth(1), coffee.nth(3)];
			const between = coffee.nth(2);
			const categoryNames = (boxes: Locator[]) =>
				Promise.all(
					boxes.map(async (box) => {
						const name = await categoryIn(box).getAttribute('aria-label');
						return (name ?? '').split(', Category of ')[0] ?? '';
					})
				);

			const before = await step(
				'pick the Unapproved bookshop and two Coffee Shop rows that are not next to each other',
				async () => {
					await page.goto('/accounts');
					await expect(
						page.getByRole('rowheader', { name: 'Unapproved', exact: true })
					).toBeVisible();
					for (const box of chosen) await box.check();
					await expect(page.getByText('3 selected', { exact: true })).toBeVisible();
					await expect(picked).toHaveCount(3);
					for (const box of chosen)
						await expect(rowOf(box)).toHaveAttribute('data-state', 'selected');
					await expect(between).not.toBeChecked();
					await expect(
						page.getByRole('button', { name: 'Approve 1 selected', exact: true })
					).toBeVisible();
					await expect(bulk).toHaveAccessibleName('Category for 3 selected Transactions');
					return { chosen: await categoryNames(chosen), between: await categoryNames([between]) };
				}
			);

			await step(
				'the bulk picker offers Categories but no Transfer, and a search keeps the checked rows it shows, even one checked as the search was typed, and unselects the rest, saying so',
				async () => {
					const offered = await choicesOf(bulk);
					expect(offered).toContain('Dining Out');
					expect(offered.filter((name) => name.startsWith('Transfer'))).toEqual([]);
					const search = page.getByRole('searchbox', { name: 'Search' });
					const namesOf = (boxes: Locator) =>
						boxes.evaluateAll((all) => all.map((box) => box.getAttribute('aria-label')).sort());
					const coffees = [coffee.nth(1), between, coffee.nth(3)];
					const kept = (
						await Promise.all(coffees.map((box) => box.getAttribute('aria-label')))
					).sort();
					const checkedBeforeTheSearchApplies = [
						await between.elementHandle(),
						await hardware.elementHandle()
					];
					await search.evaluate((input: HTMLInputElement, boxes) => {
						input.value = 'Coffee';
						input.dispatchEvent(new Event('input', { bubbles: true }));
						for (const box of boxes) box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
					}, checkedBeforeTheSearchApplies);
					await expect(bookshop).toHaveCount(0);
					await expect.poll(() => namesOf(picked)).toEqual(kept);
					await expect(page.getByText('3 selected', { exact: true })).toBeVisible();
					const note = '2 selected Transactions left the list and were unselected.';
					await expect(page.getByRole('paragraph').filter({ hasText: note })).toBeVisible();
					await expect(page.getByRole('status').filter({ hasText: note })).toHaveCount(1);
					await search.fill('');
					await expect(bookshop).toBeVisible();
					await expect(bookshop).not.toBeChecked();
					await expect(hardware).not.toBeChecked();
					await expect.poll(() => namesOf(picked)).toEqual(kept);
					await expect(page.getByRole('paragraph').filter({ hasText: note })).toHaveCount(0);
					await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
					await expect(picked).toHaveCount(0);
					await expect(bulk).toHaveCount(0);
				}
			);

			await step(
				'pick them again and give them Dining Out: only they change, the bookshop stays Unapproved, and Undo takes focus',
				async () => {
					for (const box of chosen) await box.check();
					await choose(bulk, 'Dining Out');
					await expect(page.getByText('3 Transactions now Dining Out.')).toBeVisible();
					await expect(undo).toBeFocused();
					await expect(picked).toHaveCount(0);
					expect(await categoryNames(chosen)).toEqual(['Dining Out', 'Dining Out', 'Dining Out']);
					expect(await categoryNames([between])).toEqual(before.between);
					await expect(
						page.getByRole('button', { name: /^SAMPLE BOOKSHOP 0193, Unapproved/ })
					).toBeVisible();
				}
			);

			await step('Undo puts each row’s own Category back', async () => {
				await undo.click();
				await expect(page.getByText('3 Transactions put back')).toBeAttached();
				await expect.poll(() => categoryNames(chosen)).toEqual(before.chosen);
				await expect(categoryIn(bookshop)).toBeFocused();
			});

			await step(
				'with Approve them too, the bookshop and hardware rows become Groceries and approved, and Undo makes them Unapproved and Uncategorized again',
				async () => {
					const approveAll = page.getByRole('button', { name: /^Approve all \d/ });
					const waiting = await approveAll.textContent();
					const ids = await Promise.all(
						[bookshop, hardware].map((box) => categoryIn(box).getAttribute('data-category'))
					);
					const category = (id: string | null) =>
						page.getByRole('button').and(page.locator(`[data-category="${String(id)}"]`));
					await bookshop.check();
					await hardware.check();
					await bulk.click();
					const approveToo = page.getByRole('checkbox', { name: 'Approve them too', exact: true });
					await expect(approveToo).toHaveAccessibleDescription(
						'Marks these Transactions reviewed. Balances already include them.'
					);
					await approveToo.check();
					await page.getByRole('option', { name: 'Groceries', exact: true }).click();
					await expect(page.getByText('2 Transactions now Groceries and approved.')).toBeVisible();
					for (const id of ids) await expect(category(id)).toHaveAccessibleName(/^Groceries, /);
					await expect(
						page.getByRole('button', { name: /^SAMPLE (BOOKSHOP 0193|HARDWARE 2208), Unapproved/ })
					).toHaveCount(0);
					await undo.click();
					for (const id of ids) await expect(category(id)).toHaveAccessibleName(/^Uncategorized, /);
					await expect(approveAll).toHaveText(waiting ?? '');
				}
			);

			await step(
				'a Transfer picked with an ordinary row keeps its Category while the ordinary row takes the new one',
				async () => {
					const transfer = page.getByRole('checkbox', { name: /^Select Transfer,/ }).first();
					const transferCategory = await categoryIn(transfer).getAttribute('aria-label');
					await transfer.check();
					await hardware.check();
					await expect(page.getByText('1 Transfer keeps its Category.')).toBeVisible();
					await expect(bulk).toHaveAccessibleName('Category for 1 selected Transaction');
					await choose(bulk, 'Groceries');
					await expect(page.getByText('1 Transaction now Groceries.')).toBeVisible();
					await expect(categoryIn(hardware)).toHaveAccessibleName(/^Groceries, /);
					await expect(categoryIn(transfer)).toHaveAccessibleName(transferCategory ?? '');
				}
			);

			await step(
				'changing a row that action left alone keeps its Undo, and changing a row it touched retires it',
				async () => {
					await expect(undo).toBeVisible();
					await choose(categoryIn(bookshop), 'Dining Out');
					await expect(categoryIn(bookshop)).toHaveAccessibleName(/^Dining Out, /);
					await expect(undo).toBeVisible();
					await choose(categoryIn(hardware), 'Dining Out');
					await expect(categoryIn(hardware)).toHaveAccessibleName(/^Dining Out, /);
					await expect(undo).toHaveCount(0);
				}
			);

			await step(
				'a bulk save that lands after its selection was cleared and another row checked leaves that row checked and focused, and offers no Undo',
				async () => {
					const saving = await holdResponseTo(page, 'transactions:categorizeMany');
					await page.goto('/accounts');
					await bookshop.check();
					await choose(bulk, 'Groceries');
					await saving.held;
					await expect(bulk).toContainText('Saving…');
					await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
					await between.focus();
					await page.keyboard.press('Space');
					await expect(between).toBeChecked();
					saving.release();
					await expect(categoryIn(bookshop)).toHaveAccessibleName(/^Groceries, /);
					await expect(bulk).not.toContainText('Saving…');
					await expect(between).toBeChecked();
					await expect(between).toBeFocused();
					await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
					await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
					await expect(picked).toHaveCount(0);
					await expect(undo).toHaveCount(0);
				}
			);

			await step(
				'a Split in the selection is named as keeping its Category, and with nothing else picked there is nothing to categorize',
				async () => {
					await page.getByRole('searchbox', { name: 'Search' }).fill('Warehouse');
					await expect(bookshop).toHaveCount(0);
					await page.getByRole('checkbox', { name: /^Select Sample Warehouse Club,/ }).check();
					await expect(page.getByText('1 Split keeps its Category.')).toBeVisible();
					await expect(bulk).toHaveAccessibleName('Category for 0 selected Transactions');
					await expect(bulk).toBeDisabled();
					await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
					await expect(picked).toHaveCount(0);
					await expect(page.getByRole('button', { name: /^Approve( \d+)? shown$/ })).toBeFocused();
				}
			);

			await step(
				'at 320 px the selection bar stays on screen while scrolling, clear of the tab bar and the right edge, and its picker saves',
				async () => {
					await page.setViewportSize({ width: 320, height: 640 });
					await page.getByRole('button', { name: 'Clear search and filters' }).click();
					await expect(selectBoxes.first()).toBeVisible();
					await coffee.nth(1).check();
					await coffee.nth(3).check();
					const tabBar = page.getByRole('navigation', { name: 'Sections', exact: true });
					await selectBoxes.nth(30).focus();
					await expectClearOf(bulk, tabBar);
					await selectBoxes.nth(10).focus();
					await expectClearOf(selectBoxes.nth(10), tabBar, page.locator('[data-selection-bar]'));
					await expectNothingPastTheRightEdge(page);
					await bulk.click();
					const listbox = page.getByRole('listbox');
					await expectClearOf(listbox, tabBar);
					await expectNothingPastTheRightEdge(page);
					await page.getByRole('combobox', { name: 'Search Categories' }).fill('dini');
					await listbox.getByRole('option', { name: 'Dining Out', exact: true }).click();
					await expect(page.getByText('2 Transactions now Dining Out.')).toBeVisible();
					await expectClearOf(undo, tabBar);
					await expectNothingPastTheRightEdge(page);
				}
			);
		}
	},
	'payee-groups': {
		title:
			'grouped by Payee, a mixed-purpose Payee’s shown rows are picked at once, some are left out, and the same selection gives each part its own Category',
		fixture: 'budget-with-accounts',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			const warehouse = 'SAMPLE WAREHOUSE 7701';
			const lookalike = 'SAMPLE WAREHOUSE 7702';
			const today = localToday();
			const visits = [
				{ date: today, amount: '61.20' },
				{ date: addDays(today, -1), amount: '18.45' },
				{ date: addDays(today, -2), amount: '92.10' },
				{ date: addDays(today, -3), amount: '24.99' }
			];
			const csvDate = (date: string) => {
				const [year, month, day] = date.split('-');
				return `${month ?? ''}/${day ?? ''}/${year ?? ''}`;
			};
			const bankRow = (payee: string, date: string, amount: string) =>
				`0000,${payee},${csvDate(date)},Debit,${amount},100.00`;
			const importIntoSavings = async (name: string, rows: string[]) => {
				await page.getByRole('button', { name: 'Import file' }).click();
				const dialog = page.getByRole('dialog', { name: 'Import a bank file' });
				await chooseBankFile(
					page,
					name,
					[
						'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
						...rows
					].join('\n')
				);
				await expect(dialog.getByRole('status')).toHaveText(
					new RegExp(`^${String(rows.length)} new Transactions, 0 Matches`)
				);
				await dialog.getByRole('button', { name: /^Import \d+ rows?$/ }).click();
				await expect(dialog).toBeHidden();
			};

			const grouping = page.getByRole('button', { name: 'Group by Payee' });
			const groupBox = (payee: string, count: number) =>
				page.getByRole('checkbox', {
					name: `Select the ${String(count)} Unapproved shown from ${payee}`,
					exact: true
				});
			const groupOf = (payee: string) =>
				page.getByRole('rowgroup').filter({
					has: page.getByRole('checkbox', {
						name: new RegExp(`^Select the \\d+ Unapproved shown from ${payee}$`)
					})
				});
			const rowBoxes = (payee: string) =>
				groupOf(payee).getByRole('checkbox', { name: new RegExp(`^Select ${payee}, `) });
			const categoryOf = (box: Locator) =>
				box
					.locator('xpath=ancestor::tr[1]')
					.getByRole('button', { name: /, Category of / })
					.getAttribute('aria-label')
					.then((name) => (name ?? '').split(', Category of ')[0]);
			const categoriesOf = (boxes: Locator) =>
				boxes.all().then((all) => Promise.all(all.map(categoryOf)));
			const bulk = page.getByRole('button', { name: /^Category for \d+ selected Transactions?$/ });
			const selectedCount = page.getByText(/^\d+ selected$/);

			await step(
				`import four ${warehouse} rows and one ${lookalike} row into Savings`,
				async () => {
					await page.goto('/');
					await openAccount(page, 'Savings');
					await importIntoSavings('savings.csv', [
						...visits.map(({ date, amount }) => bankRow(warehouse, date, amount)),
						bankRow(lookalike, addDays(today, -1), '7.77')
					]);
				}
			);

			await step(
				'Group by Payee heads each Payee once, keeps the lookalike Payee apart, and lists each visit by its date and amount',
				async () => {
					await grouping.click();
					await expect(grouping).toHaveAttribute('aria-pressed', 'true');
					await expect(page).toHaveURL(/[?&]group=payee/);
					await expect(groupOf(warehouse).getByRole('rowheader')).toHaveText(
						new RegExp(`^${warehouse}\\s*4 shown$`)
					);
					await expect(rowBoxes(warehouse)).toHaveCount(4);
					await expect(rowBoxes(lookalike)).toHaveCount(1);
					const visitRows = groupOf(warehouse).getByRole('button', { name: /edit Transaction on/ });
					await expect(visitRows).toHaveText(visits.map(({ date }) => formatDate(date)));
					for (const { amount } of visits)
						await expect(
							groupOf(warehouse).getByRole('cell', { name: `−$${amount}`, exact: true })
						).toBeVisible();
				}
			);

			const before = await categoriesOf(rowBoxes(warehouse));
			await step(
				'the Payee’s box picks its four shown rows; two left out leave it mixed, and a row of another Payee joins',
				async () => {
					await groupBox(warehouse, 4).check();
					await expect(selectedCount).toHaveText('4 selected');
					await expect(rowBoxes(lookalike)).not.toBeChecked();
					await rowBoxes(warehouse).nth(1).uncheck();
					await rowBoxes(warehouse).nth(3).uncheck();
					await expect(groupBox(warehouse, 4)).toHaveAttribute('aria-checked', 'mixed');
					await expect(selectedCount).toHaveText('2 selected');
					await rowBoxes(lookalike).check();
					await expect(selectedCount).toHaveText('3 selected');
				}
			);

			await step(
				'Groceries goes to those three only; the two left out keep their Category',
				async () => {
					await choose(bulk, 'Groceries');
					await expect(page.getByText('3 Transactions now Groceries.')).toBeVisible();
					await expect
						.poll(() => categoriesOf(rowBoxes(warehouse)))
						.toEqual(['Groceries', before[1], 'Groceries', before[3]]);
					expect(await categoriesOf(rowBoxes(lookalike))).toEqual(['Groceries']);
				}
			);

			await step(
				'the Payee’s box again, less the Groceries rows, gives the other two Gifts and approves them',
				async () => {
					await groupBox(warehouse, 4).check();
					await rowBoxes(warehouse).nth(0).uncheck();
					await rowBoxes(warehouse).nth(2).uncheck();
					await expect(selectedCount).toHaveText('2 selected');
					await bulk.click();
					await page.getByRole('checkbox', { name: 'Approve them too', exact: true }).check();
					await page.getByRole('option', { name: 'Gifts', exact: true }).click();
					await expect(page.getByText('2 Transactions now Gifts and approved.')).toBeVisible();
					await expect(groupBox(warehouse, 2)).toBeVisible();
					await expect(
						groupOf(warehouse).getByRole('button', { name: /edit Transaction on/ })
					).toHaveText([visits[0], visits[2]].map((visit) => formatDate(visit?.date ?? '')));
				}
			);

			await step(
				'grouping survives a reload and keeps a selection when turned off, and every row keeps its own Payee',
				async () => {
					await page.reload();
					await expect(grouping).toHaveAttribute('aria-pressed', 'true');
					await rowBoxes(lookalike).check();
					await grouping.click();
					await expect(grouping).toHaveAttribute('aria-pressed', 'false');
					await expect(page).not.toHaveURL(/[?&]group=/);
					await expect(
						page.getByRole('rowheader', { name: new RegExp(`^${warehouse}`) })
					).toHaveCount(0);
					await expect(selectedCount).toHaveText('1 selected');
					await expect(
						page.getByRole('checkbox', { name: new RegExp(`^Select ${lookalike}, `) })
					).toBeChecked();
					await expect(
						page.getByRole('button', { name: new RegExp(`^${warehouse}, Unapproved, edit`) })
					).toHaveCount(2);
					await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
				}
			);

			for (const width of [320, 390]) {
				await step(
					`at ${String(width)} px a group heads its rows with the whole Payee name, and nothing reaches past the right edge`,
					async () => {
						await page.setViewportSize({ width, height: 740 });
						if ((await grouping.getAttribute('aria-pressed')) !== 'true') await grouping.click();
						const heading = groupOf(warehouse).getByRole('rowheader');
						await heading.scrollIntoViewIfNeeded();
						await expect(heading).toHaveText(new RegExp(`^${warehouse}\\s*2 shown$`));
						const lines = await heading
							.getByText(warehouse, { exact: true })
							.evaluate((name) => name.getClientRects().length);
						expect(lines).toBe(1);
						await groupBox(warehouse, 2).check();
						await expect(selectedCount).toHaveText('2 selected');
						await expectClearOf(
							groupBox(warehouse, 2),
							page.getByRole('navigation', { name: 'Sections', exact: true }),
							page.locator('[data-selection-bar]')
						);
						await expectNothingPastTheRightEdge(page);
						await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
					}
				);
			}

			const older = 'SAMPLE ARCADE 3301';
			const newer = 'SAMPLE ZOO 9902';
			await step(
				`past the first page, Show more lands on the first new row as shown: ${older}, though it is older than the new ${newer} rows`,
				async () => {
					await page.setViewportSize({ width: 1280, height: 800 });
					await importIntoSavings('more.csv', [
						...Array.from({ length: 50 }, (_, index) =>
							bankRow(newer, addDays(today, -4 - (index % 10)), (index + 1).toFixed(2))
						),
						bankRow(older, addDays(today, -20), '3.30')
					]);
					await page.reload();
					await expect(rowBoxes(newer)).not.toHaveCount(0);
					await expect(rowBoxes(older)).toHaveCount(0);
					await page.getByRole('button', { name: 'Show more', exact: true }).click();
					await expect(
						groupOf(older).getByRole('button', { name: /edit Transaction on/ })
					).toBeFocused();
				}
			);

			await step(
				`Undo puts focus on the first restored row as shown, ${older} before the newer ${newer}, after a Category change and after an approval`,
				async () => {
					const undo = page.getByRole('button', { name: 'Undo', exact: true });
					const pickBoth = async () => {
						await rowBoxes(newer).first().check();
						await rowBoxes(older).check();
						await expect(selectedCount).toHaveText('2 selected');
					};
					await pickBoth();
					await choose(bulk, 'Gifts');
					await expect(page.getByText('2 Transactions now Gifts.')).toBeVisible();
					await undo.click();
					await expect(
						groupOf(older).getByRole('button', { name: /, Category of / })
					).toBeFocused();
					await pickBoth();
					await page.getByRole('button', { name: 'Approve 2 selected', exact: true }).click();
					await expect(page.getByText('Approved 2 Transactions.')).toBeVisible();
					await undo.click();
					await expect(
						page.getByRole('button', { name: new RegExp(`^Approve ${older}, `) })
					).toBeFocused();
				}
			);
		}
	},
	'approve-phone': {
		title: 'on a 320 px phone, an Unapproved Transaction opens from its Payee and can be approved',
		fixture: 'bank-sync',
		run: async (page, { step }) => {
			await page.setViewportSize({ width: 320, height: 640 });
			const table = page.locator('[data-slot="table-container"]');

			await step('Accounts lists the Unapproved bookshop row without sideways scroll', async () => {
				await page.goto('/accounts');
				await expect(
					page.getByRole('heading', { level: 1, name: 'Accounts', exact: true })
				).toBeVisible();
				await expect(
					table.getByRole('button', { name: /^SAMPLE BOOKSHOP 0193, Unapproved/ })
				).toBeVisible();
				expect(
					await table.evaluate((container) => container.scrollWidth <= container.clientWidth)
				).toBe(true);
				await expectNothingPastTheRightEdge(page);
			});

			await step('the first Transaction shows above the tab bar without scrolling', async () => {
				await expectClearOf(
					table.getByRole('button', { name: /edit Transaction on/ }).first(),
					page.getByRole('navigation', { name: 'Sections', exact: true })
				);
			});

			await step('approve it from its dialog', async () => {
				await table.getByRole('button', { name: /^SAMPLE BOOKSHOP 0193, Unapproved/ }).click();
				const editing = page.getByRole('dialog', { name: 'Edit Transaction' });
				const pinned = editing.locator('[data-slot="dialog-bar"]');
				for (const field of [
					editing.getByLabel('Category'),
					editing.getByRole('button', { name: 'Save' })
				]) {
					await field.scrollIntoViewIfNeeded();
					await expectClearOf(field, pinned);
				}
				await editing.getByRole('button', { name: 'Approve', exact: true }).click();
				await expect(editing).toBeHidden();
				await expect(
					table.getByRole('button', { name: /^SAMPLE BOOKSHOP 0193, edit/ })
				).toBeVisible();
			});
		}
	}
} satisfies Record<string, Journey>;
