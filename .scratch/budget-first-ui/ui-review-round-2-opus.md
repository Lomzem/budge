# UI review round 2 — Opus judge report (pass 2c)

## Independent judge report — Opus

- **Actual model and reasoning setting; unavailable slot if applicable:** claude-opus-5-5 (Opus 5.5), high reasoning effort. The slot was available.
- **Fresh context / independence declaration:** I read the brief (`ui-review-round-2.md`), the protocol, the rubric, this template, the verify-budge skill and its feature maps, the copy review, and the source diff `2c45ac0..HEAD -- src`. I did not read any `ui-review-round-1*` file, any other judge's report, the disposition sections of `spec.md`, or any `test-results/verify-budge/` run that this session did not create (including `opus-round-2` and `opus-round-2b`). The coordinator gave me my own earlier finding IDs and one-line summaries only.
- **Reviewed SHA, clean-tree confirmation, checkout and session owner:** `b7d5afc99be86004a681d610dd0a775c3c8e8db7` on `feat/budget-first-ui`. Its code equals `c33b251`, which equals `747e86b`. `git status --short` was empty at start and after both teardowns. Checkout: `/home/lomzem/proj/budge-ui`. `.local-app/running.json` was absent at start, so this session owned the app for both sessions.
- **App readiness and authenticated fixture confirmation (sanitized):** I ran `bun run app up`, `doctor` (Vite reachable, `convex/_generated` fresh, Clerk test user available), `login`, and `seed budget-with-accounts`. The Budget `h1` and the fixture marker field `Assigned for Groceries` were visible. Evidence: `test-results/verify-budge/opus-round-2c-manual/00-readiness/` (`01-budget-ready.png`, `log.txt`). The journey run `opus-round-2c` passed 16 of 16 on commit `b7d5afc`, with `uncommittedChanges: false` (`test-results/verify-budge/opus-round-2c/summary.json`). This report contains no credentials, storage state, or environment values.

Paths below are relative to `/home/lomzem/proj/budge-ui/test-results/verify-budge/`. `M/` means `opus-round-2c-manual/`. Each manual script reseeded `budget-with-accounts` before it ran. Each desktop check reloads `/` and expands collapsed groups before it starts. The authoritative runs are `M/desktop-1280`, `M/desktop-1280-shift-tab-and-rta`, `M/phone-320`, `M/phone-390`, `M/transactions-1280`, and the `M/probe-*` directories. The `M/*-attemptN-*` directories are runs that my script defects broke (see "Principles"). They are kept for audit only and are not evidence of app behaviour.

### Tasks

