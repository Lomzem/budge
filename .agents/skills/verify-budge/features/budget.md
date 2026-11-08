# Budget

Give money a job by editing a Category's Assigned amount and see Ready to Assign change. Move between months without losing the saved assignment.

## Sub-features

- `budget-entry`: direct route, desktop sidebar, and the phone tab bar reach Budget.
- `budget-assign`: adding $10 to Groceries lowers Ready to Assign by $10.
- `budget-persist`: reload retains Assigned and Ready to Assign.
- `budget-month`: next then previous month preserves the original month's Assigned; Ready to Assign is global.
- `budget-mobile`: below `sm` the table shows Category and Available only (one row per Category with its status, Target bar and card notes under the name); Assigned is edited in the Category's inspector dialog (`Assigned this month`), and nothing overflows at 320 px. Ready to Assign is a full-width row with its label on the left and the amount (never wrapped) on the right, and any Uncategorized note on its own reserved line beneath, and `Needs you` is a fixed-height strip of chips that scrolls sideways instead of wrapping; from `sm` the chips wrap onto more lines instead.
- `budget-negative`: assigning more than Ready to Assign shows the negative Ready to Assign warning.
- `budget-groups`: each Category Group header row totals its shown and Hidden Categories' Assigned, Activity and Available.
- `budget-carry`: a Category's Available rolls forward into the next month.
- `budget-review-links`: the `Needs you` chips: `N Uncategorized`, `N Unapproved` and `N bank changes` link into the Accounts page already filtered (the last to Status `Bank changes`); `N Categories overspent` opens the first overspent Category's inspector. The Budget waits for every count before it paints, so chips never arrive one at a time; a strip that overflows fades at the clipped edge.

## How to get to it (user POV)

- Open `/` directly after sign-in.
- Choose `Budget` in the desktop sidebar or the phone tab bar.
- Below `sm` the month is an h2 between `Previous month` and `Next month`, and `Edit Categories` is an icon button at the end of that row whose menu offers `Add Category Group` and `Add Category` (only when a group can take a Category; Credit Card Payments never can).
- From Budget, the `Needs you` region's `… Uncategorized` and `… Unapproved` links lead to `/accounts?category=uncategorized` and `/accounts?status=unapproved`; the `… overspent` chip is a button that opens the inspector.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the sources are `e2e/journeys/budget.ts` and `e2e/journeys/shell.ts`, also run by `bun run test:e2e:local`):

- `budget/assign`: `budget-assign`, `budget-persist`, `budget-month` in the current month, and ArrowDown/ArrowUp move between Assigned fields (saving a changed amount first; an invalid one keeps focus).
- `budget/needs-you`: `budget-review-links`: the Uncategorized and Unapproved chips land on a filtered register, and the overspent chip opens the first overspent Category; each further click steps to the next one, scrolling its row into view. `Needs you` lists the over-assigned and overspent chips first, then the Bank chip (red when a connection needs a reconnect or failed), then the register chips.
- See also `shell/navigate` in [shell.md](shell.md): `budget-entry` and phone navigation/overflow only; phone Assigned editing needs a manual drive.

Preconditions for the manual recipes: baseline fixture and authenticated `page`; start in the current month at `/`, with the `Budget` H1 and `getByRole('textbox', { name: 'Assigned for Groceries' })`.

- **Negative warning (manual):** fill Groceries Assigned with Ready to Assign plus $1 more than its current amount and press Enter. Require `getByRole('status').filter({ hasText: 'Ready to Assign is negative' })` naming $1.00 over. Restore and require the warning gone.
- **Group totals (manual):** scope `getByRole('rowgroup').filter({ hasText: 'Credit Card Payments' })` style per group; require its header row's Assigned, Activity (desktop only) and Available to equal the sum of all its Categories, including Hidden Categories outside the table. Change one Assigned and require the header total to move by the same amount.
- **Carry-forward (manual):** record Groceries Available, click `Next month`, and require next month's Available to start from that amount plus next month's Assigned and Activity.
- **Review links (manual):** on the seeded Budget, require the `N Uncategorized` and `… Unapproved` links when the fixture has such rows; click each and require the `Accounts` heading with the Category filter at `Uncategorized` (or Status at `Unapproved`) and only matching rows. When a shown Category is overspent, click `N Categories overspent` and require the `Category inspector` region for the first one. If the fixture has none, the link is absent by design: record the journey as blocked by fixture, not passed.

## Gotchas

- **Manual drive:** at 320 px open Groceries and edit `Assigned this month` in its inspector dialog (at `sm` and up, `Assigned for Groceries` in the table); blur and Enter each save, Escape puts back the saved amount, sums such as `100+20` save their total, and invalid text keeps the draft and shows alert `Enter an amount, such as 120.00 or 100+20. Escape puts back the saved amount.` in a popover below the field without changing the saved amount. At `lg` and up, the side panel says `Select a Category to see its Target, move money or cover overspending here.` until a Category is open. On a phone, `Edit Categories` is a menu of Add Group, Add Category and Manage Categories. Reload to prove persistence.
- **Manual drive:** navigate back to the cutover month and require `Previous month` disabled. With suitable Transactions and hidden Categories, verify `includes … Uncategorized` under `Ready to Assign`, and `Hidden Categories` with Available amounts; a negative hidden amount is red with the screen-reader label `Overspent`. An overspent visible Category shows in `Needs you` and in its own row, not in a separate list. The hidden list has no Category-opening buttons.

- The viewed month is in the URL as `?month=YYYY-MM` (dropped for the current month), so reload, Back and a shared link keep it. The recipe edits the current month.
- Ready to Assign is global, including future assignments. Do not assert it equals only this month's income.
- Wait for reactive controls and persisted values; a changed input by itself proves only a draft.
- See also `targets/monthly` in [targets.md](targets.md) and `inspector/move-money` in [inspector.md](inspector.md); these are cross-references, not Budget journey coverage.
- Sources: ticket 05; public `budget.month/setAssigned`.
