# UI review — ux-efficiency, round 2 (independent recheck)

Protocol: `docs/quality/ui-review/README.md`; rubric: `docs/quality/ui-review/rubric.md`. Evidence paths below are relative to this checkout's `test-results/verify-budge/` unless absolute.

## Independent judge report — Opus

- **Model and reasoning:** Opus 5.5 (`claude-opus-5-5`), at the reasoning effort configured for this sub-agent session. The configuration states no explicit effort override.
- **Fresh context / independence declaration:**
  - I judged the experience from the spec, the neutral recheck brief, issue 07, the protocol, rubric, template, verify-budge feature map and journey sources only.
  - I did **not** read `state.md`, issue 05, ticket 06, any `reviews/ui-round-1/*` report, or any other round-2 judge's results, and I had no contact with other judges.
  - No target score was assumed.
  - I made no source edits, commits, pushes, PR or production operations, and no further delegation.
- **Reviewed SHA:**
  - `e4c46349ef17488a3ff89af71f0a12136e7cabbc`, branch `t3/ux-efficiency-ui-review-round-2`; same commit as `feat/ux-efficiency`, last code commit `2ff1448`.
  - Clean tree: `git status --porcelain` was empty before and after.
  - Checkout `/home/lomzem/.t3/worktrees/budge/t3-ef438f28-ba215859556c701b`, owned by this session only.
  - The parent `/home/lomzem/proj/budge` was neither used nor altered. Only the documented CLI read of Clerk development credentials happens there.
- **App readiness (sanitized):**
  - `bun run app up` / `doctor` / `login` in this worktree: anonymous local Convex backend at 127.0.0.1:3214 and Vite at http://127.0.0.1:5174.
  - The Playwright storage state was created by `login`; its contents were never printed.
  - `opus-r2-journeys/summary.json` records commit e4c4634, `uncommittedChanges: false`, result `passed`.
  - Every manual run opened the signed-in Budget (H1 "Budget" plus an Assigned textbox) before acting.
  - Fixtures: invented data only (`budget-with-accounts`, `empty-budget`), reseeded per run. Drives ran serially, with no driver during a reseed.
- **Failure and held responses:**
  - Failure and held states were produced only at the existing Convex sync WebSocket boundary (`e2e/heldResponse.ts`: `pausableSync`, `holdResponseTo`, `failFirstCallTo`).
  - The failure messages seen are **synthetic**, not live Plaid or server faults.

### Maintained journeys first (serial `bun run app verify`, time zone America/Los_Angeles)

All 25 passed at e4c4634: `opus-r2-journeys/summary.json`, with per-step screenshots under `opus-r2-journeys/<feature>/`.

- budget/assign, month-jump, large-amounts, phone-groups, needs-you
- categories/manage, reorder, late-rename, failed-rename
- inspector/move-money, cover-and-manage
- targets/monthly
- search/filters, phone
- transactions/create, late-save, add-another, categorize, categorize-late, approve-phone
- splits/lines, restart
- export/files
- shell/navigate
- settings/later-start

### Manual matrix

All manual evidence is under `opus-r2-manual/<run>/`:

- numbered screenshot + ARIA snapshot per step (before / action / after / reload)
- `log.txt`
- `trace.zip`

The scripts are in `opus-r2-manual/scripts/`. Real touch means a `hasTouch`+`isMobile` context with `pointer: coarse`, using `tap()` / `touchscreen.tap`. "Keyboard" means keys only after page load, with Tab counts logged by the driver.