| Task / entry point / journey | Fixture | Viewport and input mode | Observed outcome / persistence | Evidence path | Pass / fail / unverified |
| --- | --- | --- | --- | --- | --- |
| 16 brief journeys (`categories/*` ×4, `inspector/*` ×2, `targets/monthly`, `shell/*` ×2, `transactions/*` ×3, `plaid/status`, `plaid/consent`, `export/files`, `budget/assign`) | budget-with-accounts; bank-sync where the journey asks for it | journey defaults (desktop and phone) | 16/16 passed on `b7d5afc`, clean tree | `opus-round-2c/summary.json` and per-journey dirs | pass |
| Nothing selected: side panel has no "Select a Category." and no home-screen offer; empty Upcoming shows no heading and no sentence | budget-with-accounts | 1280×800 pointer | Side panel is blank. 0 "Upcoming" headings and 0 empty-state sentences | `M/desktop-1280/01-nothing-selected.png`, `log.txt` A1 | pass |
| Tab through Budget | budget-with-accounts | 1280×800 keyboard | Order: skip link → sidebar → month controls → Needs-you chips → Add Category Group → Add Category → each group header, its ⋯ button, then each Category name and Assigned field in reading order. After the last field, focus leaves the document (stop 53) and wraps to the skip link | `M/desktop-1280/log.txt` A2 (TAB STOPS line) | pass |
| Shift+Tab through Budget | budget-with-accounts | 1280×800 keyboard | 51 Shift+Tab stops are the exact reverse of the Tab stops | `M/desktop-1280-shift-tab-and-rta/log.txt` B1, `01-shift-tab-end.png` | pass |
| Row menu by keyboard: Shift+F10 and the ContextMenu key; Escape | budget-with-accounts | 1280×800 keyboard | Both keys open the menu with focus on "Rename". Escape closes it and returns focus to the row's name button. No inspector opens | `M/desktop-1280/02-kb-menu-open.png`, `log.txt` A3; `M/desktop-1280-shift-tab-and-rta/log.txt` B2 | pass |
| Submenu "Move to group" by keyboard; Escape | budget-with-accounts | 1280×800 keyboard | ArrowRight opens the submenu with focus on "Bills". One Escape closes both menus and focus returns to the row (see O2-8) | `M/desktop-1280/03-kb-submenu.png`, `log.txt` A4 | pass (nit O2-8) |
| Rename with Escape and Enter | budget-with-accounts | 1280×800 keyboard | Escape keeps "Coffee", with focus on the row. Enter saves "Coffee Beans", with focus on the row. The new name persists after reload | `M/desktop-1280/log.txt` A5, A21 | pass |
| Hide by keyboard (middle row and last row of a group) | budget-with-accounts | 1280×800 keyboard | Hide Dining Out → focus on Coffee Beans. Hide Transit (last) → focus on Coffee Beans | `M/desktop-1280/log.txt` A6 | pass |
| Move to group by keyboard | budget-with-accounts | 1280×800 keyboard | Groceries moves to Bills, with focus on Groceries. The move persists after reload | `M/desktop-1280/04-moved-groceries.png`, `log.txt` A7, A21 | pass |
| Group ⋯ Hide by keyboard; reach Hidden by Tab; Show | budget-with-accounts | 1280×800 keyboard | ⋯ opens with focus on "Add Category". Hide Savings Goals → focus on the Everyday header. Tab from the last field reaches the Hidden Show buttons. Show Savings Goals → focus on the Savings Goals header | `M/desktop-1280/05-group-hidden.png`, `06-hidden-by-tab.png`, `log.txt` A8 | pass |
| Show a Category whose group is collapsed | budget-with-accounts | 1280×800 keyboard | Show Transit with Everyday collapsed → Everyday expands, with focus on Transit | `M/desktop-1280/07-show-into-collapsed.png`, `log.txt` A9 | pass |
| Move to a collapsed group | budget-with-accounts | 1280×800 keyboard | The target group stays collapsed. Focus goes to the target group header ("Savings Goals 1 overspent"). The brief allows focus on the group | `M/desktop-1280/08-moved-into-collapsed.png`, `log.txt` A10 | pass |
| Hide from the inspector ⋯ menu (pointer and keyboard), including with its group collapsed | budget-with-accounts | 1280×800 pointer and keyboard | The Category hides and the inspector closes. Focus goes to `main`, not to the next Category. The next Tab goes to "Previous month" | `M/desktop-1280/09-inspector-hide-collapsed.png`, `log.txt` A11, A17; `M/probe-inspector-kb-hide-and-rapid/01-inspector-kb-hide.png`, `log.txt` P1 | fail (minor O2-7) |
| Move up / Move down by keyboard | budget-with-accounts | 1280×800 keyboard | Vacation moves up, with focus on Vacation. The order updates | `M/desktop-1280/log.txt` A11 | pass |
| A click on a Category or a blank cell while a group ⋯ menu is open | budget-with-accounts | 1280×800 pointer | The menu closes. No inspector opens and no row is selected | `M/desktop-1280/log.txt` A12 | pass |
| A right-click on another row while a row menu is open | budget-with-accounts | 1280×800 pointer | One menu, for the second row (Rename targets Transit). No inspector | `M/desktop-1280/10-second-right-click.png`, `log.txt` A13 | pass |
| Rapid open and close | budget-with-accounts | 1280×800 pointer and keyboard | One right-click/Escape or Shift+F10/Escape cycle returns focus to the row at every delay from 0 to 400 ms. Repeated cycles return focus whenever ≥100 ms passes between Escape and the next Shift+F10 | `M/probe-escape-timing/log.txt`, `M/probe-escape-repeat/log.txt` | pass (see observations) |
| A right-click in an Assigned field (O2-3) | budget-with-accounts | 1280×800 pointer | No row menu. Typing sets 111.00, which persists after reload | `M/desktop-1280/log.txt` A15, A21 | pass |
| Delete… dialog, then Escape | budget-with-accounts | 1280×800 keyboard | The dialog reads "Delete Phone / Its Transactions and Assigned amounts move to the Category you pick, permanently." Escape returns focus to Phone | `M/desktop-1280/11-delete-dialog.png`, `log.txt` A16 | pass |
| Long Category name (62 characters) in the table, the inspector, and Hidden | budget-with-accounts | 1280×800 pointer | The name wraps at word boundaries in all three places. No overflow | `M/desktop-1280/12-long-name-row.png`, `13-long-name-inspector.png`, `14-long-name-hidden.png` | pass |
| Target text and Upcoming status | budget-with-accounts | 1280×800 pointer | The inspector shows "$900.00 monthly, due 25th" and "$400.00 more needed". Upcoming shows "Nov 25 · Emergency Fund · Not funded · $900.00" on one line each. After the Target is fully funded, Upcoming shows the row with no status, and the inspector and the row show no "Funded" | `M/desktop-1280/15-target-dialog.png`, `16-target-inspector.png`, `17-upcoming-item.png`, `18-target-met-inspector.png`, `log.txt` A18 | pass |
| A click outside the table while a row menu is open (Add Category button, sidebar Settings link) | budget-with-accounts | 1280×800 pointer | The menu closes. No Add Category dialog opens and no navigation happens (path stays `/`) | `M/desktop-1280/19-click-add-with-menu.png`, `log.txt` A19 | pass |
| Tab switches Budget ↔ Transactions ↔ Bank ↔ Settings; Settings content | budget-with-accounts | 1280×800 pointer | A MutationObserver saw no "Loading…" across 7 switches. Settings has no home-screen text; it shows Cutover date, Theme, Export (Download CSV / JSON), and Sign out | `M/desktop-1280/20-after-tab-switches.png`, `21-settings.png`, `log.txt` A20 | pass |
| Ready to Assign changes only when money moves | budget-with-accounts | 1280×800 keyboard | $15,120.02 stays the same after rename, move to group, hide, show, move down, and reload. Assigning Transit 100.00 → 125.00 makes it $15,095.02 | `M/desktop-1280-shift-tab-and-rta/02-rta-after-assign.png`, `log.txt` B3 | pass |
| Every menu action persists after a reload | budget-with-accounts | 1280×800; 320 and 390 touch | Desktop: Groceries in Bills, Coffee Beans, Gifts hidden, and Transit 111.00 persist. Phone: Bus and Train, Empty Group, Bills hidden, and Groceries 400.00 persist | `M/desktop-1280/22-after-reload.png`, `log.txt` A21; `M/phone-320/log.txt`, `M/phone-390/log.txt` "Reload persists" | pass |
| Transactions: Uncategorized in the row keeps it Unapproved; a Category in the row or in the dialog approves it | budget-with-accounts | 1280×800 pointer | Uncategorized keeps the badge at "3 Unapproved". Groceries drops it to 2. Coffee from the dialog drops it to 1, which persists after reload | `M/transactions-1280/01..05-*.png`, `log.txt` | pass |
| Long-press a Category name (O-1); menu position and item height | budget-with-accounts | 320×640 and 390×844 touch | The menu opens and no dialog opens. The menu is inside the viewport (320: x 102–278). All 6 items are 44 px. Page overflow is 0 | `M/phone-320/01-hold-groceries-menu.png`, `M/phone-390/01-*.png`, `log.txt` | pass |
| Move to group submenu at 320 and 390 (O-8, O-9) | budget-with-accounts | 320×640 and 390×844 touch | The submenu is on screen (320: x 103–231, y 464–562). Items are 44 px | `M/phone-320/02-submenu.png`, `M/phone-390/02-submenu.png` | pass |
| A tap outside an open row menu, on another row's name or blank cell (O-3) | budget-with-accounts | 320×640 and 390×844 touch | The menu closes. No menu and no dialog after the tap. The tap point was checked with `elementFromPoint` to be outside the open menu | `M/phone-320/log.txt`, `M/phone-390/log.txt` | pass |
| Long-press a blank part of a row; long-press another row while a menu is open; rapid hold/close ×5 | budget-with-accounts | 320×640 and 390×844 touch | The row menu opens. The second hold opens that row's menu (Rename targets it). No dialog. 0 menus are left after the rapid cycles | `M/phone-320/03-hold-row-blank.png`, `04-hold-second-row.png`; same in `M/phone-390/` | pass |
| A tap and a hold in an Assigned field (O2-1) | budget-with-accounts | 320×640 and 390×844 touch | The tap edits the field (400.00 saved). A hold opens no row menu | `M/phone-320/log.txt`, `M/phone-390/log.txt` | pass |
| A tap on a Category while a group ⋯ menu is open (O2-2) | budget-with-accounts | 320×640 and 390×844 touch | The menu closes and no dialog opens. ⋯ items are 44 px and inside the viewport | `M/phone-320/05-group-menu.png`, `M/phone-390/05-group-menu.png` | pass |
| Phone inspector Previous/Next Category; Escape | budget-with-accounts | 320×640 and 390×844 touch | Next opens Transit and Previous returns to Coffee. Escape closes, with focus on Coffee | `M/phone-320/06-inspector-coffee.png`, `log.txt` | pass |
| Rename from the inspector | budget-with-accounts | 320×640 and 390×844 touch | "Bus and Train" is saved. The dialog title updates. Focus goes to "Bus and Train actions" and returns to the row on close | `M/phone-320/07-inspector-renamed.png`, `M/phone-390/07-*.png` | pass |
| Empty Category Group | budget-with-accounts | 320×640 and 390×844 touch | "Empty Group" shows "No Categories yet." Overflow is 0 | `M/phone-320/08-empty-group.png`, `M/phone-390/08-*.png` | pass |
| Hidden group with its members; long hidden name (O2-4) | budget-with-accounts | 320×640 and 390×844 touch | Hidden lists Bills with Rent, Utilities, Phone and Internet, each with Available. The 62-character name wraps at word boundaries on its own line above its amount and Show. Show is 44 px high. Overflow is 0 | `M/phone-320/10-hidden-section.png`, `11-hidden-long-name.png`; same in `M/phone-390/` | pass |
| Show from Hidden with its group collapsed (touch) | budget-with-accounts | 320×640 and 390×844 touch | The group expands and focus goes to the shown Category | `M/phone-320/log.txt`, `M/phone-390/log.txt` | pass |
| Empty Upcoming on phone | budget-with-accounts | 320×640 and 390×844 touch | No Upcoming section and no empty-state sentence. Overflow is 0 | `M/phone-320/12-bottom-of-budget.png`, `M/phone-390/12-*.png` | pass |
| ARIA landmarks and names | budget-with-accounts | all | No `complementary` landmark in any authoritative snapshot. Regions are named (Needs you, Categories, Hidden, Upcoming, Target, Move money). The Target bar is `progressbar "<Category> Target"` with a value of 0–100 | `M/desktop-1280/*.aria.yml`, `M/phone-*/*.aria.yml` | pass |
| Plaid live sync and reconnect; home-screen install on a real phone | — | — | Excluded by the brief | — | unverified (excluded) |

