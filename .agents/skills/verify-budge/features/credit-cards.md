# Credit Card Accounts and Payment Categories

Budget for card purchases, refunds, Overspending and payments without counting debt as Cash.

## Sub-features

- `card-start`: payment Category and uncovered starting debt.
- `card-assign`: `Assign $X` funds exactly the uncovered debt from Ready to Assign, leaving money waiting on overspent Categories to their Cover.
- `card-spend`, `card-refund`, `card-cover`, `card-payment`: full-amount movement and waiting-on status.

## How to get to it (user POV)

- Add Account → Credit card; Budget → Credit Card Payments → Card inspector; Card Transaction list.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/credit-cards.ts`, also run by `bun run test:e2e:local`):

- `credit-cards/debt`: the seeded Card's Payment Category shows the debt not yet covered (`card-start`); the inspector offers `Assign $612.48`, and the table's `Assign $612.48 to Card` funds it, removes both buttons and the uncovered note, returns focus to the Card name, lowers Ready to Assign by $612.48, and survives a reload (`card-assign`).

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Debt:** `credit-cards/debt` scopes the rowgroup whose header cell reads Credit Card Payments (`getByRole('rowgroup').filter({ hasText: 'Credit Card Payments' })`; the rowgroup itself has no accessible name). Verify a new card’s debt through the Accounts starting-balance recipe.
- **Purchase/refund:** assign Groceries $30 in an isolated scenario, create $50 categorized Card outflow. Require Groceries Available −$20 and Payment Available +$50 relative to baseline, with $20 waiting on Groceries. Create $10 refund to Groceries; require the corresponding reversal. Reload Budget and Account list to confirm.
- **Cover/payment:** cover remaining Groceries deficit via inspector, require waiting-on amount cleared. Transfer Cash to Card via Transfers, require Payment Available and debt reduce by the payment; Ready to Assign must follow Cash/card rules rather than categorizing payment as expense. Repeat with Uncategorized and split purchase paths from their maps.

## Gotchas

- **Manual drive:** at 320 px, the table row's `Assign $X` and the inspector's `Assign $X` fit without horizontal scroll; the inspector button funds the debt and keeps the `waiting on` notes.
- **Manual drive:** fund starting debt by increasing the Credit Card Payment Category’s Assigned in the Budget table; require Ready to Assign to fall and uncovered debt to shrink. When fully covered and nothing is waiting on it, its inspector's `Card payment` section reads `Available covers the card's debt.` (any `waiting on` or uncovered-debt note replaces it).
- **Manual drive:** rename the Credit Card Account and require its Credit Card Payment Category to take the same name after reload.

- Assert deltas against fixture baseline; the illustrative $30/$50 case requires neutral pre-existing amounts or explicit baseline calculations.
- Sources: ticket 10; public Accounts/Transactions/Budget operations, including `budget.assignNeeded`.