| Task / entry point | Fixture | Viewport and input | Observed outcome / persistence | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| U4 month history (mandatory) | budget-with-accounts | 1280 pointer | Set Groceries next-year June 111.11 and July 222.22 → chose June → reload (`?month=2027-06`) → July → Categories → Back. URL `?month=2027-07`, July heading, picker "July 2027, choose a month", Groceries 222.22 (Available $522.21). Forward → Categories. Previous month → June still 111.11. | `u4-history-pointer/` | Pass |
| U4 month history | same | 320 real touch (tab bar "Sections") | Identical results by tap | `u4-history-touch/` | Pass |
| U4 month history | same | 1280 keyboard | Picker Enter → focus on the chosen month → Shift+Tab to Next year (3 presses past disabled pre-cutover months) → Enter → Tab → arrows → Enter. Focus returns to the picker. Shift+Tab ×7 to the Categories link → Enter. Back keeps July URL, heading and 222.22; Forward → Categories. Browser Back/Forward used `page.goBack/goForward`, because the browser-chrome shortcut can't be dispatched to the page. | `u4-history-keyboard/` | Pass (Back via browser API) |
| U5 Payee history (mandatory) | budget-with-accounts | 1280 pointer | Payee A (Sample Coffee Shop) → reload keeps A → choose B (Sample Employer Payroll) → leave to Budget → Back: URL `?payee=<B id>` and B's 6 rows | `u5-payee-history-1280/` | Pass |
| U1 layout (mandatory) | budget-with-accounts | Dark; 390 then 320, 1280, 1024 with sidebar and inspector open | Renamed Groceries to "Groceries and household essentials for the whole family". Saved 999999.99 at 390 (RTA −$986,754.80), then reload. Input shows `999,999.99` with scrollWidth equal to clientWidth (102/110 px) at every width. Available $999,808.87 shown exactly once. Group totals $1,000,229.99 / $999,723.85 in full. No table cell or input cut, no page overflow, at 390/320/1280/1024. 1024 inspector: all amounts in full, no cut leaves. | `u1-layout-dark-long/01..05`, `log.txt` | Pass (see opus-4 nit) |
| U1 phone inspector | same | 320 Dark, settled dialog | Long heading wraps beside the 32 px ⋯/× buttons with no overlap. `999,999.99` input and $999,808.87 in full. Prev/next Category buttons ellipsize, with full names in accessible names. | `u1-dialog-320-settled/` | Pass |
| U1 table Target funding / polish | budget-with-accounts | 320 real touch | Target via dialog. Table "Assign $25.00 to Emergency Fund": 105×24 visible, measured coarse hit area 106×44. A tap 8 px above the visible box funded it. Group Add 44×44. Previous/Next month 44. Next year 44. Enabled month cell 86×44. Assigned input 44. | `polish-touch-targets-320/log.txt` | Pass (opus-7 nit) |
| U1/U8 Target setup and funding | budget-with-accounts | 1280 keyboard | Tab to Emergency Fund → Enter (inspector region focused) → Tab ×3 to Add Target → Enter (focus on Monthly radio) → Tab to Amount → Tab to the checked radio, ArrowDown to "Set aside" → Tab to the Due day Select, Enter, arrows, Enter ("The 14th") → Tab to Save → focus Edit Target → Shift+Tab ×11 to the table Assign button → Enter. Assigned +$25.00, RTA −$25.00, survives reload. | `kbd-target-setup-funding/` | Pass |
| U2 move/cover feedback, Escape/Clear | budget-with-accounts | 1280 pointer + keys | Status is `role=status` (implicitly polite). Dirty Escape clears the Amount, keeps the form open with focus in Amount; a second Escape closes the inspector with focus on the Groceries name. Invalid amount → alert "Pick a Category."; Clear → focus on the picker. | `move-cover-feedback-1280/`, `cover-held-rename-and-switch/01` | Pass |
| U2 held move (mandatory) | budget-with-accounts | 1280 | Groceries→Coffee $10 submitted while sync was paused; Move disabled while held; swapped From/To and typed 7.00 before landing. Status: "Moved $10.00 from Groceries to Coffee."; the 7.00 draft survived. Available Groceries −$10.00 and Coffee +$10.00, Assigned ±$10.00, RTA unchanged, all also after reload. | `move-cover-feedback-1280/` | Pass |
| U2 held Cover name | budget-with-accounts | 1280 | Cover $88.29 from RTA held → renamed Dining Out to "Sample Eating Out" before landing. Announcement: "Covered $88.29 for Dining Out from Ready to Assign." (the submitted name). Held Cover then switching to Groceries: money correct and persisted, Groceries draft kept, focus not stolen, but no announcement (opus-2). | `cover-held-rename-and-switch/` | Pass (opus-2 minor) |
| U2 failure state | budget-with-accounts | 390 phone dialog | Synthetic `budget:moveMoney` server error → alert "Budge couldn't move the money. Try again." with Amount 4.00 kept. Retry → "Moved $4.00 from Coffee to Groceries.", alert cleared. | `states-error-move-390/` | Pass |
| U5 date preset + Payee filter | budget-with-accounts | 1280 keyboard | Tab ×19 to Payee → type "land" (opens "Search Payees") → Enter → Sample Landlord. Tab → Dates Select → Enter, arrows to This year, Enter. URL `payee=…&from=2026-01-01&to=2026-12-31`, 3 rows. Tab to From → ArrowUp → "Custom dates", URL updated. Clear → disabled, focus to Search, 53 rows restored. | `kbd-date-preset-filters/` | Pass |
| U5 custom dates | budget-with-accounts | 320 real touch | Checking → Filters → From 2026-10-01, To 2026-10-20 → "Custom dates", URL from/to, 8 rows. Folded chip "Dates: Oct 1, 2026 – Oct 20, 2…" (ellipsis). Reload keeps the chip and 8 rows; removing the chip restores 24. The year's last digit is clipped in the date inputs (opus-1). | `u5-touch-320-custom-dates/`, `u5-date-field-320/` | Pass (opus-1 minor) |
| U6 fast entry | budget-with-accounts | 320 real touch | **Different Account:** compact "Account Checking · Change" → changed to Savings → Save; the Teapot row lands in Savings once, balance −$13.00, holds after reload. **Held duplicate:** Save and add another held; a second tap on the same 248×44 box was ignored (both Save buttons disabled). Close → reopen → typed a new Payee → release: Kettle One saved exactly once, new draft untouched, no alert. **Add memo:** focused the Memo. **Save and add another:** Payee cleared and focused; Amount, Memo and Category reset; Account kept. Reload: Checking −$15.00, memo shown on edit. | `u6-touch-320-entry/` | Pass |
| U7 split | budget-with-accounts | 320 real touch | Groceries → Split. Lines Gifts 30 + memo, Coffee 15, Add line → line 3 focused, remainder 5.00. Remove line 2 → focus on the line now in position 2 (`split-category-2`). Restart via Coffee then Split. Save 35/15 + memo. Reload/reopen shows the lines, memo and parent total. | `u7-touch-320-split/` | Pass |
| U7 split | budget-with-accounts | 1280 keyboard | Category typed "split" → Enter → Tab ×1 to Line 1 Category → typeahead → amounts, memo, Add line (line 3 focused, remainder 10.00). Remove line 2 by keyboard → focus on Line 2 Category (now Groceries). Restart, Save, reopen by Tab. | `kbd-split-lifecycle/` (`-attempt1` = recipe wrap, opus-6) | Pass |
| U8 copy / theme | budget-with-accounts | 1280 | Sign-in shows heading Budge plus Clerk controls, no tagline. Desktop empty inspector "Select a Category.". Add Target with no "No Target yet.". Categories with no intro paragraph. Settings: "Theme" with Match this device/Light/Dark, Dark persists after reload, "Download CSV or JSON. Export…". Export dialog keeps the token and multi-download details. | `copy-signed-out/`, `copy-signed-in/` | Pass |
| Loading / empty states | budget-with-accounts; empty-budget | 390 Dark (sync held); 1280; 320 Dark touch | Held sync shows "Loading…" with the navigation present. Empty budget: RTA $0.00, Cutover date card, "Nothing needs you right now.", "No Categories yet. Add a Category Group, then Categories…". No overflow at 320. | `states-loading-error-390-dark/`, `states-empty-budget-*` | Pass |
| U3 organize; U4 collapse / cutover / deep links; U1 phone inline Assigned; U6 normal Save / All Accounts / edit; categorize | per journey | Journey-defined desktop / phone / keyboard / touch | Covered by the 25 maintained journeys at this SHA, which include reorder keyboard/touch, failed and late rename, phone groups, month-jump and large-amounts. Not re-driven by hand. | `opus-r2-journeys/` | Pass (journey) |

