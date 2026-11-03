# Held, changed and removed Bank Rows

Keep approved or edited Transactions safe when the bank changes history, while applying untouched changes quietly.

## Sub-features

- `bank-held`: hold rows until their external Account is resolved (driven in [Accounts](accounts.md#driving-it-with-playwright)).
- `bank-quiet`: an untouched Unapproved row follows the bank's modification or removal without asking.
- `bank-resolve`: an approved or edited row is flagged `Bank changed this` or `Bank removed this`; the owner takes the bank's version or keeps theirs.
- `bank-many-rows`: a Transaction with more than ten Bank Rows always lists every flagged Bank Row first, lists at most ten linked ones, and says `More Bank Rows are linked than shown here. Search still finds their Bank Text.` when any are left out. Search covers every Bank Row's Bank Text.

## How to get to it (user POV)

- Account page (sidebar `Budget and Accounts` → `Checking`) → Transaction row with a `Bank changed this` or `Bank removed this` line under its Payee.
- Click the row's Payee button → dialog `Edit Transaction` → `Bank Text` section → `Use the bank's version` / `Delete it` / `Keep mine`.
- `Delete it` opens alert dialog `Delete this Transaction too?` (`Delete this Transfer too?` for a Transfer) → `Delete`.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index, then `bun run app seed bank-sync` instead of `budget-with-accounts`. Reseed before each independent recipe.
- Readiness: on `/accounts/…` for Checking, require a `row` containing button `/^SAMPLE GARDEN CENTER 7720/` and the text `Bank changed this`.

The fixture syncs Sample Credit Union twice through the production sync mutations (no Plaid). Before the second sync the owner edits two rows: SAMPLE GARDEN CENTER 7720 to $40.00 and SAMPLE STREAMING 4410's memo to `Shared family plan`. The second sync then changes and removes rows:

| Bank Text                 | Owner state           | Bank's change   | Expected on Checking                   |
| ------------------------- | --------------------- | --------------- | -------------------------------------- |
| SAMPLE PET SUPPLY 0311    | untouched, Unapproved | amount → $19.02 | quiet: −$19.02, Unapproved, no flag    |
| SAMPLE CAR WASH 0904      | untouched, Unapproved | removed         | quiet: row gone                        |
| SAMPLE GARDEN CENTER 7720 | edited to $40.00      | amount → $44.75 | −$40.00, `Bank changed this`           |
| SAMPLE STREAMING 4410     | memo edited, approved | removed         | −$9.91, memo kept, `Bank removed this` |

- **Quiet (`bank-quiet`):** require the pet row's amount −$19.02 and button name containing `Unapproved`, and no button `/^SAMPLE CAR WASH 0904/`. Neither row carries a flag.
- **Take the bank's (`bank-resolve`):** open SAMPLE GARDEN CENTER 7720; require text `/^Bank changed this: .44\.75 on /`; click `Use the bank's version`; require the dialog hidden, the row −$44.75 and no flag. Open SAMPLE STREAMING 4410; require `Bank removed this.`; click `Delete it`, then `Delete` in `Delete this Transaction too?`; require the row gone. Check the Account balance moved by −$4.75 and +$9.91 and reload to prove persistence.
- **Keep mine (`bank-resolve`, separate seed):** click `Keep mine` on both; require GARDEN still −$40.00, STREAMING still present with memo `Shared family plan`, both flags gone after reload, and the balance unchanged.
- At 320×640 the flag stays under the Payee (memo and Category columns drop away). Known defect: on `bank-sync` the Payee button renders 0 px wide at 320 px, so Playwright cannot click it; open the dialog at 1280 px, then set the viewport back to 320×640 to capture it.
- **Many Bank Rows (`bank-many-rows`):** no fixture has more than ten Bank Rows on one Transaction. Only held-Account mapping Matches another feed into a cleared imported Transaction, so build the precondition setup-only with a temporary internal mutation (never committed) after seeding `bank-sync`: save a manual Checking Transaction, then for each of twelve feeds on one new connection record the Account, sync one matching row, map it to Checking and run `internal.heldAccounts.settle`; finally sync a modification of the last feed. Give the last feed distinct Bank Text. Require the row flagged, the dialog listing the flagged row first with its `Bank changed this` line, eleven Bank Text entries, and the statement above; `Keep mine` clears the flag after reload; searching the last feed's distinct Bank Text finds the Transaction. Delete the module and restore `convex/_generated` afterwards.

## Gotchas

- `e2e/bank-changes.test.ts` owns both resolution journeys; `convex/bankChanges.test.ts` owns sync and resolution semantics (edited versus untouched, Transfers, reconciled rows). Drive the UI here; do not reassert backend states.
- The fixture's bank login token never decrypts, so Sync now and Reconnect on these connections fail with `Couldn't reach the bank; try again later.` That is expected and does not block these journeys.
- Sources: tickets 19, 21; `convex/seedBankSync.ts`; public `imports.resolveBankChange`; `bankRowsShown` in `convex/lib/transactions.ts`.
