# UI review: budget-first UI, round 1, judge Opus

Uses [the protocol](../../docs/quality/ui-review/README.md), [the rubric](../../docs/quality/ui-review/rubric.md) and [the brief](ui-review-round-1.md). Evidence paths are relative to `/home/lomzem/proj/budge-ui`. `M/` is short for `test-results/verify-budge/opus-round-1-manual/`, and `J/` is short for `test-results/verify-budge/opus-round-1/`. Each `M/` folder has a `notes.txt` log and numbered PNG screenshots, each with an `.aria.yml` ARIA snapshot. The scripts in `M/scripts/` can be rerun.

## Independent judge report — Opus

- **Model and reasoning:** `claude-opus-5-5` (Opus 5.5), with adaptive extended thinking.
- **Independence:**
  - I worked from a fresh context and did not read `ui-review-round-1-sol-a.md` or `ui-review-round-1-sol-b.md`. Both files appeared untracked in the checkout near the end of my session, and I did not open them.
  - I did not read any other judge's run under `test-results/verify-budge/`, the disposition sections of `spec.md`, or the uncommitted diff of `ui-review-round-1.md`. That diff appeared during my session, and I didn't make it.
  - After all my evidence was collected, I saw only the subject lines of six commits that were fast-forwarded into the checkout (see the next bullet). I didn't read their diffs, and none of my findings came from them.
- **Reviewed SHA and clean tree:**
  - I reviewed `013243017f86f4f27fe7b5ed5932aeecfaed0218` on `feat/budget-first-ui` in `/home/lomzem/proj/budge-ui`.
  - At the start, `git status --short` was empty and `.local-app/running.json` was absent, so there was no ownership conflict.
  - `J/summary.json` records commit `0132430` with `uncommittedChanges: false`.
  - **The tree changed during my session.** The reflog shows `HEAD@{08:30:29}: merge feat/budget-first-ui-r1: Fast-forward`, which moved HEAD to `e72d89e`.
  - Every evidence file I cite was written by 07:08:20, before that move, so all of it covers `0132430`. I checked this against file times (`ls -l` on every `notes.txt` and `J/summary.json`).
  - I did not judge `e72d89e`.
- **Readiness (sanitized):**
  - `bun run app up` passed, as did `bun run app doctor` (credential presence only, no values printed).
  - Then I ran `bun run app login` and `bun run app seed budget-with-accounts`.
  - The Budget heading and the fixture's sample data rendered. Evidence: `M/00-ready/notes.txt`.
  - I reseeded before every script that changes data, so state from one check could not affect another.

### Tasks

