# UI review: budget-first UI, round 1

Use [the protocol](../../docs/quality/ui-review/README.md) and [the rubric](../../docs/quality/ui-review/rubric.md). Each judge copies the "Independent judge report" section of [the template](../../docs/quality/ui-review/report-template.md) into their own report file.

## Coordinator brief

### Spec and intended outcomes

[spec.md](spec.md), "Owner requests" 1–11. The owner should be able to:

1. Manage Categories and groups from Budget, with no Categories tab. That means add, rename, move up and down, move to a group, hide, show, and delete.
   - On desktop, right-click a row. On touch, long-press it.
   - A group also has a ⋯ button. The inspector has the same menu.
   - Hidden Categories sit under "Hidden" on Budget, each with its Available and a Show button.
2. Find the Transactions tab (formerly Accounts) in the sidebar and in the phone tab bar.
3. Not meet the copy the owner rejected. [The copy review](../../docs/quality/copy-review.md) lists every example.
4. On a laptop, not be offered "Add to home screen".
5. With no Category selected, see Upcoming in the side panel, not a "Select a Category." placeholder.
6. See Upcoming show one status: `Not funded`, only on short rows due this month. There is no Funded or No column.
7. Read Target text tersely: `$59.98, due 1st`, not "Set aside $59.98 each month, due on the 1st".
8. Select a Category by clicking anywhere on its row that is not a control. While a row menu is open, a click only closes the menu.
9. Approve a Transaction by picking a Category or a Transfer for it, from its row or its dialog. Uncategorized doesn't approve.
10. Switch tabs without a "Loading…" flash.
11. See a tighter Budget: density, and the size of Ready to Assign.

### Scope

- **In scope:** Budget (table, row menus, group ⋯ menu, inspector, Hidden, Upcoming), the Transactions tab and register, Bank, Settings (Export buttons, cutover date), and the sidebar and phone tab bar.
- **Excluded:**
  - Plaid live sync, because the local server can't reach Plaid.
  - Home-screen install on a real phone.
  - Unrelated redesign ideas. Record those as follow-ups.

### Revision

Branch `feat/budget-first-ui`, checkout `/home/lomzem/proj/budge-ui`. Review the clean commit it is at when you start, and record its SHA (`git rev-parse HEAD`).

### Features, journeys and fixtures

- **Fixture:** `budget-with-accounts`, plus `bank-sync` where a journey asks for it. All data is synthetic.
- **Journeys:**
  - `categories/manage`, `categories/touch-menu`, `categories/held-rename`, `categories/failed-rename`
  - `inspector/move-money`, `inspector/cover-and-manage`
  - `targets/monthly`
  - `shell/navigate`, `shell/phone-pages`
  - `transactions/categorize`, `transactions/select-categorize`, `transactions/approve-phone`
  - `plaid/status`, `export/files`, `budget/assign`

### Matrix

- **Viewports:** desktop 1280×800, phone 320×640 with touch, and phone 390×844.
- **Desktop keyboard:**
  - Tab and Shift+Tab through Budget.
  - Open a row menu with the keyboard (Shift+F10 or the context-menu key on a focused row, or the group ⋯ button).
  - Rename with Enter and Escape.
  - Reach Hidden → Show.
- **Touch:** long-press a row, then use the phone inspector's Previous/Next Category.
- **States:**
  - Nothing selected (Upcoming), and a long Category name.
  - A hidden group whose members are listed under Hidden.
  - Empty Upcoming: it should show nothing, not an empty-state sentence.

### Expected observable outcomes

- Every menu action persists after a reload.
- Ready to Assign changes only when money moves.
- Closing a menu never selects a row or opens the inspector.
- Tab switches between Budget, Transactions, Bank and Settings never show `Loading…` once the app has loaded.
- Picking a Category drops the row from the Unapproved count.

### Checks already completed (all on the tree committed as `dcff540`)

| Check                                                                                                                                                                         | Exit code | Result                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------ |
| `bun run check`                                                                                                                                                               | 0         | Includes 1,128 Vitest tests and the capacity contracts |
| `bun run test`                                                                                                                                                                | 0         |                                                        |
| Full live Playwright journey suite                                                                                                                                            | 0         | 64/64                                                  |
| `bun run app verify categories/manage categories/touch-menu inspector/cover-and-manage targets/monthly shell/navigate shell/phone-pages transactions/categorize plaid/status` | 0         |                                                        |
| `gitleaks git --staged --redact`                                                                                                                                              | 0         | Clean                                                  |

Sol ran a code review (14 findings) and a copy review (42 findings). [spec.md](spec.md) records the dispositions.

### Known limits

- Plaid sync and reconnect against a real bank are unverifiable here, so they're excluded.
- The seeded Bank Connection has no bank login.

### Sessions

The orchestrator couldn't create per-judge worktrees, so the judges run one at a time in the single checkout `/home/lomzem/proj/budge-ui`, as the protocol allows. Each judge starts the app, logs in, seeds, judges, runs `bun run app down`, and records release before the next judge starts. The coordinator moves each finished report out of the checkout before the next judge starts, so no judge sees another's report.

| Judge | Model and reasoning effort | Report file                                           |
| ----- | -------------------------- | ----------------------------------------------------- |
| Sol A | gpt-6.2-sol, high          | `.scratch/budget-first-ui/ui-review-round-1-sol-a.md` |
| Sol B | gpt-6.2-sol, high          | `.scratch/budget-first-ui/ui-review-round-1-sol-b.md` |
| Opus  | claude-opus-5-5            | `.scratch/budget-first-ui/ui-review-round-1-opus.md`  |

