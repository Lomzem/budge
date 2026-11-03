# Credit Card Accounts and Payment Categories

Budget for card purchases, refunds, Overspending and payments without counting debt as Cash.

## Sub-features

- `card-start`: payment Category and uncovered starting debt.
- `card-spend`, `card-refund`, `card-cover`, `card-payment`: full-amount movement and waiting-on status.

## How to get to it (user POV)

- Add Account → Credit card; Budget → Credit Card Payments → Card inspector; Card Transaction list.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Debt:** on seeded Budget scope rowgroup Credit Card Payments; require Card and debt-not-yet-covered text. Verify a new card’s debt through the Accounts starting-balance journey.
- **Purchase/refund:** assign Groceries $30 in an isolated scenario, create $50 categorized Card outflow. Require Groceries Available −$20 and Payment Available +$50 relative to baseline, with $20 waiting on Groceries. Create $10 refund to Groceries; require the corresponding reversal. Reload Budget and Account list to confirm.
- **Cover/payment:** cover remaining Groceries deficit via inspector, require waiting-on amount cleared. Transfer Cash to Card via Transfers, require Payment Available and debt reduce by the payment; Ready to Assign must follow Cash/card rules rather than categorizing payment as expense. Repeat with Uncategorized and split purchase paths from their maps.

## Gotchas

- Assert deltas against fixture baseline; the illustrative $30/$50 case requires neutral pre-existing amounts or explicit baseline calculations.
- Sources: ticket 10; `e2e/budget.test.ts`; public Accounts/Transactions/Budget operations.
