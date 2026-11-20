# UI review — budget-first UI, round 2, Opus re-check

Brief: [ui-review-round-2.md](ui-review-round-2.md). Protocol: [README](../../docs/quality/ui-review/README.md). Rubric: [rubric](../../docs/quality/ui-review/rubric.md).

## Independent judge report — Opus

- **Actual model and reasoning setting:** claude-opus-5-5 (Opus 5.5). This is a re-check of my own round-2 findings O2-7, O2-8 and O2-9.
- **Fresh context / independence declaration:** I started this session in a fresh context. I did not read any `ui-review-round-1*` file, any other judge's report, any `test-results/verify-budge/` run that this session did not create, or the disposition sections of `spec.md`. The coordinator's task message gave me my own findings and their dispositions.
- **Reviewed SHA, clean-tree confirmation, checkout and session owner:**
  - `git rev-parse HEAD` returned `9b1012b979aaecea66d6efbeff0023767b600754` on `feat/budget-first-ui` in `/home/lomzem/proj/budge-ui`.
  - `git status --short` was empty before the session and after it.
  - `.local-app/running.json` did not exist before `up`. This session owned the checkout from `up` to `down`.
  - `git diff --quiet 3f70cab 9b1012b -- src e2e convex` exited 0, so the code is identical to `3f70cab`, where the brief's checks ran.
  - Commit note (no UI impact): the task message names `2903219`, `4578e5a` and `08ff85e`. Those objects exist, but they are not ancestors of `HEAD`. They are the pre-rebase forms of `9316a42`, `efd75db` and `0db8941`, which have the same subjects. `6e8e541` and `5505d72` are on the branch as named.
- **App readiness and authenticated fixture confirmation (sanitized):**
  - `bun run app up` reported the app up at `http://127.0.0.1:5173`.
  - `doctor` printed all `ok` lines and exited 0.
  - `login` exited 0. The storage-state path stays private.
  - `seed budget-with-accounts` exited 0.
  - At 1280×800, the `Budget` H1 and `textbox "Assigned for Groceries"` were visible (`00-readiness/01-budget-ready.png`).
  - Before each manual script I reseeded the fixture it needed: `budget-with-accounts`, or `bank-sync` for the Bank copy check.

Evidence roots (all files are non-empty after teardown):

- Journeys: `/home/lomzem/proj/budge-ui/test-results/verify-budge/opus-round-2-recheck/` (115 files, `summary.json` result `passed`, commit `9b1012b…`, `uncommittedChanges: false`)
- Manual: `/home/lomzem/proj/budge-ui/test-results/verify-budge/opus-round-2-recheck-manual/` (128 files). Each subfolder has a `log.txt` with PASS/FAIL lines plus screenshots and ARIA snapshots. The re-runnable scripts are in `scripts/`.

Below, `M/` means `test-results/verify-budge/opus-round-2-recheck-manual/` and `J/` means `test-results/verify-budge/opus-round-2-recheck/`.

### Journeys

`bun run app verify categories/manage categories/touch-menu inspector/move-money inspector/cover-and-manage transactions/categorize plaid/status plaid/attention plaid/consent --run opus-round-2-recheck` exited 0. All 8 journeys passed in one run. No journey stalled at sign-in, so I needed no rerun.

| Journey | Steps | Result |
| --- | --- | --- |
| categories/manage | 8 | pass |
| categories/touch-menu | 7 | pass |
| inspector/move-money | 15 | pass |
| inspector/cover-and-manage | 10 | pass |
| transactions/categorize | 4 | pass |
| plaid/status | 2 | pass |
| plaid/attention | 4 | pass |
| plaid/consent | 3 | pass |

### Exercised tasks

