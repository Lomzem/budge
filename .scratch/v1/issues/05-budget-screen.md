# 05: Budget screen

**What to build:** I open the budget screen and see my Category Groups and Categories for a month, with Assigned (edited inline), Activity, and Available, and with Ready to Assign at the top. I can move between months, assign to any month, and categorize Transactions, including to Ready to Assign. Overspending carries forward. Ready to Assign is global and warns me when it is negative. Uncategorized Transactions count as Ready to Assign, and the screen shows how many there are.

**Blocked by:** 03 (Manual Accounts and Transactions)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 13, 18–31, 55–57; Domain module (budget rules); Convex function surface (budget query)

- [x] Test-first in the pure domain module: one budget entry point takes the month, `today`, the cutover date, Categories, Assigned rows, and monthly totals. It returns each Category's Assigned, Activity, and Available, group totals, Ready to Assign with its Uncategorized amount, the Uncategorized count, and the overspent Categories. Its cases include the following:
  - Available = prior Available + Assigned + Activity, with negatives carried forward.
  - Ready to Assign is the same in every month, and future Assigned reduces it right away.
  - Future-dated income counts only once its date arrives.
  - A refund to a normal Category adds to that Category.
  - Uncategorized counts exactly as Ready to Assign.
  - The cash invariant holds across generated edit sequences. This ticket covers Cash Accounts only; Credit Card Accounts come in ticket 10.
- [x] Tables `categoryGroups`, `categories`, and `assignments`. Ready to Assign is a system Category in a hidden system group. Setting Assigned to 0 deletes the row. Transactions gain an optional Category.
- [x] The budget query takes `month` and `today` as arguments. It reads only `categories`, `categoryGroups`, `assignments`, `monthlyTotals`, and `settings`, plus the Ready to Assign and Uncategorized inflows dated after `today` through the Category-by-date index.
- [x] Minimal Category and Category Group creation, enough to budget. Full management is ticket 06.
- [x] Budget table: month previous and next controls, Ready to Assign at the top right with the Uncategorized amount it includes, group rows with totals, and inline Assigned. Available is colored green, amber, or red, always with text as well. Overspent Categories are shown at the top, the negative Ready to Assign warning sits above the table, and the Uncategorized count is shown. Below 640 px the table drops Activity.
- [x] A `BudgetMonth` context class holds the selected month, its query, and Ready to Assign.
- [x] The Transaction list gains a Category column, with Uncategorized shown in amber plus text.
- [x] The seed gains about 12 Categories in 3 groups and some Assigned rows.
- [x] `convex-test`: a sequence of Transactions and Assigned edits across past and future months gives the expected budget query result.
- [x] A Playwright smoke test edits an Assigned amount inline and sees Ready to Assign change.

## Comments

- Implemented on branch `05-budget-screen`.
- Decisions:
  - `computeBudget` in `src/lib/domain/budget.ts` is the one entry point. Available with nothing in it shows no status. `underfunded` (amber) needs Targets and arrives in ticket 08.
  - `monthlyTotals` buckets by Category (or `uncategorized`) and gained a `count`, so the budget query reports the Uncategorized count without reading Transactions. Rows are deleted when their count reaches 0. A deployment whose old rows lack `count` fails schema validation on push. Production isn't live and previews start empty, but a local dev backend holding old data has to be cleared.
  - Ready to Assign is created on first need: setting the cutover date, adding a Cash Account, adding a Category Group, and in the seed. A Cash Account's starting balance goes to Ready to Assign. A Credit Card Account's stays Uncategorized until ticket 10.
  - `setAssigned` refuses Ready to Assign, months before the cutover month, and non-`YYYY-MM` months.
  - The budget screen passes the owner's local `today`. It refreshes every minute and on window focus, so income dated today counts after midnight.
  - The query reads every future-dated Ready to Assign and Uncategorized Transaction, including outflows. The Category-by-date index can't exclude outflows without a stored sign field, and future-dated outflows in those buckets are few.
  - New index names (`by_group_position`, `by_month_category`, `by_category_date`) follow the repo's existing short style (`by_account_date`), not the guideline's full field names, to keep the schema consistent.
  - Green (`--funded`) and amber (`--warning`) theme tokens meet 4.5:1 on the background and muted colors in both themes. Every colored amount has its status in words beside it.
- Verification: `bun run typecheck`, `lint`, `lint:ui`, `format:check`, and `bun run test` (110 tests) pass. The Playwright smoke tests (3, including `e2e/budget.test.ts`) passed against a throwaway anonymous local backend seeded with `seed:run`. Screenshots at 1280 px (light) and 375 px (dark) were checked by eye.
- Review (GPT-6.1-Sol, standards and spec): fixed a duplicated accumulator, unclear names in the seed and the budget test, a stale `today` after midnight, and the cash invariant checking only the final state (it now checks after every edit). The index-name and future-outflow findings were kept as described above. The seeded random generator is duplicated between `budget.test.ts` and `monthlyTotals.test.ts`, which run in different Vitest projects. It's left as is.
- Shipped in https://github.com/Lomzem/budge/pull/4, squash-merged to `main` as fcded0c. CodeRabbit approved head 3f1a348, and all six checks passed. CodeRabbit raised 7 findings over four review rounds: 6 fixed (Previous disabled while a month loads; the midnight timer and the Add Category dialog reset moved out of component effects; then three follow-ups on the dialog's pending save: no duplicate submit after reopening, no trapping the modal while a save is pending, and no switching kind mid-save), and 1 declined with a reason it accepted (staging `monthlyTotals.count`, since production has no `monthlyTotals` rows).
- Follow-up: production has one Transaction but no `monthlyTotals` rows, so its cached totals are stale. Running `monthlyTotals:rebuild` on production once fixes that; it needs the owner's go-ahead.
