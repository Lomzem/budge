# Split Transactions

Divide one Transaction across Categories and memos while preserving its total and each Category’s budget effect.

## Sub-features

- `split-create`, `split-edit`, `split-remove`: lines, remainder, persistence, unsplitting.
- `split-card`: each line moves funds to the Credit Card Payment Category.

## How to get to it (user POV)

- Add/Edit Transaction → Category or Transfer → Split across Categories.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** fill Amount 10.00, select `Split across Categories`. Fill labels `Line 1 Category`, `Line 1 amount`, `Line 1 memo`, and corresponding Line 2 labels with Groceries/6.00/invented food and Gifts/4.00/invented birthday. Save, require Split in list. Reload/reopen and require both lines and correct budget Activity, Account balance −$10.
- **Validation/edit:** enter lines not summing to parent; require remainder/error and no successful save. Restore sum; exercise Add line and each line removal control (inspect current snapshot for numbered accessible name), save, reopen. Change parent Date and verify both Categories’ Activity in the new month. Select a single Category to unsplit; require lines gone and total unchanged after reload.
- **Card:** repeat on Card; require total line amounts added to Payment Category and corresponding Category reductions. Capture dialog at 320 px with all lines reachable by scrolling.

## Gotchas

- 2–50 lines, sums in whole cents; a negative line reverses Direction. A split cannot also be a Transfer.
- Sources: ticket 11; `e2e/splits.test.ts`; public Transaction create/update and list.