### Earlier findings: re-check

| ID | Earlier finding | Status at `b7d5afc` | Evidence |
| --- | --- | --- | --- |
| O-1 | A touch hold opened the menu and the inspector | Resolved. A hold opens the menu only | `M/phone-320/01-hold-groceries-menu.png`, `M/phone-390/01-*.png` |
| O-2 | Focus fell to body after Hide, Move, group Hide and Show | Resolved for the table row menu, the group ⋯ menu and Hidden → Show: focus lands on the neighbour, the moved Category, the next group, or the shown item. The inspector ⋯ Hide path lands on `main` (not body), filed separately as O2-7 | `M/desktop-1280/log.txt` A6–A9 |
| O-3 | A tap with a menu open moved focus or acted | Resolved. The menu closes only | `M/phone-*/log.txt` O-3 lines |
| O-4 | Hidden used an ellipsis | Resolved. The heading is "Hidden" | `M/desktop-1280/14-long-name-hidden.png` |
| O-5 (Kept) | No visible per-row menu affordance | Unchanged. Rows still have no ⋯ button. Visible routes exist: the group ⋯ button, and the inspector ⋯ button after a click on the row. I don't reopen it and I don't count it as a finding | `M/desktop-1280/01-nothing-selected.png` |
| O-6 | "· Funded" | Resolved. A fully funded Target shows no status in the inspector, the row or Upcoming | `M/desktop-1280/18-target-met-inspector.png`, `log.txt` A18 |
| O-7 | The Upcoming date wrapped | Resolved. "Nov 25" is one line box | `M/desktop-1280/17-upcoming-item.png`, `log.txt` A18 `upLines` |
| O-8 | The submenu trigger was 32 px | Resolved. 44 px | `M/phone-320/log.txt` |
| O-9 | The submenu started at x = −1 at 320 px | Resolved. x = 103 | `M/phone-320/02-submenu.png` |
| O-10 | Empty complementary landmark; "more needed" repeated | Resolved. No complementary landmark. "$400.00 more needed" appears once per surface. The bar has a name | `M/desktop-1280/16-target-inspector.aria.yml` |
| O2-1 | A tap on an Assigned field opened the row menu | Resolved | `M/phone-*/log.txt` O2-1, O2-1b |
| O2-2 | A click with the group ⋯ menu open selected a Category | Resolved on desktop and touch | `M/desktop-1280/log.txt` A12; `M/phone-*/log.txt` O2-2 |
| O2-3 | A right-click in a field opened the row menu | Resolved | `M/desktop-1280/log.txt` A15 |
| O2-4 | A long hidden name broke mid-word at 320 px | Resolved | `M/phone-320/11-hidden-long-name.png` |
| O2-5 | An unnamed sidebar complementary landmark | Resolved. None exists | `M/desktop-1280/*.aria.yml` |
| O2-6 | Show on a hidden Category in a collapsed group left it collapsed and focus on body | Resolved on keyboard and touch | `M/desktop-1280/07-show-into-collapsed.png`, `log.txt` A9; `M/phone-*/log.txt` |

