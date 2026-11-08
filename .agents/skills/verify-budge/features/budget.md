# Budget

Give money a job by editing a Category's Assigned amount and see Ready to Assign change. Move between months without losing the saved assignment.

## Sub-features

- `budget-entry`: direct route, desktop sidebar, and mobile View menu reach Budget.
- `budget-assign`: adding $10 to Groceries lowers Ready to Assign by $10.
- `budget-persist`: reload retains Assigned and Ready to Assign.
- `budget-month`: next then previous month preserves the original month's Assigned; Ready to Assign is global.
- `budget-mobile`: 320 px entry and Assigned control remain usable without page overflow.
- `budget-negative`: assigning more than Ready to Assign shows the negative Ready to Assign warning.
- `budget-groups`: each Category Group header row totals its Categories' Assigned, Activity and Available.
- `budget-carry`: a Category's Available rolls forward into the next month.
- `budget-review-links`: the Uncategorized and Unapproved counts link into All Accounts.

## How to get to it (user POV)

- Open `/` directly after sign-in.
- From All Accounts, choose `Budget` in the desktop sidebar.
- On a phone, choose `View All Accounts`, then `Budget`.
- From Budget, the `… need a Category` and `… Unapproved` links lead to All Accounts (`/accounts`).

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the sources are `e2e/journeys/budget.ts` and `e2e/journeys/shell.ts`, also run by `bun run test:e2e:local`):

- `budget/assign`: `budget-assign`, `budget-persist`, `budget-month` in the current month.
- `shell/navigate`: `budget-entry` and `budget-mobile` (direct route, sidebar, 320 px View menu, no page overflow).

Preconditions for the manual recipes: baseline fixture and authenticated `page`; start in the current month at `/`, with the `Budget` H1 and `getByRole('textbox', { name: 'Assigned for Groceries' })`.

- **Negative warning (manual):** fill Groceries Assigned with Ready to Assign plus $1 more than its current amount and press Enter. Require `getByRole('status').filter({ hasText: 'Ready to Assign is negative' })` naming $1.00 over. Restore and require the warning gone.
- **Group totals (manual):** scope `getByRole('rowgroup').filter({ hasText: 'Credit Card Payments' })` style per group; require its header row's Assigned, Activity (desktop only) and Available to equal the sum of its Category rows. Change one Assigned and require the header total to move by the same amount.
- **Carry-forward (manual):** record Groceries Available, click `Next month`, and require next month's Available to start from that amount plus next month's Assigned and Activity.
- **Review links (manual):** on the seeded Budget, require the `Transaction(s) need a Category` and `… Unapproved` links when the fixture has such rows; click each and require the All Accounts heading. If the fixture has none, the link is absent by design: record the journey as blocked by fixture, not passed.

## Gotchas

- The month is context state and may reset on reload; the recipe edits the current month.
- Ready to Assign is global, including future assignments. Do not assert it equals only this month's income.
- Wait for reactive controls and persisted values; a changed input by itself proves only a draft.
- Targets, money moves, and Cover have their own journeys (`targets/monthly`, `inspector/move-money`) and recipes; this file's pass does not claim those paths.
- Sources: ticket 05; public `budget.month/setAssigned`.