### Findings

| Finding ID | Severity | Task and reproduction | Expected vs observed / user impact | Evidence |
| --- | --- | --- | --- | --- |
| opus-1 | minor | U5 at 320 (emulated touch Chromium): Accounts → Filters → From/To 10/01/2026 and 10/20/2026 | Expected the full date in each 138 px field. Observed: the last year digit sits under the calendar icon ("10/01/202▢"), while 390 shows it in full. The folded chip and URL carry the full range, and the chip's accessible name is complete, though the chip text itself ellipsizes ("Oct 20, 2…"). This may be emulation-only, because native mobile date inputs render differently. Physical phone unverified. | `u5-date-field-320/from-field.png`, `from-390.png`; `u5-touch-320-custom-dates/02,03` |
| opus-2 | minor | U2: open an overspent Category → Cover from RTA (held) → open another Category before the response lands | The money moves and persists correctly, and the new inspector's draft and focus are untouched. But the completion is not announced anywhere, because the keyed inspector that owns the `role=status` was destroyed. A screen-reader user who moved on gets no confirmation; sighted users see the table update. Held move then switch is presumably the same (same mechanism; not driven). The brief's submitted-name requirement (rename while held) **is** met. | `cover-held-rename-and-switch/log.txt`, `03`–`05` |
| opus-3 | nit | Month picker by keyboard | All 12 month buttons are in the Tab order as well as reachable by arrows, so moving between the year buttons and the grid can take up to 12 presses in a year with no disabled months. Arrows make it workable; a roving tabindex would shorten it. | `u4-history-keyboard/log.txt`; `src/lib/components/budget/month-picker.svelte` |
| opus-4 | nit | U1 at 320/390 with a seven-figure Group total | $1,000,229.99 shows in full but runs flush to the table's right edge rather than aligning with the Assigned input column, as it does at 1280. Readable, slightly ragged. | `u1-layout-dark-long/01-390-dark-reloaded.png`, `02-320-dark.png` |
| opus-5 | nit | Inspector ⋯ → Rename (while editing) | The inspector region is labelled by its heading, which becomes an input during rename, so the region is momentarily unnamed in the accessibility tree. | `u1-layout-dark-long/earlier-attempt/01-failed.aria.yml` (`region:` without a name) |
| opus-6 | nit | Split by keyboard: focusing any empty line amount fills the remainder | Moving backward with Shift+Tab through an empty Line 2 amount filled it with the whole $60.00, producing "$30.00 over the amount". This is visible and recoverable, and a natural forward path behaves well. It is existing behaviour outside the 26 items. | `kbd-split-lifecycle-attempt1/01-failed.png` |
| opus-7 | nit | 320 coarse pointer | The Group collapse toggle (104×40) and Category name buttons (152×40) give 40 px hit areas: above the 24 px minimum, below the 44 px aim. The dialog header ⋯/× boxes are 32 px; their hit area was not measured. | `polish-touch-targets-320/log.txt`; `u1-dialog-320-settled/log.txt` |

