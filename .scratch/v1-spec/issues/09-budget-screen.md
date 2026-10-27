# What does the budget screen look like on desktop and phone?

Type: prototype
Status: resolved
Blocked by: 05

## Question

What should the main budget screen (Category Groups, Categories with Assigned, Activity, Available, and Ready to Assign) and the Transaction list look like on desktop and on a phone, following the UI rules in the map's Notes?

Also, from [What is in v1 and what waits?](05-v1-scope.md): where the Upcoming list (Targets due in the next 30 days, with amount, due date, and funded or not) lives, and how Target progress ("still needed") shows on each Category.

## Answer

Variant A, "Sidebar and table", from the prototype on branch `prototype/budget-screen` (commit 87d27d0). It is the YNAB layout.

**Desktop (1024 px and wider)**: three columns.

- **Sidebar**: Budget; All Accounts, with the count of Unapproved Transactions to review; then Accounts grouped as Cash and Credit, each with its balance. Selecting an Account opens its Transaction list.
- **Budget table**: the month with previous and next controls, and Ready to Assign at the top right with the Uncategorized spending it includes. Rows are grouped by Category Group, and each group row shows its totals. Columns are Category, Assigned (edited inline), Activity, and Available. Under each Category name, a Category with a Target shows a thin progress bar and its status text: "Funded", "$25.00 more needed", or "Overspent by $38.40". Available is colored: green when funded, amber when underfunded, red when overspent.
- **Inspector column**: the selected Category's breakdown (left over from last month, Assigned, Activity, Available), its Target description, progress, and status, plus the "Assign $X" and "Cover $X from Ready to Assign" actions. The Upcoming list sits beneath it as a table with Due, Category, Amount, and Funded columns.

**Transaction list**: a table with Date, Account (in All Accounts only), Payee, Category, Memo, Amount, Cleared, and an Approve action. Unapproved rows are bold. Uncategorized is shown in amber. A search field covers Payee and memo.

**Phone (narrower than 1024 px)**: a View menu (Budget, All Accounts, each Account) replaces the sidebar. The budget table drops Activity below 640 px. Selecting a Category opens the inspector content inline under its row. The Upcoming list follows the table. The Transaction table drops columns as width shrinks, and the Category moves under the Payee.

The prototype's sample math and code are throwaway. The Implementation follows the budget rules ticket, not the prototype.

## Comments

**Prototype, 2026-10-27.** Three variants are on the throwaway branch `prototype/budget-screen` (commit 87d27d0) in `prototype/budget-screen/`. The branch is not pushed and never merges. Open `prototype/budget-screen/budget-screen.html` from that branch, or the local copy at `~/.local/share/budge-prototypes/budget-screen.html`. Switch with `?variant=A|B|C` or the floating bar.

- A, Sidebar and table: YNAB layout with an Account sidebar, a grouped table, and an inspector column for the selected Category and Upcoming.
- B, Single column: Ready to Assign, then Upcoming, then Categories with Target progress. Assigned and Activity open from each Category. Transactions are grouped by day.
- C, Split workspace: the budget table and Transactions side by side, filtered by the selected Category. Upcoming is a one-line summary that opens a table.

Waiting on the owner's pick, or a mix of parts from each.