| Task / entry point / journey | Fixture | Viewport and input mode | Observed outcome / persistence | Evidence path | Pass / fail / unverified |
| --- | --- | --- | --- | --- | --- |
| `categories/manage` | budget-with-accounts | journey default | Passed (`--run opus-round-1`, exit 0) | `J/categories/manage/` | Pass |
| `categories/touch-menu` | budget-with-accounts | phone, touch | Passed | `J/categories/touch-menu/` | Pass |
| `categories/held-rename` | budget-with-accounts | journey default | Passed | `J/categories/held-rename/` | Pass |
| `categories/failed-rename` | budget-with-accounts | journey default | Passed | `J/categories/failed-rename/` | Pass |
| `inspector/move-money` | budget-with-accounts | journey default | Passed | `J/inspector/move-money/` | Pass |
| `inspector/cover-and-manage` | budget-with-accounts | journey default | Passed | `J/inspector/cover-and-manage/` | Pass |
| `targets/monthly` | budget-with-accounts | journey default | Passed | `J/targets/monthly/` | Pass |
| `shell/navigate` | budget-with-accounts | journey default | Passed | `J/shell/navigate/` | Pass |
| `shell/phone-pages` | budget-with-accounts | phone | Passed | `J/shell/phone-pages/` | Pass |
| `transactions/categorize` | budget-with-accounts | journey default | Passed | `J/transactions/categorize/` | Pass |
| `transactions/select-categorize` | budget-with-accounts | journey default | Passed | `J/transactions/select-categorize/` | Pass |
| `transactions/approve-phone` | budget-with-accounts | phone, touch | Passed | `J/transactions/approve-phone/` | Pass |
| `plaid/status` | per journey (bank-sync) | journey default | Passed | `J/plaid/status/` | Pass |
| `export/files` | budget-with-accounts | journey default | Passed. Five CSVs for empty tables are 0 bytes, which matches the empty data. | `J/export/files/` | Pass |
| `budget/assign` | budget-with-accounts | journey default | Passed | `J/budget/assign/` | Pass |
| Request 1: right-click a row → menu (Rename / Move up / Move down / Move to group / Hide / Delete…) | budget-with-accounts | 1280×800, pointer | Menu opens. Right-clicking Coffee while Groceries' menu is open retargets the menu to Coffee, and Rename acts on Coffee. | `M/10-desktop/02-shiftf10-menu.png`, `08-rightclick-b-while-a.png`, `notes.txt` | Pass |
| Request 1: long-press a row → menu | budget-with-accounts | 320×640 and 390×844, touch | A hold on a non-control spot opens the menu with no dialog. **A hold on the Category name also opens the inspector (O-1).** | `M/20-phone320/02-longpress-menu.png`, `M/21-longpress-name/` | Fail (O-1) |
| Request 1: group ⋯ menu (Add Category / Rename / Move up / Move down / Hide / Delete…) | budget-with-accounts | 1280×800 keyboard; 320/390 touch | Enter opens it, and Escape returns focus to ⋯. ⋯ is 24×24 on desktop and 44×44 on phone. Long-press on a group row opens the group menu without toggling the group. | `M/10-desktop/05-group-menu.png`; `M/20-phone320/notes.txt`; `M/30-phone390/notes.txt` | Pass |
| Request 1: Rename with Enter and Escape | budget-with-accounts | 1280×800, keyboard | Enter saves and keeps focus on the renamed button. Escape keeps the old name and returns focus. The name persists after a reload. | `M/10-desktop/04-rename-draft.png`, `07-after-reload.png` | Pass |
| Request 1: Move up / Move down | budget-with-accounts | 1280×800, keyboard | Order changes, and focus stays on the moved row. | `M/11-desktop-focus/notes.txt` | Pass |
| Request 1: Move to group | budget-with-accounts | 1280×800 keyboard; 320 touch | ArrowRight enters the submenu. On touch, the submenu lists Bills / Savings Goals. Coffee lands under Savings Goals and stays there after a reload. **Focus goes to `<body>` (O-2).** At 320, the submenu sits at x = −1 (O-9). | `M/10-desktop/03-submenu-keyboard.png`; `M/26-phone-isolated/01-phone320-submenu.png`, `02-fail-phone320-Move.aria.yml` lines 97–128, `notes.txt` | Pass (action); focus fails (O-2) |
| Request 1: Hide → Hidden shows the Category with Available and Show; Show restores it | budget-with-accounts | 1280×800 keyboard; 320/390 touch | Hidden lists "Transit, Available $25.00, Show". Show is 65×44 on phone. Hidden state persists after a reload. **Focus goes to `<body>` after Hide and after Show (O-2).** | `M/10-desktop/06-hidden-section.png`; `M/20-phone320/05-hidden.png`; `M/11-desktop-focus/notes.txt` lines 45–56 | Pass (action); focus fails (O-2) |
| Request 1 and matrix: a hidden group lists its members under Hidden | budget-with-accounts | 1280×800 | Hiding Savings Goals lists its members with their Available amounts. | `M/10-desktop/notes.txt` | Pass |
| Request 1: Delete… dialog, then Escape | budget-with-accounts | 1280×800 | Opened from the keyboard, Escape returns focus to the name. Opened by right-click, focus falls back to `#main`. Delete itself is proven by `categories/manage`. | `M/10-desktop/11-delete-dialog.png`; `M/11-desktop-focus/notes.txt` line 58 | Pass |
| Request 1: the inspector has the same menu | budget-with-accounts | 1280×800; 320 | The inspector's ⋯ has the same actions. Hide from the inspector moves focus to `#main`. | `M/10-desktop/10-inspector-coffee.png` | Pass |
| Request 2: Transactions tab in the sidebar and the phone tab bar | budget-with-accounts | 1280; 320/390 | Sidebar: Budget / Transactions (3) / Bank / Settings. Tab bar: "Budget, Transactions 3 Unapproved, Bank, Settings". No Categories tab. | `M/10-desktop/01-start.png`; `M/20-phone320/notes.txt` | Pass |
| Request 3: rejected copy absent | budget-with-accounts | all | No "Select a Category.", no empty-state sentence, and terse Target and Bank copy. **The inspector Target shows "Funded" (O-6).** | `M/10-desktop/notes.txt` line 1; `M/12-upcoming/notes.txt` line 3 | Fail (O-6, minor) |
| Request 4: no "Add to home screen" on a laptop | budget-with-accounts | 1280×800 | Absent from all pages (also absent at 320 and 390). | `M/10-desktop/notes.txt` line 1; `M/20-phone320/notes.txt` | Pass |
| Request 5: nothing selected → Upcoming in the side panel | budget-with-accounts | 1280×800 | Upcoming shows in the side panel, with no placeholder. With no Targets the panel is empty but still exposes an unnamed `complementary` landmark (O-10). | `M/12-upcoming/01-empty-upcoming.png`, `.aria.yml` line 192 | Pass |
| Request 6: `Not funded` only on short rows due this month | budget-with-accounts plus a Target I set | 1280×800; 320 | A short Target due the 18th (today) shows "Not funded", including after a reload and at 320. One due Dec 1 shows no marker. "Funded" appears nowhere on Budget. | `M/13-not-funded/04-upcoming-not-funded.png`, `05-upcoming-phone320.png`, `notes.txt` lines 5–10; `M/12-upcoming/notes.txt` | Pass |
| Request 7: terse Target text | budget-with-accounts | 1280×800 | Shows `$59.98 monthly, due 18th`. That is terse and follows the copy review's example rather than the brief's shorter `$59.98, due 1st`. | `M/13-not-funded/notes.txt` line 3 | Pass |
| Request 8 and expected outcome: a click anywhere not on a control selects; with a menu open, a click only closes it | budget-with-accounts | 1280×800 pointer | A click on another row's cell, name or Assigned field while a menu is open closes the menu only. No inspector opens. Rapid right-click and Escape across 8 rows left no stray state. | `M/10-desktop/09-after-rapid.png`, `notes.txt`; `M/23-tap-while-menu/notes.txt` (last line) | Pass |
| Request 8 and expected outcome on touch | budget-with-accounts | 320/390 touch | **A tap on another row (name or blank cell) neither closes the menu nor selects (O-3).** A tap on the page heading closes it. **A long-press on a name selects as well as opening the menu (O-1).** | `M/23-tap-while-menu/`, `M/24-tap-close-timing/`, `M/25-which-menu/` | Fail (O-1, O-3) |
| Request 9: a Category pick approves; Uncategorized does not | budget-with-accounts | 1280×800 pointer; phone via journey | Picking Uncategorized left the badge at "3 Unapproved". Picking Coffee dropped it to "2 Unapproved". Row and dialog paths are covered by the `transactions/*` journeys. | `M/26-phone-isolated/notes.txt`, `04-desktop-picker-open.png`, `05-desktop-after-pick.png` | Pass |
| Request 10: no "Loading…" on tab switches | budget-with-accounts | 1280×800; 320/390 touch | A MutationObserver saw no "Loading…" across Transactions → Bank → Settings → Budget → Transactions → Budget. | `M/10-desktop/notes.txt` lines 59–60; `M/26-phone-isolated/notes.txt`; `M/30-phone390/notes.txt` | Pass |
| Request 11: a tighter Budget, and the size of Ready to Assign | budget-with-accounts | 1280×800; 320 | Rows are about 49 px. Ready to Assign is prominent at the top right without dominating. The credit-card row's helper lines make it the one tall row. | `M/10-desktop/01-start.png`; `M/20-phone320/01-start.png` | Pass (judgement) |
| Matrix: Tab and Shift+Tab through Budget; focus visible | budget-with-accounts | 1280×800 keyboard | 41 Tab stops in a logical order, with a 2 px solid green outline. I didn't record a separate Shift+Tab walk on `0132430` (see Unverified). | `M/11-desktop-focus/notes.txt`, `01-tab-40.png` | Pass (Tab); Shift+Tab unverified |
| Matrix: Shift+F10 or the ContextMenu key on a row | budget-with-accounts | 1280×800 keyboard | Both open the row menu. Escape returns focus to the name button. In the submenu, the first Escape closes everything and returns focus. | `M/10-desktop/notes.txt` | Pass |
| Matrix: phone inspector Previous/Next Category | budget-with-accounts | 320/390 touch | Next is 117×43 at 320 and 152×43 at 390, labelled "Next Category: Dining Out". Previous from Groceries goes to Internet. Close returns focus to the row. | `M/20-phone320/03-inspector-dialog.png`, `04-inspector-prev.png`; `M/30-phone390/notes.txt` | Pass |
| Matrix: long Category name | budget-with-accounts | 1280; 320/390 | The table and inspector wrap with 0 px horizontal overflow. **Hidden truncates the name with no way to read it in full (O-4).** | `M/10-desktop/12-long-name-table.png`, `14-long-name-hidden.png`; `M/20-phone320/07-long-name.png` | Pass, with O-4 |
| Matrix: empty Upcoming shows nothing | budget-with-accounts | 1280; 320 | No heading or sentence is shown. | `M/12-upcoming/01-empty-upcoming.png` | Pass |
| Expected outcome: Ready to Assign changes only when money moves | budget-with-accounts | journey default | `budget/assign` and `inspector/move-money` assert the money moves. While driving menu actions by hand, the focus logs show Ready to Assign at the same $15,1… value, but I did not record a dedicated before-and-after comparison on `0132430`. | `J/budget/assign/`, `J/inspector/move-money/`; `M/10-desktop/notes.txt` line 35 | Unverified (manual; journeys pass) |
| Expected outcome: menu actions persist after a reload | budget-with-accounts | 1280; 320 | Rename, Hide, Show, Move down and Move to group persist. | `M/10-desktop/07-after-reload.png`; `M/26-phone-isolated/notes.txt` | Pass |
| Phone layout at 320 and 390 | budget-with-accounts | 320×640, 390×844 | 0 px overflow throughout. Upcoming sits below the table. Phone menu items are 44 px, except Move to group at 32 px (O-8). | `M/20-phone320/notes.txt`, `M/30-phone390/notes.txt` | Pass |