No blocker or major findings. Driver failures in the `*-attempt*` / `earlier-attempt` folders were recipe errors, corrected before judging. They are retained for transparency:

- Every month button is tabbable.
- The phone inspector is modal.
- Saved amounts get grouping separators.
- "Your Accounts" is a phone disclosure.
- Popover close animation.
- Disabled pre-cutover months.
- "Match this device" label.
- `failFirstCallTo` needs an explicit failure.

### Rubric

| Rubric dimension | Score /10 | Observation supporting judgment |
| --- | --- | --- |
| Task completion and trust | 9 | Every money effect was exact and survived reload: move ±$10 under a held swap, cover, Target +$25 / RTA −$25, entries saved once under held duplicate taps, splits 35/15. Month and Payee history return to the last-viewed state. |
| Discoverability and language | 9 | Glossary terms used consistently; copy trimmed as specified while keeping consequential export details; compact Account context with an obvious Change. |
| Efficiency and control | 9 | Save and add another keeps Account and date and focuses Payee; typeahead pickers; table Target Assign; keyboard filter chain is short. Minor friction from month-grid tab stops (opus-3). |
| Feedback and recovery | 9 | Truthful held, failure and retry states; drafts survive late landings; announcements name the submitted command. One silent held-Cover completion after switching Category (opus-2). |
| Accessibility and input | 9 | Full keyboard completion of the mandatory chains with logical focus return; 44 px coarse hit areas where required; split removal focuses the adjacent line. Nits opus-5 and opus-7. |
| Responsive layout and visual clarity | 9 | 999,999.99 and seven-figure totals in full at 320/390/1024/1280 in dark theme with a long name; each value once; no overflow. Emulated 320 date-field clipping (opus-1) and ragged Group total alignment (opus-4). |

