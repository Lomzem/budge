# Transactions and the Transaction dialog

Enter, edit, categorize, clear, approve, and delete movements of money in an Account or All Accounts.

## Sub-features

- `txn-create`, `txn-cancel`: save a new Transaction or discard a draft.
- `txn-edit`, `txn-clear`, `txn-delete`: persisted edits, bank confirmation, and removal.
- `txn-list`: paginated Account and All Accounts views; Uncategorized and Unapproved counts.

## How to get to it (user POV)

- Sidebar All Accounts (`/accounts`) or any named Account (`/accounts/<id>`); phone View menu exposes the same views.
- Choose `Add Transaction`, or a row button named `<Payee>, edit Transaction on …`.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** on Checking click `getByRole("button", { name: "Add Transaction", exact: true })`. Scope to `getByRole("dialog", { name: "Add Transaction", exact: true })`; fill labels `Payee` with `Sample Verification Bakery`, `Amount` with `12.34`, and `Memo` with `Invented bread`; choose `Outflow` and `Category or Transfer` option `Groceries`. Click `Save`. Require the row and an Account balance decrease of 1234 cents (`getByTestId("account-balance")`); reload and reopen to assert every field. Repeat from All Accounts with the dialog’s `Account` selector.
- **Cancel:** open Add Transaction, fill a different invented Payee, press Escape; require no saved row or balance change.
- **Edit/clear:** open the created row by `getByRole("button", { name: /^Sample Verification Bakery/ })`; change Amount, Date, Account, Category, memo, and Direction in separate checks. Save and verify the resulting balances and budget Activity; revisit both Account pages after moving an Account. Toggle `getByRole("checkbox", { name: /^Cleared: Sample Verification Bakery/ })`, reload, require checked.
- **Delete:** open the row, click `Delete`, then confirm `getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true })`. Require absence after reload and reversal of its current balance/budget effect.
- **List:** use `Show more` when present; require new rows without duplicates. Capture list and dialog at 320 px, verify no horizontal overflow. Follow imports for approval, splits for line editing, and Reconciliation for locks.

## Gotchas

- Amounts follow the selected Direction; changing a field without Save is not persistence.
- Reconciled rows restrict edits until Unlock. A seeded list may not exceed a page: report pagination blocked if Show more cannot be reached with current data.
- Sources: ticket 03, 05, 14, 16; `e2e/transactions.test.ts`; public `transactions.list/create/update/remove/setCleared/approve/approveAll/unapprovedCount`.
