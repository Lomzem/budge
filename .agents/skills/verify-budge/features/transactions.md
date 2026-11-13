# Transactions and the Transaction dialog

Enter, edit, categorize, clear, approve, and delete movements of money in an Account or across all of them.

## Sub-features

- `txn-create`, `txn-cancel`: save a new Transaction or discard a draft.
- `txn-edit`, `txn-clear`, `txn-delete`: persisted edits, bank confirmation, and removal.
- `txn-categorize`: change one Transaction's Category or Transfer in place (`transactions.categorize`), leaving its approval as it was.
- `txn-list`: paginated Account and Accounts-page views; Uncategorized and Unapproved counts.

## How to get to it (user POV)

- The Accounts Section (`/accounts`, heading `Accounts`, with All Transactions below the phone Account list) or any named Account (`/accounts/<id>`) through the sidebar, the Accounts page, or the phone tab bar.
- Choose `Add Transaction`, or a row button named `<Payee>, edit Transaction on …`.
- The dialog asks Account, Date, Payee (suggesting saved Payees), Direction, Amount, then Category or Transfer and Memo. Its body scrolls under a sticky footer that holds the error line and Save, so Save and errors stay on screen in a long form; every form dialog uses that footer. On phones the footer's buttons share rows, the primary one last: an Unapproved Transaction at 320 px shows Delete (red tint, confirms first) beside Approve, then Save across the width.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/transactions.ts`, also run by `bun run test:e2e:local`):