| Task / entry point / journey | Fixture | Viewport and input mode | Observed outcome / persistence | Evidence path | Pass / fail / unverified |
| --- | --- | --- | --- | --- | --- |
| O2-7: Hide from the inspector ⋯ menu by keyboard (Enter on ⋯, Enter on Hide) | budget-with-accounts | 1280×800; keyboard | Hiding Groceries put focus on `Dining Out` (the next Category), and Tab went to `Assigned for Dining Out`. Hiding Transit (last) put focus on `Coffee` (the previous one). Hiding Dining Out put focus on `Coffee`. Hiding Coffee (the only one left) put focus on the `Everyday` group, and Tab went to `Everyday actions`. After a reload, all four were under Hidden. | `M/01-desktop-inspector/log.txt`, `…/09-after-hides.png`, `…/12-after-reload.png` | pass |
| O2-7 on a phone: Hide from the inspector dialog's ⋯ menu | budget-with-accounts | 320×640; touch | The dialog closed, and focus went to `Dining Out`. | `M/03b-phone-inspector-rerun/log.txt`, `…/08-after-hide.png` | pass |
| O2-8: Move to group submenu, then Escape | budget-with-accounts | 1280×800; keyboard (Shift+F10, ArrowRight) | One Escape still closes both menus. Focus returns to the `Groceries` name in the row menu and to `Groceries actions` in the inspector menu. ArrowLeft closes only the submenu and focuses `Move to group`. | `M/04-row-menus/log.txt`, `…/02-submenu-open.png`, `…/03-after-submenu-escape.png` | behavior unchanged; disposition accepted |
| O2-9: feature map for the empty side panel | — | file read; 1280×800 | `features/budget.md` says "At `lg` and up, the side panel shows `Upcoming` until a Category is open". At 1280 px with nothing selected, the seeded app shows no `Select a Category.` text. Upcoming is empty in this fixture, so the panel shows nothing, as the brief expects. | `.agents/skills/verify-budge/features/budget.md` (Gotchas), `M/00-readiness/01-budget-ready.png` | pass |
| Inspector ⋯ keyboard movement: Enter, then End at once, Home, ArrowDown | budget-with-accounts | 1280×800; keyboard | Enter focused `Rename`, End focused `Delete…`, Home focused `Rename`, and ArrowDown focused `Move down` (Move up is disabled). Focus was still on `Move down` 400 ms later. | `M/01b-desktop-inspector-rerun/log.txt` | pass |
| Inspector ⋯ dismissal with an unsaved Move money amount (12.34) | budget-with-accounts | 1280×800; keyboard and pointer | Escape, a click on a blank area, and clicks on the `Coffee` name, `Next month` and `Assigned for Coffee` each only closed the menu. Focus returned to `Groceries actions`. The inspector stayed on Groceries, the month did not change, and the amount stayed 12.34. | `M/01b-desktop-inspector-rerun/log.txt`, `…/03-after-pointer-dismissals.png` | pass |
| Inspector Delete dialog: real Escape key, pressed quickly and after it settled, with an unsaved amount | budget-with-accounts | 1280×800 and 320×640 touch | Each time, only Delete closed. The inspector (side panel or dialog) and the amount (12.34 or 7.00) stayed, and focus returned to `Groceries actions`. | `M/01b-…/log.txt`, `…/04-delete-dialog-settled.png`; `M/03b-…/log.txt`, `…/04-phone-delete-dialog.png` | pass |
| Inspector Target dialog: Escape pressed quickly and after it settled | budget-with-accounts | 1280×800 and 320×640 touch | Only Target closed. The inspector and the amount stayed, and focus returned to `Add Target`. | `M/01b-…/05-target-dialog-settled.png`; `M/03b-…/05-phone-target-dialog.png` | pass |
| Phone inspector dialog with its ⋯ menu open and a started move (From Coffee, To Groceries, 7.00): a tap and a click on Move, Clear, Close, Previous, Next, Swap and Amount, a tap on the heading, and a tap on the overlay gutter | budget-with-accounts | 320×640; touch tap and mouse click | All 16 presses only closed the menu. For Previous and Next, the press landed inside the button but outside the menu, which covers their centers. The dialog stayed on Groceries. From, To and the amount stayed. No alert appeared, and Coffee and Groceries Assigned did not change. Focus returned to `Groceries actions`. After the menu closed, Move moved the money and announced `Moved $7.00 from Coffee to Groceries`. A second overlay tap with no menu open closed the dialog and put focus on `Groceries`. | `M/03b-phone-inspector-rerun/log.txt`, `…/02-menu-open-over-dialog.png`, `…/03-after-menu-dismissals.png`; `M/04-row-menus/04-phone-overlay-tap.png` | pass |
| Budget group ⋯ (Everyday actions) | budget-with-accounts | 1280 keyboard and pointer; 320 touch | Enter focused the first item (`Add Category`). End, Home and ArrowDown each focused the expected item. Escape, a blank click or tap, and a click on `Groceries` each closed the menu with focus on `Everyday actions`, without selecting anything. At 320 px, taps on `Internet`, `Phone`, `Assigned for Internet`, `Assigned for Coffee` and the `Everyday` header each only closed the menu, and focus returned to the ⋯ button. | `M/02-menus/log.txt`, `M/02d-group-menu-touch-controls/log.txt` | pass |
| `Add Category or Group` menu (below `sm`) | budget-with-accounts | 320×640; touch | Escape, a blank tap and a tap on `Previous month` each only closed the menu. Focus returned to the trigger. | `M/02c-menus-touch-rerun/log.txt` | pass |
| Bank card ⋯ (`Sample Bank (Sandbox) actions`) | budget-with-accounts | 1280 keyboard and pointer; 320 touch | It has one item, `Remove connection…`. Enter, End and Home each focus that item. Escape, a blank press and a press on `Connect a bank` each only closed the menu: no dialog opened, and focus returned to the ⋯ button. | `M/02-menus/log.txt`, `M/02c-menus-touch-rerun/log.txt` | pass |
| Account ⋯ (`Checking actions`) | budget-with-accounts | 1280 keyboard and pointer; 320 touch | Enter focused `Rename`. End focused `Starting balance`, Home focused `Rename`, and ArrowDown focused `Move down`. Escape, a blank press and a press on a sidebar or tab-bar link each only closed the menu: the URL did not change, and focus returned to the ⋯ button. | `M/02-menus/log.txt`, `M/02c-menus-touch-rerun/log.txt` | pass |
| Row context menus | budget-with-accounts | 1280×800; pointer and keyboard | Escape after a right-click on the Groceries Activity cell focused the `Groceries` name. On the Everyday group row it focused `Everyday`. After a right-click on the name or Shift+F10, Escape focused `Groceries`. End and Home moved at once. A click on a blank area and a click on the `Coffee` name each only closed the menu, and no inspector opened. | `M/04-row-menus/log.txt`, `…/01-row-menu-open.png` | pass |
| Transaction editor Transfers | budget-with-accounts | 1280×800; pointer | On Checking, the saved inflow `Sample Employer Payroll` offers only `Transfer: Savings` in its row picker and in the editor. The saved outflow `Sample Utility Co` offers `Transfer: Savings` and `Transfer: Card` in both. `transactions/categorize` also passed. | `M/05-editor-transfers/log.txt`, `…/01–04-*.png` | pass |
| Bank card copy | bank-sync, and the plaid journeys | 1280 and 320 | `Sample Savings Bank` needs a reconnect and feeds nothing. Its card reads `Feeds no Budge Account yet.` with no reconnect advice after it. The sentence `Reconnect to see its accounts…` appears nowhere in any evidence from this session. | `M/06-bank-copy/log.txt`, `…/01-savings-bank-card-1280.png`, `…/02-savings-bank-card-320.png`; `J/plaid/attention/` | pass |
| Delete from the inspector ⋯ menu by keyboard (observation for O3-1) | budget-with-accounts | 1280×800; keyboard | After `Delete Rent` into Utilities, focus went to `#main`, and the next Tab went to `Previous month`. | `M/01-desktop-inspector/log.txt`, `…/11-after-delete-rent.png` | see O3-1 |