### New findings

| Finding ID | Severity | Task and reproduction | Expected vs observed / user impact | Evidence |
| --- | --- | --- | --- | --- |
| O2-7 | minor | 1280×800, keyboard. Seed `budget-with-accounts`. Tab to "Gifts" and press Enter (the inspector opens). Tab to "Gifts actions" and press Enter. Arrow to "Hide" and press Enter. Then press Tab. The same result occurs with the pointer and when the group is collapsed. | Expected (brief: "Hiding a Category … from the keyboard leaves focus in Budget: on the next Category or group"): focus on the next Category, as Hide from the row menu does. Observed: the inspector closes and focus goes to the `main` region. The next Tab goes to "Previous month", so a keyboard user must Tab about 40 stops to get back to the table. The fallback is the effect at `src/routes/(app)/+page.svelte:309-318`, which focuses `mainRegion()` when the selected Category disappears. | `M/probe-inspector-kb-hide-and-rapid/01-inspector-kb-hide.png`, `log.txt` P1; `M/desktop-1280/09-inspector-hide-collapsed.png`, `log.txt` A11, A17 |
| O2-8 | nit | 1280×800, keyboard. Focus Groceries, press Shift+F10, arrow to "Move to group", press ArrowRight (the submenu opens with focus on "Bills"), then press Escape. | The WAI-ARIA menu pattern expects Escape in a submenu to close only the submenu and return focus to "Move to group". Observed: one Escape closes both menus and focus returns to the row. Focus is not lost, so the impact is one extra Shift+F10. I did not test ArrowLeft. | `M/desktop-1280/03-kb-submenu.png`, `log.txt` A4 (`menusAfterFirstEscape: 0`) |
| O2-9 | nit (not user-facing) | Read `.agents/skills/verify-budge/features/budget.md:51`. | It still says "At `lg` and up, the side panel says `Select a Category.` until a Category is open." This contradicts spec outcome 5 and the observed UI (A1). AGENTS.md requires updating the feature map when a feature changes. The next verifier would expect a removed placeholder. It does not affect the score. | `M/desktop-1280/01-nothing-selected.png` |

