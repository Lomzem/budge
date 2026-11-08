# Split Transactions

Divide one Transaction across Categories and memos while preserving its total and each Category’s budget effect.

## Sub-features

- `split-create`, `split-edit`, `split-remove`: lines, remainder, persistence, unsplitting.
- `split-card`: each line moves funds to the Credit Card Payment Category.

## How to get to it (user POV)

- Add/Edit Transaction → Category or Transfer → Split across Categories.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/splits.ts`, also run by `bun run test:e2e:local`):

- `splits/lines`: a split shows Split in the list, and lines are added, edited and removed (`split-create`, `split-edit`, `split-remove`).
- `splits/restart`: leaving Split and choosing it again starts from the current amount and Category.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** fill Amount 10.00, select `Split across Categories`. Fill labels `Line 1 Category`, `Line 1 amount`, `Line 1 memo`, and corresponding Line 2 labels with Groceries/6.00/invented food and Gifts/4.00/invented birthday. Save, require Split in list. Reload/reopen and require both lines and correct budget Activity, Account balance −$10.
- **Validation/edit:** enter lines not summing to parent; require remainder/error and no successful save. Restore sum; exercise Add line and `Remove line N` (disabled at two lines, enabled above two), save, reopen. Change parent Date and verify both Categories’ Activity in the new month. Select a single Category to unsplit; require lines gone and total unchanged after reload.
- **Card:** repeat on Card; require outflow lines to increase Credit Card Payment Category Activity and inflow lines to decrease it, with corresponding ordinary Category Activity. Check both directions manually. Capture dialog at 320 px with all lines reachable by scrolling.

## Gotchas

- Starting Balances cannot Split.
- **Manual drive:** Search finds split memos, and Category filtering finds Transactions through their split lines; assert the parent appears once, including when several lines use that Category.

- 2–50 lines, sums in whole cents; a negative line reverses Direction. A split cannot also be a Transfer.
- Sources: ticket 11; public Transaction create/update and list.
