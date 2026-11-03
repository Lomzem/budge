# Budget

Give money a job by editing a Category's Assigned amount and see Ready to Assign change. Move between months without losing the saved assignment.

## Sub-features

- `budget-entry`: direct route, desktop sidebar, and mobile View menu reach Budget.
- `budget-assign`: adding $10 to Groceries lowers Ready to Assign by $10.
- `budget-persist`: reload retains Assigned and Ready to Assign.
- `budget-month`: next then previous month preserves the original month's Assigned; Ready to Assign is global.
- `budget-mobile`: 320 px entry and Assigned control remain usable without page overflow.

## How to get to it (user POV)

- Open `/` directly after sign-in.
- From All Accounts, choose `Budget` in the desktop sidebar.
- On a phone, choose `View All Accounts`, then `Budget`.

## Driving it with Playwright

Preconditions:

- Baseline fixture and authenticated `page`; start in the current month.
- Run `.agents/skills/verify-budge/features/prove-budget.sh .local-app/storage-state.json` for this entire recipe and retained evidence.

- **Entry:** `await page.goto('/')`; require the `Budget` H1 and `getByRole('textbox', { name: 'Assigned for Groceries' })`.
- **Assign:** record that textbox's amount and `getByTestId('ready-to-assign')` in cents. Fill Assigned with the previous amount plus 10 dollars, capture the draft, then `press('Enter')`. Require Assigned +1000 cents and Ready to Assign −1000 cents. Capture saved state.
- **Persist:** `await page.reload()`; require both changed amounts again.
- **Month:** click `getByRole('button', { name: 'Next month', exact: true })`; wait for the month label to change and Ready to Assign to remain the changed amount. Click `Previous month`; require the original month and changed assignment.
- **Sidebar:** `await page.goto('/accounts')`; choose `getByRole('navigation', { name: 'Budget and Accounts' }).getByRole('link', { name: 'Budget', exact: true })`; require the Budget heading and saved assignment.
- **Phone:** set 320×640, navigate `/accounts`, click `getByRole('button', { name: 'View All Accounts', exact: true })`, then `getByRole('menuitem', { name: 'Budget', exact: true })`. Require Budget and the saved Assigned value; assert `document.documentElement.scrollWidth <= window.innerWidth` and capture.
- **Restore:** fill the original Assigned amount, press Enter, and assert original Ready to Assign. Retain evidence before teardown.

## Gotchas

- The month is context state and may reset on reload; the recipe edits the current month.
- Ready to Assign is global, including future assignments. Do not assert it equals only this month's income.
- Wait for reactive controls and persisted values; a changed input by itself proves only a draft.
- Targets, money moves, and Cover have separate recipes in `e2e/targets.test.ts` and `e2e/inspector.test.ts`; this file's pass does not claim those paths.
