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

Branch `feat/budget-first-ui`. Review the clean commit your worktree starts at, and record its SHA (`git rev-parse HEAD`).

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

| Check                                                                                                                                          | Exit code | Result                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------ |
| `bun run check`                                                                                                                                | 0         | Includes 1,128 Vitest tests and the capacity contracts |
| `bun run test`                                                                                                                                 | 0         |                                                        |
| Full live Playwright journey suite                                                                                                             | 0         | 64/64                                                  |
| `bun run app verify categories/manage categories/touch-menu inspector/cover-and-manage targets/monthly shell/navigate shell/phone-pages transactions/categorize plaid/status` | 0         |                                                        |
| `gitleaks git --staged --redact`                                                                                                               | 0         | Clean                                                  |

Sol ran a code review (14 findings) and a copy review (42 findings). [spec.md](spec.md) records the dispositions.

### Known limits

- Plaid sync and reconnect against a real bank are unverifiable here, so they're excluded.
- The seeded Bank Connection has no bank login.

### Sessions

Each judge has its own worktree at the pinned commit, created by the orchestrator, and owns that checkout's app, login, seed, and evidence. Run your judging in parallel with the others.

| Judge | Model and reasoning effort | Report file                                            |
| ----- | -------------------------- | ------------------------------------------------------ |
| Sol A | gpt-6.2-sol, high          | `.scratch/budget-first-ui/ui-review-round-1-sol-a.md` |
| Sol B | gpt-6.2-sol, high          | `.scratch/budget-first-ui/ui-review-round-1-sol-b.md` |
| Opus  | claude-opus-5-5            | `.scratch/budget-first-ui/ui-review-round-1-opus.md`  |

Each judge writes the report file in their own worktree and returns its full text.
