# 05: Budget screen

**What to build:** I open the budget screen and see my Category Groups and Categories for a month, with Assigned (edited inline), Activity, and Available, and with Ready to Assign at the top. I can move between months, assign to any month, and categorize Transactions, including to Ready to Assign. Overspending carries forward. Ready to Assign is global and warns me when it is negative. Uncategorized Transactions count as Ready to Assign, and the screen shows how many there are.

**Blocked by:** 03 (Manual Accounts and Transactions)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 13, 18–31, 55–57; Domain module (budget rules); Convex function surface (budget query)

- [ ] Test-first in the pure domain module: one budget entry point takes the month, `today`, the cutover date, Categories, Assigned rows, and monthly totals. It returns each Category's Assigned, Activity, and Available, group totals, Ready to Assign with its Uncategorized amount, the Uncategorized count, and the overspent Categories. Its cases include the following:
  - Available = prior Available + Assigned + Activity, with negatives carried forward.
  - Ready to Assign is the same in every month, and future Assigned reduces it right away.
  - Future-dated income counts only once its date arrives.
  - A refund to a normal Category adds to that Category.
  - Uncategorized counts exactly as Ready to Assign.
  - The cash invariant holds across generated edit sequences. This ticket covers Cash Accounts only; Credit Card Accounts come in ticket 10.
- [ ] Tables `categoryGroups`, `categories`, and `assignments`. Ready to Assign is a system Category in a hidden system group. Setting Assigned to 0 deletes the row. Transactions gain an optional Category.
- [ ] The budget query takes `month` and `today` as arguments. It reads only `categories`, `categoryGroups`, `assignments`, `monthlyTotals`, and `settings`, plus the Ready to Assign and Uncategorized inflows dated after `today` through the Category-by-date index.
- [ ] Minimal Category and Category Group creation, enough to budget. Full management is ticket 06.
- [ ] Budget table: month previous and next controls, Ready to Assign at the top right with the Uncategorized amount it includes, group rows with totals, and inline Assigned. Available is colored green, amber, or red, always with text as well. Overspent Categories are shown at the top, the negative Ready to Assign warning sits above the table, and the Uncategorized count is shown. Below 640 px the table drops Activity.
- [ ] A `BudgetMonth` context class holds the selected month, its query, and Ready to Assign.
- [ ] The Transaction list gains a Category column, with Uncategorized shown in amber plus text.
- [ ] The seed gains about 12 Categories in 3 groups and some Assigned rows.
- [ ] `convex-test`: a sequence of Transactions and Assigned edits across past and future months gives the expected budget query result.
- [ ] A Playwright smoke test edits an Assigned amount inline and sees Ready to Assign change.