My first attempts at some scripts failed for reasons in the scripts, not the app. Each failure is kept with its log:

- In `01-desktop-inspector`, an open modal menu hides the controls behind it from `getByRole`, so the script could not find them. The fixed script clicks by position.
- In `01b-…`, the script clicked the open Category's name, which closes its inspector. `01-…` holds the Hide sequence, and it passed.
- In `02b-…` and `02c-…`, the tap target was off screen or under the menu.
- In `03-phone-inspector`, the Previous button's center lies under the menu. That failure left the menu open, and every later check failed with it.

In each case the rerun named in the table drove the same controls and passed.

### Findings and their status

| Finding ID | Severity | Task and reproduction | Expected vs observed / user impact | Evidence | Status on `9b1012b` |
| --- | --- | --- | --- | --- | --- |
| O2-7 | Minor | Open a Category, then choose ⋯ → Hide by keyboard, at 1280 px and in the 320 px dialog. | Focus goes to the next Category, else the previous one, else its group, as the disposition says. Tab then goes on through the table. | `M/01-desktop-inspector/log.txt`, `M/03b-phone-inspector-rerun/log.txt` | **Resolved** |
| O2-8 | Nit | Shift+F10 on Groceries, Move to group, ArrowRight, then Escape. | One Escape still closes both menus (bits-ui behavior). Focus lands on the row's name, or on the inspector's ⋯ button, so reopening the menu costs one key press. ArrowLeft closes only the submenu. The WAI-ARIA menu pattern would close only the submenu, but the cost is small and focus is never lost. I accept the "Kept" disposition. | `M/04-row-menus/log.txt`, `…/03-after-submenu-escape.png` | **Resolved (answered; disposition accepted)** |
| O2-9 | Nit | Read `features/budget.md`. | It now says the side panel shows Upcoming until a Category is open. The running app agrees. | `features/budget.md`, `M/00-readiness/01-budget-ready.png` | **Resolved** |
| O3-1 | Minor | At 1280 px, open Rent and choose ⋯ → Delete… by keyboard. Pick Utilities and press `Delete Category`. | Hide now leaves focus beside the hidden Category, but Delete from the same menu still puts focus on the main region. The next Tab goes to `Previous month`, so a keyboard user has to Tab back into the table. This is the friction that O2-7 fixed for Hide. The `inspector/cover-and-manage` journey asserts `#main`, so the behavior looks deliberate. Delete is rare and goes through a confirmation dialog, so the cost is low. Suggestion: use the same "beside" focus target as Hide. | `M/01-desktop-inspector/log.txt` ("focus after Delete from inspector: main … Tab → Previous month") | Open (does not block approval) |
| O3-2 | Nit | Read `.agents/skills/verify-budge/features/inspector.md:37`. | It says "Hiding or deleting the open Category from its inspector closes the inspector and puts focus on the main region." That is now false for Hide. The journey text in the same file is correct ("focus goes to Car Repairs, the Category before it"). A verifier who follows the Gotchas line would expect the old behavior. Change the line to cover Hide and Delete separately. | `.agents/skills/verify-budge/features/inspector.md:37` | Open (does not block approval) |

