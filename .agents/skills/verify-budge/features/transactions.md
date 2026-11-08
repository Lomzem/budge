# Transactions and the Transaction dialog

Enter, edit, categorize, clear, approve, and delete movements of money in an Account or across all of them.

## Sub-features

- `txn-create`, `txn-cancel`: save a new Transaction or discard a draft.
- `txn-edit`, `txn-clear`, `txn-delete`: persisted edits, bank confirmation, and removal.
- `txn-list`: paginated Account and Accounts-page views; Uncategorized and Unapproved counts.

## How to get to it (user POV)

- The Accounts Section (`/accounts`, heading `Accounts`, with All Transactions below the phone Account list) or any named Account (`/accounts/<id>`) through the sidebar, the Accounts page, or the phone tab bar.
- Choose `Add Transaction`, or a row button named `<Payee>, edit Transaction on …`.
- The dialog asks Account, Date, Payee (suggesting saved Payees), Direction, Amount, then Category or Transfer and Memo. Its body scrolls under a sticky footer that holds the error line and Save, so Save and errors stay on screen in a long form; every form dialog uses that footer.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/transactions.ts`, also run by `bun run test:e2e:local`):

- `transactions/create`: Add Transaction lowers the Account balance (`txn-create`).
- `transactions/late-save`: a save that finishes after the dialog closed leaves the next opening alone.
- `transactions/approve-phone`: at 320 px an Unapproved row opens from its Payee and is approved (`txn-list`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** on Checking click `getByRole("button", { name: "Add Transaction", exact: true })`. Scope to `getByRole("dialog", { name: "Add Transaction", exact: true })`; fill labels `Payee` with `Sample Verification Bakery`, `Amount` with `12.34`, and `Memo` with `Invented bread`; choose `Outflow` and `Category or Transfer` option `Groceries`. Click `Save`. Require the row and an Account balance decrease of 1234 cents (`getByTestId("account-balance")`); reload and reopen to assert every field. Repeat from All Accounts with the dialog’s `Account` selector.
- **Cancel:** open Add Transaction, fill a different invented Payee, press Escape; require no saved row or balance change.
- **Edit/clear:** open the created row by `getByRole("button", { name: /^Sample Verification Bakery/ })`; change Amount, Date, Account, Category, memo, and Direction in separate checks. Save and verify the resulting balances and budget Activity; revisit both Account pages after moving an Account. Toggle `getByRole("checkbox", { name: /^Cleared: Sample Verification Bakery/ })`, reload, require checked.
- **Delete:** open the row, click `Delete`, then confirm `getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true })`. Require absence after reload and reversal of its current balance/budget effect.
- **List:** use `Show more` when present; require new rows without duplicates. Capture list and dialog at 320 px, verify no horizontal overflow of the page or the table container. Below a 448 px table the Date, Cleared and Approve columns hide: the short date sits under the Payee (which wraps to two lines), the Cleared checkbox sits under the amount, and an Unapproved row (bold) shows `Approve <Payee>, <date>` beside it (from 672 px the row's own Approve column takes over); approving moves focus to the next waiting row's Approve, else to `Approve all`, and the live region says `Approved <Payee>`; the toolbar's Approve button (`Approve 1`, `Approve all N`, disabled at zero) is always present above the table; on `bank-sync` require the `SAMPLE BOOKSHOP 0193` Payee button visible and clickable at 320 px (`transactions/approve-phone` covers it). Follow imports for approval, splits for line editing, and Reconciliation for locks.

## Gotchas

- **Manual drive:** unfiltered lists put Unapproved Transactions first and load 50 per page via Show more. Above the table, `Approve all N` approves at most 1,000 at a time; with more, the button reads `Approve 1,000`. Approve inside Edit Transaction leaves balances unchanged; desktop row Approve is also available. The Budget's `Needs you` chips for Uncategorized and Unapproved land on this list already filtered (see [search.md](search.md)).
- **Manual drive:** a line above the table reads the result (`N Transactions`, `… shown, more below`, `No Transactions match.`, `No bank changes wait on you.`) at a fixed height. Filters live in the URL (`q`, `account`, `category`, `status`, `payee`, `from`, `to`), so reload and Back keep them; malformed values are ignored. Status `Bank changes` lists every Transaction whose Bank Row changed or vanished (see [bank-changes.md](bank-changes.md)). After Save or Delete in the dialog, focus returns to the edited row, else the row now in its place, else `Add Transaction`, and the live region names what happened (`Transaction saved`, `Transaction deleted`). `Show more` focuses the first new row.
- **Manual drive:** in a Split, focusing an empty line's amount fills it with what is left of the total.
- **Manual drive:** check Payee Category recall and lookup/loading/failure states using [payees.md](payees.md). A Starting Balance keeps its Account, has no Payee, and cannot Split or become a Transfer. A Date before cutover must fail with `Budge starts on the cutover date; pick a later date.` and save nothing.

- Amounts follow the selected Direction; changing a field without Save is not persistence.
- Reconciled rows restrict edits until Unlock. A seeded list may not exceed a page: report pagination blocked if Show more cannot be reached with current data.
- Sources: ticket 03, 05, 14, 16; public `transactions.list/create/update/remove/setCleared/approve/approveAll/unapprovedCount/bankChangeCount`.