Each judge writes their report file and returns its full text.

## Results

| Judge | Score | Report                                                                                                                                                                                                                             |
| ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sol A | 7/10  | [ui-review-round-1-sol-a.md](ui-review-round-1-sol-a.md)                                                                                                                                                                           |
| Sol B | 7/10  | [ui-review-round-1-sol-b.md](ui-review-round-1-sol-b.md)                                                                                                                                                                           |
| Opus  | 7/10  | [ui-review-round-1-opus.md](ui-review-round-1-opus.md). It reviewed `0132430`; the branch moved to `e72d89e` while it ran, and all its evidence predates the move. The run then hit the Opus usage limit after writing its report. |

Round 1 doesn't pass. Every judge reviews round 2 on the same new SHA.

## Dispositions

| Finding | Severity    | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1, B1  | Major       | Kept. Saving a Transaction from its editor approves it, as any edit does; bank-change protection relies on edited Transactions being approved, and the dialog's own Approve button and Budget's Uncategorized count still surface it. The row picker's Uncategorized leaves it Unapproved. The round-1 brief wrongly said the dialog's Uncategorized doesn't approve; [GLOSSARY](../../GLOSSARY.md) "Unapproved" now states the rule, and round 2's brief uses it. |
| A2      | Major       | Fixed in `b9022af`. A tap outside a Category menu only closes it. `categories/touch-menu` fails without the fix.                                                                                                                                                                                                                                                                                                                                                   |
| A3, B4  | Minor/Major | Fixed in `b9022af`. Show moves focus to the restored Category or group. `categories/manage` fails without the fix.                                                                                                                                                                                                                                                                                                                                                 |
| A4      | Nit         | Kept. `$59.98 monthly, due 1st` is the copy guide's form; the round-1 brief's literal dropped "monthly" by mistake.                                                                                                                                                                                                                                                                                                                                                |
| A5      | Minor       | Partly fixed in `164354d`: the month stays on one line at 320 px. Phone rows stay about 85 px tall because the Assigned input keeps its 44 px touch target.                                                                                                                                                                                                                                                                                                        |
| B2      | Major       | Fixed in `96f605e`. Any pointer click while a Budget menu is open only closes it, so lifting a long press on a Category name no longer opens the inspector. `categories/touch-menu` now holds the name and fails without the fix.                                                                                                                                                                                                                                  |
| B3      | Major       | Fixed in `96f605e`. The empty group's row has a Category row's cells instead of a four-column span, which the fixed layout turned into extra columns at phone width. `categories/manage` fails without the fix.                                                                                                                                                                                                                                                    |
| B5      | Minor       | Fixed in `8eb7407`. The inspector and its phone dialog are named by the Category, not by the heading the rename field replaces. `inspector/cover-and-manage` fails without the fix.                                                                                                                                                                                                                                                                                |
| B6      | Minor       | Fixed in `e72d89e`. The consent warning reads `Consent at the bank ends {date}.`; `Sync overdue. Try Sync now.` lost its advice too, for the same reason.                                                                                                                                                                                                                                                                                                          |
| O-1     | Major       | Same defect as B2. Fixed in `96f605e`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| O-2     | Major       | Fixed in `892591a`. Hide from a Category menu moves focus to the neighbouring Category, or to its group header if it was the last one. Move to group keeps focus on the moved Category. A hidden group passes focus to the next group. Show already moved focus since `b9022af`. `categories/manage` fails on `e72d89e` at both the Move and Hide focus checks.                                                                                                    |
| O-3     | Major       | Fixed in `b9022af`, which the review didn't cover. `categories/touch-menu` now taps the Coffee name and a blank Coffee cell with Groceries' menu open, and fails on `0132430`.                                                                                                                                                                                                                                                                                     |
| O-4     | Minor       | Fixed in `81b221b`. Hidden wraps long names.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| O-5     | Nit         | Kept. Category rows stay free of a visible menu control. Right-click, long-press, Shift+F10 and the inspector's ⋯ reach the menu, and a per-row button would add a Tab stop and clutter to every row.                                                                                                                                                                                                                                                              |
| O-6     | Minor       | Fixed in `81b221b`. A met Target shows no status anywhere, only its full bar and green Available. `targets/monthly` asserts there's no "Funded".                                                                                                                                                                                                                                                                                                                   |
| O-7     | Nit         | Fixed in `81b221b`. Upcoming's date never wraps.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| O-8     | Nit         | Fixed in `81b221b`. Submenu triggers are 44 px on touch. `categories/touch-menu` measures it and fails on `e72d89e`.                                                                                                                                                                                                                                                                                                                                               |
| O-9     | Nit         | Fixed in `81b221b`. Below 640 px a submenu opens under its trigger, because at 320 px neither side of a mid-screen menu has room. It was 29 px off screen on `e72d89e`. `categories/touch-menu` requires it inside the viewport, with 44 px items, and fails on `e72d89e`.                                                                                                                                                                                         |
| O-10    | Nit         | Fixed in `81b221b`. The side panel is no longer a landmark. The Target bar reads its percentage, so a row's name says "more needed" once.                                                                                                                                                                                                                                                                                                                          |