### Findings

| Finding ID | Severity | Task and reproduction | Expected vs observed / user impact | Evidence |
| --- | --- | --- | --- | --- |
| O-1 | Major | **Long-press on a Category name.** At 320×640 or 390×844 with touch, seed `budget-with-accounts`, then hold the "Groceries" name button for 800 ms or 1200 ms and release. | **Expected:** only the row menu opens, as with a hold on a non-control spot of the row. **Observed:** the row menu opens and the inspector dialog opens beneath it, with the menu drawn over the inspector. The event log shows the bits-ui long-press timer opening the menu with no `contextmenu` event, and then `click(touch)` reaching the name button on release. That click selects the row without the open-menu guard. On a phone the name button covers most of the row, so it is where people naturally hold. This breaks request 8 and the expected outcome "Closing a menu never selects a row or opens the inspector", and the user is left with two stacked layers to dismiss. **Caveat:** this is CDP touch emulation (the same harness as `categories/touch-menu`); I could not test a real device. | `M/21-longpress-name/01-phone320-name-800.png`, `05-phone390-name-800.png`, `notes.txt`; `M/22-longpress-events/notes.txt`; script `M/scripts/21-longpress-name.ts` |
| O-2 | Major | **Focus is lost after several menu actions.** At 1280×800 with the keyboard: focus Transit's name, press Shift+F10, then choose Hide. Also: under Hidden, Tab to "Show Transit" and press Enter. Also: Shift+F10 on Coffee → Move to group → Savings Goals. Also: Bills ⋯ → Hide, then Show from Hidden. Check `document.activeElement` after 1.5 s. Repeat Show and Move to group by touch at 320. | **Expected:** focus moves to a sensible nearby element, as the inspector's Hide does (it moves focus to `#main`). **Observed:** focus is on `<body>` in all five cases, and the next Tab resumes from wherever Chromium guesses. A keyboard or screen-reader user loses their place after a routine action, which fails WCAG 2.4.3 Focus Order (the rubric's "dialog focus disappears" class). | `M/11-desktop-focus/notes.txt` lines 45, 48, 53, 55, 56; `M/10-desktop/notes.txt` lines 21, 24, 28; `M/20-phone320/notes.txt` and `M/30-phone390/notes.txt` ("focus after Show"); `M/26-phone-isolated/notes.txt` ("after move") |
| O-3 | Major | **A tap on another row doesn't close the menu.** At 320 or 390 with touch, hold the blank right edge of the Groceries row for 900 ms to open its menu. Then tap the Coffee name, or a blank cell in the Coffee row, with a 0 ms or 90 ms tap. | **Expected:** the tap only closes the menu (request 8), as a mouse click does on desktop. **Observed:** Groceries' menu stays open, at the same position, even after a second tap 1.5 s later. Focus moves behind the modal menu to the tapped "Coffee" button, while Rename in the still-open menu edits Groceries. Only a tap outside the table, such as on the page heading, closes it, and on a phone the table fills most of the screen. No inspector opens, so no wrong row is selected, but the menu seems to ignore the user. | `M/23-tap-while-menu/notes.txt`; `M/24-tap-close-timing/notes.txt`; `M/25-which-menu/notes.txt`, `02-02-after-tap-coffee.png` |
| O-4 | Minor | **Hidden truncates long names.** Rename a Category to "Annual professional association membership dues and conference registration", then hide it. | **Expected:** the name can be read, as it can in the table, which wraps. **Observed:** Hidden cuts it off with an ellipsis and offers no tooltip or wrapping, so a sighted user can't tell similar long names apart before choosing Show. The accessible name is complete. | `M/10-desktop/14-long-name-hidden.png` |
| O-5 | Nit | **Category rows have no visible menu affordance.** Look at a Category row and its ARIA snapshot. | Groups get ⋯, but Category rows have no visible control or `aria-haspopup`. The menu is reachable by right-click, long-press, Shift+F10 or the inspector, which matches the brief's design. Recorded only because new users have to discover it. | `M/10-desktop/01-start.png`, `01-start.aria.yml` |
| O-6 | Minor | **"Funded" in the inspector.** Set a Monthly Target on a Category that is fully funded, then open its inspector. | **Expected (copy review rule 4):** show only the status that matters when something is wrong, never its all-clear twin. **Observed:** the inspector's Target block reads "$59.98 monthly, due 18th · Funded". Budget and Upcoming correctly omit it. | `M/12-upcoming/notes.txt` line 3; `M/13-not-funded/notes.txt` line 3 |
| O-7 | Nit | **The Upcoming date wraps.** Create a Target due this month and view Upcoming in the 1280-wide side panel. | "Nov 18" breaks onto two lines in its fixed-width (`w-12`) date column. | `M/13-not-funded/04-upcoming-not-funded.png` |
| O-8 | Nit | **"Move to group" is shorter on phone.** Long-press a row at 320. | Every phone menu item is 44 px tall except "Move to group", which is 32 px. That is above the 24 px minimum but inconsistent. | `M/20-phone320/notes.txt` line 3 |
| O-9 | Nit | **The submenu edge is off screen at 320.** Long-press Coffee, then tap Move to group. | The submenu's item box starts at x = −1, so its left edge is clipped by 1 px. | `M/26-phone-isolated/01-phone320-submenu.png`, `notes.txt` |
| O-10 | Nit | **Accessibility-tree noise.** Check the desktop ARIA snapshot with no Targets set, and the Vacation row with a short Target. | An empty, unnamed `complementary` landmark remains when Upcoming is empty. The Vacation row's accessible name repeats "$100.00 more needed" twice. | `M/12-upcoming/01-empty-upcoming.aria.yml` line 192; `M/14-row-tint/01-after-escape.aria.yml` lines 171–175 |

### Scores

| Rubric dimension | Score /10 or unverified | Observation supporting judgment |
| --- | --- | --- |
| Task completion and trust | 8 | All 15 journeys pass, and every menu action I drove persists after a reload. Category picks approve and Uncategorized does not. On touch, O-1 stacks the menu over the inspector, so the user can't tell which layer they are acting in. |
| Discoverability and language | 8 | No Categories tab is needed, and the copy is terse. The Bank copy names the next action. Deductions: "Funded" in the inspector (O-6), and Category menus have no visible affordance (O-5). |
| Efficiency and control | 8 | Shift+F10 menus, Enter/Escape rename, submenus, and rapid open and close are all clean on desktop. On touch, a menu that ignores taps on other rows (O-3) adds extra steps. |
| Feedback and recovery | 8 | No "Loading…" flash. Empty Upcoming stays silent, `Not funded` appears exactly where specified, and the `failed-rename` journey passes. |
| Accessibility and input | 6 | Strengths: a logical Tab order, a visible focus ring, keyboard menus whose Escape returns focus, and 44 px phone targets. But focus drops to `<body>` after five routine actions (O-2), and both touch problems (O-1, O-3) break the menu contract in one of the two required input modes. |
| Responsive layout and visual clarity | 8 | No overflow at 320 or 390, long names wrap in the table and the inspector, and the hierarchy is clear. Hidden truncates names (O-4), and there is minor polish: the date wrap, the 1 px submenu clip and the empty landmark (O-7, O-9, O-10). |

- **Overall score: 7/10.**
  - The redesign works on desktop: managing Categories from Budget is fast, and the keyboard menus are well built. The owner's copy and Upcoming requests are met.
  - It is not at 9, because three reproducible majors remain:
    - O-2 loses keyboard focus after common actions.
    - O-1 and O-3 break the rule that closing or opening a row menu never selects a row, and that a tap or click only closes the menu, for touch, a required input mode.
  - By the rubric, a reproducible major can't be outweighed by strengths elsewhere.
- **Unverified tasks, external behavior and blockers:**
  - Real-device touch: O-1 and O-3 were reproduced with CDP touch emulation only.
  - A dedicated before-and-after check that Ready to Assign stays the same during menu actions on `0132430`. The journeys cover money moves.
  - A recorded Shift+Tab walk on `0132430`.
  - Plaid live sync and installing to a real phone's home screen, both excluded by the brief.
  - I wrote a script for the Ready to Assign and Shift+Tab checks (`M/scripts/27-rta-shifttab.ts`), but the app had already stopped by then. When I restarted it, HEAD was `e72d89e`, so I didn't run the script against that revision and deleted its empty output folder.
- **Verdict: changes required** (O-1, O-2 and O-3 are major).
- **Cleanup:**
  - The browser contexts in my scripts close in `finally`.
  - The app stopped without my action: `vite.log` ends at 07:08:15. I restarted it at about 08:31 for the extra check above, found the new HEAD, and then ran `bun run app down`, which printed "app: down." `.local-app/running.json` is absent afterwards.
  - The two Playwright Chromium processes still running belong to another session's `app verify` in `/home/lomzem/proj/budge-ui-r1`, a separate checkout. I left them alone.
  - Evidence kept: 196 files under `J/` and 208 under `M/`. The only empty files are the five 0-byte CSVs for empty tables in `J/export/files/downloads/`, which the passing export journey expects.
  - I didn't edit any tracked file. This report is my only write outside `test-results/`.

### Principles that changed a choice

- **`prove-it-works`:**
  - My first combined 320 run showed "1 open" after a tap, and I nearly reported it as "a tap opens the inspector". Instead I isolated it in fresh contexts with event logs (`M/23`–`M/25`). That changed O-3 to what actually happens: the menu stays open and nothing is selected.
  - I tested a hold on a non-control spot as a control for O-1, and I recorded the emulation caveat rather than claiming device behavior.
  - When HEAD turned out to have moved, I dated every evidence file against the reflog (not commit author dates) before relying on it. I also declined to fill gaps using the app at `e72d89e`, and marked those gaps unverified.
- **`guard-the-context-window`:**
  - I kept checks as rerunnable scripts that write to `notes.txt`, and read the notes with `grep` and `cut` rather than whole files.
  - I read only the journey and feature lines I needed.
  - I left the other judges' reports and the brief's uncommitted diff unread. That also protected my independence.