- **Overall score: 9/10.** All required tasks, viewports and input modes were exercised at the exact SHA, with reload and second-view proof. What remains is two localized minor findings with reliable paths (opus-1 has the full range in the chip and URL; opus-2 has correct, visible money effects) plus cosmetic or keyboard nits. That fits the rubric's 9 anchor. It is not a 10, because opus-1 and opus-2 are real, if small, friction.
- **Amount envelope:** readability is proven for $999,999.99 Assigned and seven-figure Group totals only. Larger amounts up to the server's 10B limit were not shown readable, so I make no universal readability claim.
- **Unverified / external:**
  - physical phone hardware and native mobile date pickers (dates were filled after a real tap in emulated Chromium);
  - live Plaid behaviour;
  - owner production authentication;
  - the browser-chrome keyboard Back shortcut (Back/Forward driven through the browser API);
  - reduced motion and measured contrast ratios (visual inspection only);
  - held move followed by a Category switch (inferred same as opus-2);
  - U3 organize flows rely on maintained journeys at this SHA rather than fresh manual driving.
- **Principles that changed a choice:**
  - *prove-it-works*: every money check re-read after reload and from a second view.
  - *separate-before-serializing-shared-state*: one serial driver on this worktree's own backend, never during reseeds.
  - *test-behavior-not-implementation*: each driver failure was traced to the user path before any app verdict. This turned the split wrap into opus-6 instead of a false bug.
  - *guard-the-context-window*: logs and paths rather than dumps.
- **Verdict: APPROVE `e4c46349ef17488a3ff89af71f0a12136e7cabbc`** at 9/10, with full required coverage and no open blocker or major. Gaps are limited to the external items above.
- **Cleanup:** see the closing section, appended after teardown.

### Cleanup, ownership release and evidence retention (after teardown)

- **Browsers:** every manual run closed its browser in `finally` (harness `run()`). No Playwright Chromium processes remain.
- **App:** `bun run app down` in this worktree → "app: down.". http://127.0.0.1:5174 no longer answers. Only this worktree's own app processes were involved.
- **Git:** `git status --porcelain` is empty; HEAD is still `e4c46349ef17488a3ff89af71f0a12136e7cabbc` (`test-results/` is ignored). No source edits, commits or pushes.
- **Evidence retained after teardown:**
  - `test-results/verify-budge/opus-r2-journeys/`: 329 files, 546 MB, including real export downloads. Four CSVs are 0 bytes because those tables (connectionAccounts, cutoverMoves, payeeRenames, cutoverMoveHistory) are empty in the fixture. One journey step ARIA file (`budget/phone-groups/01-…aria.yml`) is empty as emitted by the maintained journey; its screenshot is present.
  - `test-results/verify-budge/opus-r2-manual/`: 289 files, 101 MB, 0 empty; 115 screenshots with ARIA snapshots and 26 traces.
  - This report.
- **Secrets:** a scan for Clerk keys, session cookies, Authorization headers and secret env names in the logs, ARIA files and report found none. Storage state was never printed.
- **Ownership:** released. No browser, app process or backend from this session remains running.