Observations that are not findings:

- **Repeated Shift+F10/Escape.** Focus fell to BODY only when the next Shift+F10 came 0 ms after Escape (3/3 trials at 2, 3 and 8 cycles). With a 100 ms or 250 ms gap, focus returned to the row in every trial. A single cycle returned focus at every delay from 0 to 400 ms. This is machine speed only (`M/probe-escape-repeat/log.txt`, `M/probe-escape-timing/log.txt`).
- **Follow-up, outside this diff.** On the phone, Next or Previous Category in the inspector moves focus into "Assigned this month". On a real device that can raise the on-screen keyboard. `stepTo` is identical at `2c45ac0`, so this branch did not introduce it.
- At 320 px the "Move to group" submenu covers the lower items of the parent menu. Both stay on screen and usable (`M/phone-320/02-submenu.png`).

### Rubric

| Rubric dimension | Score /10 or unverified | Observation supporting judgment |
| --- | --- | --- |
| Task completion and trust | 9 | Every brief task works and persists after reload. Ready to Assign moves only when money moves. Approval rules match the glossary. "Not funded" appears only on short rows due this month. 16/16 journeys pass. |
| Discoverability and language | 9 | Copy is terse ("$900.00 monthly, due 25th", "Not funded", "No Categories yet."). The Transactions tab is in the sidebar and the phone tab bar. There is no home-screen offer on desktop. The only gap is O-5 (Kept): no visible per-row ⋯. The group ⋯ and inspector ⋯ give a visible route. |
| Efficiency and control | 9 | Right-click, Shift+F10, the ContextMenu key, long-press, group ⋯ and inspector ⋯ all reach the same actions. A click or tap with a menu open only closes it, inside or outside the table. |
| Feedback and recovery | 9 | Escape backs out of every menu, rename and dialog with focus returned. The Delete… dialog states the consequence. Show expands a collapsed group. O2-7 is the one recovery path that drops the keyboard user's place. |
| Accessibility and input | 9 | Tab and Shift+Tab are symmetric. Focus is managed after each table action. Regions are named, with no stray landmarks. The Target bar is named. Touch targets are 44 px. O2-7 (minor) and O2-8 (nit) remain. |
| Responsive layout and visual clarity | 9 | 0 px horizontal overflow at 320 and 390. Menus and submenus stay on screen. Long names wrap at word boundaries in the table, the inspector and Hidden. The Upcoming date stays on one line. The tighter density reads well at 1280. |

