# Held, changed and removed Bank Rows

Keep approved or edited Transactions safe when the bank changes history, while applying untouched changes quietly.

## Sub-features

- `bank-held`: hold rows until their external Account is resolved (driven in [Accounts](accounts.md#driving-it-with-playwright)).
- `bank-quiet`: an untouched Unapproved row follows the bank's modification or removal without asking.
- `bank-resolve`: an approved or edited row is flagged `Bank changed this` or `Bank removed this`; the owner takes the bank's version or keeps theirs.
- `bank-many-rows`: a Transaction with more than ten Bank Rows lists ten, flagged ones first, and says `More Bank Rows back this Transaction than are shown here. Flagged ones come first, and search still finds every Bank Text.` when any are left out. Resolving the shown flagged rows brings the hidden ones into view. Search covers every Bank Row's Bank Text.

## How to get to it (user POV)

- The Accounts page (`/accounts`) or an Account page (sidebar `Sections and Accounts` → `Checking`) → Transaction row with a `Bank changed this` or `Bank removed this` line under its Payee.
- Or the Budget's `N bank changes` chip, which opens `/accounts?status=bank-changes` (Status `Bank changes`), listing the flagged Transactions. Budge reads at most the newest 500: past that the chip reads `500+ bank changes` and the result line adds `Resolve them to see the rest.`
- In the row itself, when one Bank Row is flagged: the flag reads `Bank changed this to <amount>` (or `Bank removed this`), then `Use the bank's` (named `Use the bank's <amount>: <Payee>, <date>`) or `Delete it`, and `Keep mine`. Each action's name ends `: <Payee>, <date>`. Resolving focuses the row's Payee button, or the next row's first action (or Payee) when the row leaves the list.
- Or click the row's Payee button → dialog `Edit Transaction`, which opens focused on a region at the top named `Your bank changed this Transaction` (or `Your bank removed this Transaction`) that says `The bank now says <amount> on <date>.` (a removed row shows only its Bank Text; `The bank removed it.` appears only when several Bank Rows are flagged) → `Use the bank's version` / `Delete it` / `Keep mine`.
- `Delete it` opens alert dialog `Delete this Transaction too?` (`Delete this Transfer too?` for a Transfer) → `Delete`. From the row it names the Payee: `The bank removed <Payee>. …`.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/bank-changes.ts`, also run by `bun run test:e2e:local`):

- `bank-changes/take-the-banks`: `bank-resolve` by taking the bank's version of both flagged rows: the changed one in its editor, the removed one from its row.
- `bank-changes/keep-mine`: `bank-resolve` by keeping mine on both: the changed one from its row, the removed one in its editor.

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
- **Take the bank's (beyond `bank-changes/take-the-banks`):** check the Account balance moved by −$4.75 and +$9.91 and reload to prove persistence.
- **Keep mine (beyond `bank-changes/keep-mine`):** require both flags gone after reload and the balance unchanged.
- At 320×640 the flag stays under the Payee, with the date, Category and Account lines (the Date, Category, Memo and Approve columns drop away). Click the Payee to open the dialog at that width.
- **Many Bank Rows (`bank-many-rows`):** no fixture has more than ten Bank Rows on one Transaction. Held-Account mapping and file imports can Match a Plaid-backed Cleared Transaction. For this many-feed recipe, build the precondition setup-only with a temporary internal mutation (never committed) after seeding `bank-sync`: save a manual Checking Transaction, then for each of twelve feeds on one new connection record the Account, sync one matching row, map it to Checking and run `internal.heldAccounts.settle`; finally sync a modification of the last feed. Give the last feed distinct Bank Text. Require the row flagged, the dialog listing ten Bank Text entries, the flagged row first with its `Bank changed this` line, and the statement above; `Keep mine` clears the flag after reload; searching the last feed's distinct Bank Text finds the Transaction. Delete the module and restore `convex/_generated` afterwards.

## Gotchas

- **Manual drive:** resolve flagged rows from the Accounts page as well as a named Account. File imports can Match Plaid-backed Transactions too.
- **Manual drive:** taking a bank amount that differs from a Split Transaction’s total is rejected with guidance to edit its lines first, then keep your version. Bank removal cannot delete a Transaction or Transfer while another Bank Row still backs either side; require the alert and unchanged balances.

- `convex/bankChanges.test.ts` owns sync and resolution semantics (edited versus untouched, Transfers, reconciled rows). Drive the UI here; do not reassert backend states.
- The fixture's bank login token never decrypts, so Sync now and Reconnect on these connections fail with `Bank sync isn't set up on this server.` (the local app has no Plaid credentials; with credentials it would be `Bank sync isn't set up on this server.`) That is expected and does not block these journeys.
- Sources: tickets 19, 21; `convex/seedBankSync.ts`; public `imports.resolveBankChange`; `bankRowsShown` in `convex/lib/transactionRows.ts`.