### Rubric

| Rubric dimension | Score /10 or unverified | Observation supporting judgment |
| --- | --- | --- |
| Task completion and trust | 9 | Hide, Delete, Move money and Transaction Transfers all persist after a reload. While a menu is open, no click or tap starts a move, changes the month or selects a Category. Move works as soon as the menu closes. The editor now offers the same Transfers as the row picker, so it cannot quietly flip the Direction of a saved inflow. |
| Discoverability and language | 9 | The Bank card copy is now a single fact (`Feeds no Budge Account yet.`) beside the Reconnect button and the reconnect problem line. The empty side panel shows no placeholder. I found no rejected copy in the changed screens. |
| Efficiency and control | 9 | After Hide, focus stays in the table, so a keyboard user can go on through the Categories. A dismissed menu does not lose a started move. O2-8 costs one key press. |
| Feedback and recovery | 9 | Escape in the Delete and Target dialogs closes only that dialog and keeps the unsaved amount, whether pressed quickly or after the dialog settled. A done move is announced. |
| Accessibility and input | 9 | Focus returns to a defined target in every dismissal path I tried: Escape, a blank press, or a press on a control, by pointer, touch or keyboard, for five menus and the row context menus. Enter followed at once by End, Home or an arrow lands on the expected item. Two small gaps remain: O3-1 (Delete sends focus to main) and O2-8. |
| Responsive layout and visual clarity | 9 | At 320 px the inspector ⋯ menu, row menus and dialogs stay on screen. Previous and Next stay usable once the menu closes. The Bank card reads well at 320 px and at 1280 px. |

- **Overall score:** **9/10** for `9b1012b`. All three of my round-2 findings are resolved: two are fixed, and O2-8 is answered with a disposition I accept. Every change since `b7d5afc` behaved as described in each mode and at each width I tried. Each ⋯ menu, the row menus, the Delete and Target dialogs, the menus over the phone dialog, the editor Transfers and the Bank copy all passed. The one new Minor (O3-1) has the same narrow keyboard cost that O2-7 had, on a rarer action. The new Nit (O3-2) is a stale line in the feature map. Neither stops a required task. I do not give 10 because those two small gaps remain.
- **Unverified tasks / external behavior and blockers:** Plaid sync and reconnect against a real bank are excluded, as the brief says. I re-exercised only the tasks that the listed changes touch, as this re-check asks. I did not repeat the full round-2 matrix. There are no blockers.
- **Verdict:** **approve** `9b1012b979aaecea66d6efbeff0023767b600754`. O3-1 and O3-2 should be fixed or deferred with a reason.
- **Cleanup result, ownership release, evidence retained after teardown:**
  - Every Playwright browser closed in `finally`, and no Playwright browser process was left running.
  - `bun run app down` printed `app: down.` and exited 0. After that, `.local-app/running.json` was gone and `git status --short` was empty.
  - Both evidence directories still exist after teardown with no empty files: `/home/lomzem/proj/budge-ui/test-results/verify-budge/opus-round-2-recheck/` (115 files) and `/home/lomzem/proj/budge-ui/test-results/verify-budge/opus-round-2-recheck-manual/` (128 files).
  - The checkout is released to the next judge.
- **Principles that changed a choice:**
  - *Prove it works:* I did not trust journey passes or the disposition text for the menu-over-dialog and focus claims. I wrote re-runnable scripts that press the real controls by pointer, touch and keyboard, then read the stored values and the focused element. One example: I proved that Move did nothing by reading Coffee's and Groceries' Assigned, not only by watching the menu close. When a script check failed, I first suspected my method (an aria-hidden locator, an off-screen target, a target under the menu). I fixed the script and reran it before I judged the app.
  - *Guard the context window:* I kept the evidence on disk (PASS/FAIL lines in `log.txt`, plus screenshots) and read only the logs and a few screenshots, not full ARIA dumps.