- `transactions/create`: typing a new Payee one key at a time leaves Save enabled (Category settles on Uncategorized, never stuck on `Looking up the last Category…`), and Add Transaction lowers the Account balance (`txn-create`). The Payee lookup returns `null` for each prefix; `patches/convex-svelte@0.15.1.patch` makes `useQuery` take a repeated `null` answer for new arguments.
- `transactions/create` also covers the editor's keyboard and safety: Add Transaction on an Account's register opens on Payee (from All Accounts it opens on Account); Enter in Payee moves to Amount; Save with no amount shows the footer error, which clears as soon as an amount is typed; Escape on a changed form opens `Discard your changes?` (`Keep editing` keeps the typing, `Discard` closes). An unchanged form, or one mid-save, closes on Escape without asking.
- `transactions/late-save`: a save that finishes after the dialog closed leaves the next opening alone.
- `transactions/approve-all-undo`: on `bank-sync`, the unfiltered register heads its rows `Unapproved` then `Approved` (row headers); a search for `BOOKSHOP` turns the button into `Approve N shown`, which approves only the shown Unapproved rows (`transactions.approveMany`), leaves `Approve shown` `aria-disabled` and a non-bookshop row Unapproved once the search is cleared, where Undo is hidden; searched again, Undo returns and puts them back; unfiltered, `Approve all N` approves them and the count line reads `Approved N Transactions. Undo`; Undo puts exactly those rows back to Unapproved. A row's own Approve offers Undo too (`Approved <Payee>. Undo`), and Undo focuses the restored row's Approve. Undo shows only in the scope and filters where the approval happened, and ends when another row is approved.
- `transactions/approve-phone`: at 320 px the first Transaction shows above the tab bar without scrolling, an Unapproved row opens from its Payee, its Category and Save scroll clear of the dialog's pinned header, and it is approved (`txn-list`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** on Checking click `getByRole("button", { name: "Add Transaction", exact: true })`. Scope to `getByRole("dialog", { name: "Add Transaction", exact: true })`; fill labels `Payee` with `Sample Verification Bakery`, `Amount` with `12.34`, and `Memo` with `Invented bread`; choose `Outflow`, and `choose` `Category or Transfer` option `Groceries`. Click `Save`. Require the row and an Account balance decrease of 1234 cents (`getByTestId("account-balance")`); reload and reopen to assert every field. Repeat from All Accounts with the dialog’s `Account` selector.
- **Cancel:** open Add Transaction, fill a different invented Payee, press Escape; require no saved row or balance change.
- **Edit/clear:** open the created row by `getByRole("button", { name: /^Sample Verification Bakery/ })`; change Amount, Date, Account, Category, memo, and Direction in separate checks. Save and verify the resulting balances and budget Activity; revisit both Account pages after moving an Account. Toggle `getByRole("checkbox", { name: /^Cleared: Sample Verification Bakery/ })`, reload, require checked.
- **Delete:** open the row, click `Delete`, then confirm `getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true })`. The confirmation's Delete is red; `Keep it` returns focus to the editor's Delete. Require absence after reload and reversal of its current balance/budget effect.
- **List:** use `Show more` when present; require new rows without duplicates. Capture list and dialog at 320 px, verify no horizontal overflow of the page or the table container. A click anywhere on a row outside its controls (and not while selecting text) opens `Edit Transaction`, as the Payee button does. Below a 512 px table the column labels are visually hidden (still read as column headers). Below a 448 px table the Date, Cleared and Approve columns hide: the short date sits under the Payee (which wraps in full; it clamps to one line only from a 896 px table), the Cleared checkbox sits under the amount, and an Unapproved row (bold) shows `Approve <Payee>, <date>` beside it (from 672 px the row's own Approve column takes over); approving moves focus to the next waiting row's Approve, else the nearest one above, else to `Approve all`, and the live region says `Approved <Payee>`; the Approve button (`Approve 1`, `Approve all N`, or `Approve N shown` while searching or filtering; `aria-disabled` at zero) sits at the right of the count line above the table; from `sm` the count line and that button share a row; below `sm` the button stacks under the count line whatever its text; with no rows at all (none yet, or none match) only the count line shows, without the table's column headers; the Search placeholder is `Payee or memo` (it also matches Bank Text); below a 480 px viewport it reads `Search`, and below a 448 px toolbar the `Search` label is visually hidden but still names the field; a row's Category and bank flag wrap instead of truncating; the Cleared checkbox's hit area is 44 px square, and on a touch screen the Payee button's hit area reaches 10 px above and below it; below 448 px Search, an icon-only Filters (with its count) and Clear share one row, and the toolbar's Import reads `Import` (its name stays `Import file`); deleting a Transaction returns focus to the neighboring row's Payee button, or `Add Transaction` when none is left; on `bank-sync` require the `SAMPLE BOOKSHOP 0193` Payee button visible and clickable at 320 px (`transactions/approve-phone` covers it). Follow imports for approval, splits for line editing, and Reconciliation for locks.

## Gotchas

- **Manual drive:** unfiltered lists put Unapproved Transactions first and load 50 per page via Show more. Above the table, `Approve all N` approves at most 1,000 at a time; with more, the button reads `Approve 1,000`. Approve inside Edit Transaction leaves balances unchanged; desktop row Approve is also available. The Budget's `Needs you` chips for Uncategorized and Unapproved land on this list already filtered (see [search.md](search.md)).
- **Manual drive:** a line above the table reads the result, naming a Status or Uncategorized filter and saying `matching` for any other (`N Transactions`, `9 Uncategorized Transactions`, `3 matching Unapproved Transactions`, `2 Transactions the bank changed`, `… shown, more below`, `No Transactions match.`, `No bank changes wait on you.`) at a fixed height. Filters live in the URL (`q`, `account`, `category`, `status`, `payee`, `from`, `to`), so reload and Back keep them; malformed values are ignored, and an `account`, `category` or `payee` the filter menus don't offer is dropped from the URL before anything loads (`search/filters`). Status `Bank changes` lists every Transaction whose Bank Row changed or vanished (see [bank-changes.md](bank-changes.md)). After Save or Delete in the dialog, focus returns to the edited row, else the row now in its place, else `Add Transaction`, and the live region names what happened (`Transaction saved`, `Transaction deleted`). `Show more` focuses the first new row.
- **Manual drive:** in a Split, focusing an empty line's amount fills it with what is left of the total.
- **Manual drive:** check Payee Category recall and lookup/loading/failure states using [payees.md](payees.md). A Starting Balance keeps its Account, has no Payee, and cannot Split or become a Transfer. A Date before cutover must fail with `Budge starts on the cutover date; pick a later date.` and save nothing.

- Amounts follow the selected Direction; changing a field without Save is not persistence.
- Reconciled rows restrict edits until Unlock. A seeded list may not exceed a page: report pagination blocked if Show more cannot be reached with current data.
- Sources: ticket 03, 05, 14, 16; public `transactions.list/create/update/categorize/remove/setCleared/approve/approveAll/approveMany/unapprove/unapprovedCount/bankChangeCount`.