- **Overall score /10 and rationale:** 9/10. All required tasks are clear, efficient and trustworthy at 1280×800 (pointer and keyboard), 320×640 (touch) and 390×844 (touch). All 16 earlier findings are resolved, except O-5, which stays Kept and which I accept. What remains is one localized minor focus gap with a reliable workaround (O2-7) and two nits (O2-8, O2-9). This matches the rubric's "only justified minor findings or nits remain". Coverage is complete, so the score is not provisional.
- **Unverified tasks/external behavior and blockers:** Plaid live sync and reconnect, and home-screen install on a real phone, are excluded by the brief. Touch input was emulated through Chrome DevTools Protocol touch events with `hasTouch`/`isMobile`; I used no physical device. ArrowLeft in the submenu was not tested. No blockers.
- **Verdict:** approve. I recommend fixing O2-7 and updating the feature map (O2-9) before merge.
- **Cleanup result, ownership release, evidence retained after teardown:**
  - Session 1: `bun run app down` printed "app: down." with exit 0.
  - Session 2 (a short re-launch for Shift+Tab, the ContextMenu key and Ready to Assign: `up`, `doctor`, `login`, `seed`): `bun run app down` printed "app: down."
  - After each teardown: `.local-app/running.json` was absent, `http://127.0.0.1:5173/` did not respond, no browser process remained, `git status --short` was empty, and HEAD was `b7d5afc`. Ownership is released.
  - Evidence retained: `test-results/verify-budge/opus-round-2c/` has 215 files (413 MB). Its 5 empty files are export CSVs for tables with no rows, which is expected. `test-results/verify-budge/opus-round-2c-manual/` has 591 files (27 MB), with 0 empty.
  - Scripts used, outside the repository: `/tmp/claude-1000/-home-lomzem-proj-budge/a8a00cb3-49fd-408a-a3bc-5e654771150d/scratchpad/s/` (`lib.mjs`, `common.mjs`, `d2.mjs`, `p7.mjs`, `phone.mjs`, `t1280.mjs`, `probe1`–`probe6`).

### Principles that changed a choice

- **prove-it-works:**
  - I treated each scripted failure as a suspect observation method until a screenshot and ARIA snapshot proved app behaviour. This turned up eight script defects that would otherwise have read as app failures:
    - lingering closed menus;
    - menu autofocus overriding `.focus()`;
    - arrow navigation skipping disabled "Move up";
    - group ⋯ triggers also carrying `aria-expanded=false`;
    - collapsed group buttons gaining "1 overspent" in their name;
    - `<th>` row headers not matching `[role=rowheader]`;
    - an open menu covering the tap target, so taps hit "Hide" and "Add Category";
    - zsh not splitting the script arguments.
  - Those runs are kept as `M/*-attempt*` and no finding comes from them.
  - I measured the Escape timing before filing a focus-loss finding, and found it was machine speed only.
  - I brought the app back up rather than infer Shift+Tab and Ready to Assign from other checks.
- **guard-the-context-window:** The scripts logged one line per check and wrote screenshots and ARIA to disk. I opened only the failing or decisive screenshots, instead of reading whole snapshots or journey output into context.
