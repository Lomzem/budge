import { expect } from '@playwright/test';

import { holdResponseTo } from '../heldResponse';
import { centsIn, expectClearOf, openAccount, type Journey } from './journey';

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
				'a search approves only the Unapproved rows it shows, leaves the rest Unapproved, and Undo puts them back',
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
					await page.getByRole('button', { name: 'Clear search and filters' }).click();
					await expect(page.getByRole('button', { name: outside, exact: true })).toBeVisible();
					await page.getByRole('searchbox', { name: 'Search' }).fill('BOOKSHOP');
					await page.getByRole('button', { name: 'Undo', exact: true }).click();
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
