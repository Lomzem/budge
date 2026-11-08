# 08 — Fixes from review round 1

Status: in progress (round 2 next)

Round 1 scores: Sol 6, Sol 6, Opus 4. The fixes below answer their findings.

## Done

- Phone inspector: below the wide layout the Category inspector opens as a dialog named for the Category. Close and Escape return focus to its row (`inspector/*`).
- Assigned: Enter saves and keeps focus with the amount selected, so the owner can type the next one. Escape restores the saved amount (`budget/assign`).
- Needs you: each item is a chip. Uncategorized links to `/accounts?category=uncategorized`, Unapproved to `/accounts?status=unapproved`, Bank to `/bank`, and overspent opens the first overspent Category (`budget/needs-you`, new).
- Filters: Category offers `Uncategorized`, a new Status filter offers `Unapproved`, both read from the URL, and arriving with a filter opens the panel. `transactions.list` takes `uncategorized`; the unused `approval` filter argument is gone.
- Bank cards: a `Feeds` line links the Budge Accounts each connection feeds (`bankConnections.list` returns `feeds`, capped at 50). Health and the last result sit on separate lines. A server without Plaid credentials says the card can't sync, but Sync now and Reconnect stay enabled, because the delayed-response Plaid journeys click them locally.
- Account page: `Synced … from <connection>`, or `Entered by hand or from bank files`.
- Phone Accounts page: the Account list folds into `Your Accounts`. It is open on a plain visit and closed when a filter link brings the owner in.
- Split form wraps at 320 px; every native select matches Input height; `sm`/`icon-sm` buttons are 44 px on coarse pointers; the tab bar reserves its bold label width; the search box drops the WebKit cancel ×.
- Reserved gaps removed: the register's alert floats as a toast-style alert, and the cutover alert takes no space when empty.
- Settings: Sign out and Add to Home Screen move to `This device`; `Your data` is Export only.
- Regression found while verifying: a branch commit had dropped the card-debt notes (`… of card debt not yet covered`) from the Budget table. Restored (`credit-cards/debt`).
- Journey fixes: `settings/cutover` waits for the saved date before reloading (the reload raced the save), and the held-row check filters by a page-level button locator.

## Verification

- `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, and `bun run test` (776 tests) pass.
- All 36 journeys pass with the layout-shift guard (verify run `r2-all`).

## Open

- Sticky Ready to Assign on long budgets (optional).
