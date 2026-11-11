# 15 — Fixes from review round 8

Status: done; round 9 reviews next

Round 8 scored 9 (sol-a8), 9 (sol-b8) and 8 (opus8).

## Done

- Budget, Assigned: a refused amount shows its message under the field only while the field has focus or the pointer is over it, so the message no longer covers the next row. Screen readers get the message from an alert that is always present. An entry that starts with `+` or `−` adds to or takes from the saved amount (`+5`, `-20`). The message names this: `Enter an amount, such as 120.00, 100+20, or +5 to add. Escape puts back the saved amount.` (`parseAssigned` in `src/lib/domain/money.ts`).
- Budget: the `Needs you` chips read `10 Uncategorized` and `2 bank changes`, so at 1280 px every chip fits in one row.
- Inspector: the next and previous Category buttons wrap a long name onto two lines rather than truncating it.
- Register: a row's Approve now offers Undo on the count line (`Approved <Payee>.`). Undo puts the row back and focuses its Approve. After an Approve, focus moves to the next Unapproved row below, else the nearest one above.
- Account page at 320×640: Balance, the amount and the reconciled line stack beside Reconcile, so the first Transaction shows above the tab bar on every Account, the Card included.
- Add Transaction:
  - Opened from an Account, it focuses Payee.
  - Direction and Amount share one row, and field gaps are tighter on phones. At 320×640 the Category select sits wholly above the sticky Save bar (select bottom 506, bar top 519).
- Dialogs: once the body scrolls, a bar behind the Close button shows the dialog's title and a rule. Content no longer slides under a bare ×. Scrolling a field into view leaves room for the bar.
- Bank:
  - The intro is the same single paragraph at every width.
  - A healthy card says `Reconnect if the bank asks you to sign in again.`, and that line describes its Reconnect button. The line doesn't claim Reconnect adds accounts, because Plaid's update mode doesn't offer account selection.
- Import: a file Budge can't read names what it found (`Its columns are “A”, “B”…` or `It has no column names.`) and says where to get the right file.

## Kept as is

- `Approve all` stays visible with `aria-disabled` when nothing is left to approve. Hiding it would shift the count line and drop the focus target that Undo and the last Approve return to.

## Verification

- These pass: `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, `format:check` and `bun run test` (823 tests).
  - `src/lib/domain/money.test.ts` covers relative Assigned entry.
  - `src/lib/domain/bankFiles.test.ts` covers the unknown-layout message.
- Changed journeys:
  - `transactions/approve-all-undo`: a single Approve's Undo and its focus.
  - `transactions/create`: Payee focus on opening.
  - `budget/needs-you`: the chip text.
- The feature maps for transactions, budget, bank-changes and plaid are updated.
- Measured at 320×640:
  - Every Account's first register row ends above the tab bar (row bottom 534 or 566, tab bar 575).
  - Add Transaction's Category label is at 434, with the Save bar at 519.
