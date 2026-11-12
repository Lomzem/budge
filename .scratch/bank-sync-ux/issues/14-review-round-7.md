# 14 — Fixes from review round 7

Status: done; round 8 reviews next

Round 7 scored 8 (sol-a7), 9 (sol-b7) and 8 (opus7).

## Done

- Bank Connections can be removed and bank Accounts can stop syncing. A card's `<connection> actions` menu offers `Stop syncing <Account>` for each Account it feeds and `Remove connection…`. Removing first asks in an alert dialog, then tells Plaid to drop the Item (when the server has credentials) through `bankConnections.remove`, forgets its bank Accounts and held rows, and keeps every Transaction. Focus moves to the next card. A named Account's actions menu has `Stop syncing from <connection>` (`heldAccounts.stopSyncing`). An ignored bank Account is listed under `Ignored bank Accounts` on its card. `Bring back` (`heldAccounts.restore`) offers it for setup again and focuses `Set up`. A brought-back row with nothing held reads `No transactions waiting yet`.
- Fixed: `Stop syncing from <connection>` on the Account page threw after the stop succeeded. It read the bank's name after the await, when the Account no longer had a feeder, so its notice never showed.
- Register: a click anywhere on a row outside its controls opens `Edit Transaction`. A click inside a text selection does not. The count line names the filter that narrows the list (`9 Uncategorized Transactions`, `3 matching Unapproved Transactions`, `1 Transaction the bank changed`). The Filters panel stays folded on arrival.
- Phones: at 320×640 a register now shows its first Transaction above the tab bar. The Account page's move and stop notices float as a toast with `Dismiss` instead of taking a reserved row. Below a 512 px table the column labels are visually hidden, though screen readers still read them as column headers. The count line no longer grows to 44 px on touch screens; its Undo gets the touch area from a pseudo-element.
- Splits: a refused save names the field to fix and focuses it. The messages are `Line N is empty. Fill it in, or remove the line.`, `Pick a Category for line N.`, `Enter line N's amount, or remove the line.`, or the last line's amount when the total is short or over. That field is `aria-invalid` and described by the alert. While an amount is blank the status reads `$0.00 left to split`.
- Reconcile: the dialog opens with the bank balance field focused. When the bank shows the cleared balance, `The bank shows the same` reconciles at it in one tap.
- Accessible names: the one-tap reconcile button and each register Payee button carry an `aria-label` that starts with their visible text. Their screen-reader suffix had been an `sr-only` span, and Chrome read a stray space before it (`same : reconcile`, `0193 , Unapproved`). The journeys now match the exact names.
- Held bank Account dialog: changing the choice scrolls its note into view. The note fills the band, and the Ignore note says where to bring the Account back.
- Theme: switching between light and dark recolors everything at once. No control animates its colors through the change.
- Budget: below `sm`, `Edit Categories` is an icon menu on the month row, and the month is an h2. The `Needs you` chips sit in one row. Ready to Assign has clearer copy.
- The `bank-sync` seed names Sample Community Bank's bank Account (`Sample Statement Savings`, ending 6604), so its rows read like a real bank's.

## Kept as is

- The web font uses `font-display: optional` with a preload. In dev, Vite serves it no-cache, so a reload may paint the metric-matched fallback. Production serves `/_app/immutable` with an immutable cache. Neither case shifts the layout.
- The running-balance column, and the payee combobox nit.
- A row's height can change when another device edits its data; that change isn't prompted by the viewer.
- sol-a7 reported dark-mode color mismatches on the sidebar icon and the Settings button. Once settled they read #e4ece6 on #121c17, so they were most likely captured mid-transition. Theme switching no longer transitions.

## Verification

- These pass: `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, `format:check` and `bun run test` (811 tests).
  - `src/lib/transactionFilters.test.ts` covers the count line's wording.
  - `src/lib/transactionEditor.test.ts` covers which field each refusal blames.
  - `convex/heldAccounts.test.ts`, `owner.test.ts` and `plaidClient.test.ts` cover stop, restore, forget and Item removal.
- New journeys: `plaid/remove` and `plaid/stop-and-bring-back`.
- Changed journeys:
  - `splits/*`: focus and the alert text.
  - `reconciliation/difference`: the one-tap reconcile.
  - `budget/needs-you`: the count line on arrival.
  - `accounts/held-ignore`: the Ignore copy.
- The feature maps for plaid, accounts, budget, bank-changes, search, transactions, reconciliation and splits are updated.
