# UI review: budget-first UI, round 2

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
7. Read Target text tersely: `$59.98 monthly, due 1st`, not "Set aside $59.98 each month, due on the 1st".
8. Select a Category by clicking anywhere on its row that is not a control. While a row menu is open, a click only closes the menu.
9. Approve a Transaction by picking a Category or a Transfer for it, from its row or its dialog. Picking Uncategorized in its row leaves it Unapproved. Saving it from its editor approves it, as any edit does ([GLOSSARY](../../GLOSSARY.md), "Unapproved").
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
  - `shell/navigate`, `shell/cold-start`, `shell/failed-query`, `shell/phone-pages`
  - `imports/approve`
  - `transactions/categorize`, `transactions/select-categorize`, `transactions/approve-phone`
  - `plaid/status`, `plaid/consent`, `export/files`, `budget/assign`

### Matrix

- **Viewports:** desktop 1280×800, phone 320×640 with touch, and phone 390×844.
- **Desktop keyboard:**
  - Tab and Shift+Tab through Budget.
  - Open a row menu with the keyboard (Shift+F10 or the context-menu key on a focused row, or the group ⋯ button).
  - Rename with Enter and Escape.
  - Reach Hidden → Show.
- **Touch:** long-press a row and a Category name, tap outside the open menu, then use the phone inspector's Previous/Next Category.
- **States:**
  - Nothing selected (Upcoming), and a long Category name.
  - A hidden group whose members are listed under Hidden.
  - Empty Upcoming: it should show nothing, not an empty-state sentence.
  - An empty Category Group at 320 and 390 px.
  - Renaming a Category from the inspector.

### Expected observable outcomes

- Every menu action persists after a reload.
- Ready to Assign changes only when money moves.
- Closing a menu, whether a row menu or a group's ⋯ menu, never selects a row or opens the inspector.
- A tap or right-click in an Assigned field edits that field and opens no row menu.
- Tab switches between Budget, Transactions, Bank and Settings never show `Loading…` once the app has loaded. Before the shared data loads, the main region shows one `Loading…` beside the sidebar, and no Section opens on its own `Loading…`.
- Import file opened from an Account opens on the File field.
- Picking a Category drops the row from the Unapproved count.
- Showing a hidden Category or group from the keyboard leaves focus on it, and showing a Category opens its group if it was collapsed.
- Hiding a Category or group, or moving a Category to another group, from the keyboard leaves focus in Budget: on the next Category or group, or on the moved Category.
- Deleting a Category from the inspector or from its row menu leaves focus on the Category beside it: the next one in its group, else the previous one, else its group.
- On a 320 px phone a row menu and its "Move to group" submenu stay on screen, with 44 px items.
- At 320 px a long hidden name wraps at word boundaries on its own line.
- An Escape while the inspector's Delete or Target dialog is open closes only that dialog; the inspector and an unsaved Move money amount stay.
- In a ⋯ menu, End pressed right after Enter focuses the last item, and focus stays on the item the keyboard reached while the menu is open.
- While a row menu or ⋯ menu is open, a click, tap or right-click anywhere outside it only closes it. Nothing under the press changes, and no row is selected. This holds over a dialog too: on a phone, Move, Clear, Close, Previous and Next in the inspector dialog do nothing until the menu is closed.
- If one of the shared queries (Settings, the counts, Categories, Payees) fails, the app shows `Budge couldn't reach its server.` with the server's message, as it does for a failed owner check or Accounts query. No Section opens with part of its data.
- Deleting a group that has one Category speaks of one Category: `Its Category moves to the group you pick, with its history.`

### Checks already completed (on `a64f414`, the dev-branch commit with this branch's code)

| Check                                             | Exit code | Result                                                     |
| ------------------------------------------------- | --------- | ---------------------------------------------------------- |
| `bun run check`                                   | 0         | Includes lint, lint:ui, typecheck and 1,145 Vitest tests   |
| Full live journey suite with `bun run app verify` | 0         | 66/66 in run `r2-a64f414`, clean tree                      |
| `gitleaks` on each commit's staged changes        | 0         | Clean                                                      |

A judge re-checking round 1 gets their own findings and dispositions in their task. Read no `ui-review-round-1*` file and no other judge's report or evidence.

### Known limits

- Plaid sync and reconnect against a real bank are unverifiable here, so they're excluded.
- The seeded Bank Connection has no bank login.

### Sessions

The judges run one at a time in the single checkout `/home/lomzem/proj/budge-ui`, as the protocol allows. Each judge starts the app, logs in, seeds, judges, runs `bun run app down`, and records release before the next judge starts. The coordinator moves each finished report out of the checkout before the next judge starts, so no judge sees another's report.

| Judge | Model and reasoning effort | Report file                                           |
| ----- | -------------------------- | ----------------------------------------------------- |
| Opus  | claude-opus-5-5, high      | `.scratch/budget-first-ui/ui-review-round-2-opus.md`  |
| Sol A | gpt-6.2-sol, xhigh         | `.scratch/budget-first-ui/ui-review-round-2-sol-a.md` |
| Sol B | gpt-6.2-sol, xhigh         | `.scratch/budget-first-ui/ui-review-round-2-sol-b.md` |

Each judge writes their report file and returns its full text.
