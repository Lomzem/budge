# UI review — ux-efficiency, round 3 (independent affected recheck)

Protocol: `docs/quality/ui-review/README.md`. Rubric: `docs/quality/ui-review/rubric.md`. Brief: `.scratch/ux-efficiency/ui-final-recheck-brief.md` and issue 08.

Evidence paths are relative to `/home/lomzem/.t3/worktrees/budge/t3-67ad4fd2-0f2e3a8925300bf5/test-results/verify-budge/` unless they are absolute.

## Independent judge report — Opus

### Model and independence

- **Model and effort:** Opus 5.5 (`claude-opus-5-5`). The session process runs with `--effort=medium`.
- **What I read:** AGENTS.md, CLAUDE.md, `docs/agents/domain.md`, `docs/agents/authentication.md` and GLOSSARY.md. I also read these in full:
  - the principles README, plus experience-first, prove-it-works, test-behavior-not-implementation, separate-before-serializing-shared-state, guard-the-context-window and laziness-protocol;
  - the spec, the neutral final-recheck brief and issue 08;
  - the protocol, rubric and template;
  - verify-budge, plus its inspector, targets and categories feature files;
  - my own round-2 report, `/home/lomzem/.t3/worktrees/budge/t3-ef438f28-ba215859556c701b/test-results/ux-efficiency/ui-review-round-2/opus.md`, as prior observation evidence only.
- **What I did not read:** `state.md`, issues 05 and 07, ticket 06, other judges' reports or verdicts, or coordinator score tables. I had no contact with other judges.
- **What I did not do:** no source edits, commits, pushes, PR or production operations, and no further delegation. No preferred score was supplied, and I assumed none.

### Reviewed SHA and checkout

- **SHA:** `417d273986dc93485e7e762a32ed3efed964b20f` on branch `t3/ui-recheck-round-three`. The last source commit is `ce0dad7`.
- **Clean tree:** `git status --porcelain` was empty before and after the review.
- **Checkout:** `/home/lomzem/.t3/worktrees/budge/t3-67ad4fd2-0f2e3a8925300bf5`, which this session owned exclusively. The parent checkout's app was never used.

### Readiness (sanitized)

- `.local-app/running.json` was absent before startup, so no other session owned this checkout.
- Dependencies were missing, so I ran `bun install --frozen-lockfile`.
- I announced and ran `bun run app up`: Vite at http://127.0.0.1:5174, anonymous local backend at 127.0.0.1:3214.
- `doctor` reported every check `ok` and exited 0. `login` wrote the private storage state; its contents were never printed. `seed budget-with-accounts` succeeded.
- Every manual run waited for the authenticated Budget H1 plus an Assigned textbox before acting. The journeys did the same through `openBudget`.
- Contexts used `timezoneId` America/Los_Angeles. Fixtures were invented data, reseeded before each run. One serial driver ran at a time, with no driver active during a reseed. No sync, check or typecheck ran while the app was up.
- **Touch** means a `hasTouch` + `isMobile` context using `tap()`. The logs record `pointer: coarse = true` and `maxTouchPoints = 1`. The physical Escape key was sent with `keyboard.press`.
- **Held responses** were produced only at the existing Convex sync WebSocket boundary (`e2e/heldResponse.ts` `pausableSync`). They are labelled synthetic transport holds.

### Source diff and applicability of my prior evidence

`git diff e4c4634...417d273 -- src e2e` touches 3 files (+36/−8). I read it myself:

1. **`src/routes/(app)/+page.svelte`:** adds `leaveEscapeInsideTheInspectorToIt`, wired as the phone inspector `Dialog.Content`'s `onEscapeKeydown`. It calls `preventDefault` on the dialog's own dismissal while focus is inside `#category-inspector`, so the inspector's own handlers decide what Escape does:
   - the form clears when dirty;
   - otherwise the section calls `onclose`, which closes and returns focus to the Category row.
2. **`src/lib/components/budget/category-inspector.svelte`:** `clearMove()` now focuses `#move-category` itself. The Clear button's inline lambda collapses to `onclick={clearMove}`. As a result, dirty-form Escape now focuses the From/To picker as well; in round 2 it left focus in Amount.
3. **`e2e/journeys/inspector.ts`:** adds a focus assertion and a 320 px phone Escape step.

There are no CSS changes, no shared Dialog/Popover/Select primitive changes, and no backend, money, filter, Transaction-entry or organizing-code changes.

How my round-2 evidence (all 25 journeys and the manual matrix at e4c4634) applies now:

- **Re-exercised fresh:** the move-form Escape/Clear/close paths, phone dialog Escape, and every layer stacked over the inspector. These are the only behaviours on the changed code paths.
- **Carried forward:** the remaining evidence still applies, because the code behind those tasks is byte-identical. That covers:
  - U5 Payee history and filters;
  - U6 fast entry;
  - U7 splits;
  - U8 copy and theme;
  - Target setup and funding (Target dialog source unchanged);
  - held Cover naming;
  - the failure and retry state;
  - loading and empty states;
  - touch target measurements;
  - U3 reorder and failed or late rename (organizing source unchanged).
- **Superseded:** one round-2 observation. "Dirty Escape … focus in Amount" is replaced by the new picker-focus contract, observed below.

### Maintained journeys first (`bun run app verify … --run opus-r3-journeys`)

All 6 passed at 417d273 (`summary.json`: commit 417d273…, `uncommittedChanges: false`, result `passed`):

- `inspector/move-money` (12 steps, including the new phone Escape step)
- `inspector/cover-and-manage` (7)
- `targets/monthly` (4)
- `budget/assign` (8)
- `categories/manage` (10)
- `categories/reorder` (9)

The other 19 round-2 journeys exercise unchanged code and carry forward from `opus-r2-journeys`.

### New final-SHA manual matrix (`opus-r3-manual/<run>/`)

Each run folder holds numbered screenshots and ARIA snapshots (before, action, after, reload), `log.txt` and `trace.zip`. The scripts are in `opus-r3-manual/scripts/`.

| Task / entry point | Fixture | Viewport and input | Observed outcome / persistence | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| Dirty-move Escape → second Escape | budget-with-accounts | 1280 keyboard only (Enter on Groceries, Tab ×4 to the picker, type `cof`, Enter) | **First Escape** (empty Amount refused, then 5.00 typed, Amount focused): picker reset to "Pick a Category", Amount empty, alert gone, Clear gone, region still open, focus on `#move-category`. **Second Escape:** region closed, focus on the Groceries button. Groceries 380.00, Coffee 40.00 and RTA $12,865.19 unchanged, also after reload. | `escape-desktop-kbd/` (`-attempt1` was a recipe Shift+Tab-order error, retained) | Pass |
| Same | same | 320 real touch (taps on the row, picker option and Move), then physical Escape with Amount focused | Same results inside the phone dialog. The dialog stays open on the first Escape; the second closes it and focuses Groceries. No money written; reload unchanged. | `escape-phone-touch/02,03,04,15` | Pass |
| Same | same | 320 keyboard only (Tab ×7 to the picker) | Same results | `escape-phone-kbd/` | Pass |
| Explicit Clear | same | 1280 keyboard (Tab ×2 to Clear, Enter); 320 touch tap; 320 keyboard | Same reset and focus on the picker, inspector open. A clean Escape from the picker then closes and focuses Groceries. | `escape-*/05–07` | Pass ×3 |
| Clean Escape outside the form | same | 1280 kbd (focus on the actions button); 320 touch (tap on the heading focuses the section); 320 kbd | Closes and returns focus to Groceries in every mode | `escape-*/08` | Pass ×3 |
| Header Close | same | 1280 kbd Enter; 320 tap; 320 kbd | Closes and returns focus to Groceries | `escape-*/09` | Pass ×3 |
| Picker/Command Escape over a dirty move | same | All 3 modes; Coffee + 5.00, picker reopened, `din` typed | **First Escape:** closes only the listbox. Picker still "Coffee (−$46.73)" and focused, Amount 5.00, inspector open. **Second Escape:** form contract (cleared, picker focused). **Third Escape:** closes, focus on Groceries. | `escape-*/10–13` | Pass ×3 |
| Phone reachability of move controls | same | 320 touch; 320 kbd | Picker, Amount, Move and Clear are each in the viewport below the pinned header. At touch they are 44 px tall (Move/Clear 69×44 at y=532, header bottom 73). The element at each centre point is the control itself. The modal covers the tab bar. | `escape-phone-*/14` | Pass |
| Nested Target dialog over a dirty move | same | 320 touch; 320 kbd; 1280 kbd | Add Target → typed Amount 123.45 → Escape. Only the Target dialog closes; parent inspector open, focus on Add Target, move (Coffee, 5.00) kept, no Target saved. Due day Select open → Escape closes only the Select (focus on its trigger); the next Escape closes Target. Reload: still "Add Target", no $123.45. The Target dialog has no discard confirmation; Escape discards its draft, as before. | `nested-*/01–04` | Pass ×3 |
| Actions menu and Delete confirmation Escape | same | 320 touch; 320 kbd; 1280 kbd | Menu Escape closes only the menu, focus on `Groceries actions`. Delete… → Escape closes only Delete, focus on the actions trigger, parent open, move kept. With a destination chosen and its Select reopened: Escape closes only the Select, the next Escape closes Delete. Groceries is never deleted (present after reload). After the layers, form Escape clears and the next Escape closes to Groceries. | `nested-*/05–08`, `log.txt` | Pass ×3 |
| Held move, swap and 7.00 draft | same | 320 touch; 1280 pointer | Groceries→Coffee $10 submitted with sync paused. Move is disabled while held. Swap (To = Groceries) and 7.00 typed before landing. Status: "Moved $10.00 from Groceries to Coffee.". Draft 7.00 and the swapped direction kept, focus stays in Amount. Groceries 370.00, Coffee 50.00, RTA unchanged. | `held-phone-touch/01–03`, `held-desktop/` | Pass |
| Clear and Escape while a move is held | same | 320 touch; 1280 | Held Coffee→Groceries $10 → Clear. Form cleared, picker focused, and no text anywhere claims a cancel (status empty). A clean Escape then closes. On release the write commits: Groceries 380.00, Coffee 40.00, RTA unchanged, also after reload. Reopening shows no stale status. The completion is not announced because the inspector was closed (see opus-2). | `held-*/04–06` | Pass (opus-2 minor applies) |
| Held move, then switch Category | same | 1280 | $3 move held → opened Coffee → release. Money lands (Groceries 377.00, Coffee 43.00), but no status text on the page. This confirms what round 2 only inferred. | `held-desktop/C-held-switch` | Confirms opus-2 |
| U3 touch organizing | same | 320 real touch | **Add to a chosen Group:** `Add Category to Savings Goals` preselects the Group and focuses Name; "Sample Touch Fund" added. **New Group inside Add Category:** Edit Categories → Add Category → `New Category Group…` → Group name + Name → one Add. **Rename in place on Categories:** Category saved with Enter, Group saved by blur (tap); no page overflow. **Inspector management on Budget:** actions → Move to group → Savings Goals (inspector stays open, focus on actions), then actions → Rename → "Sample Touch Final" (dialog renamed). **Reload and second view:** Budget shows Fund and Final under Savings Goals plus the Shelf group, and the Categories page agrees. | `organize-320-touch/01–10` | Pass |
| U4 month history sample | same | 1280 pointer | Next-year June 111.11 / July 222.22 → June → reload (`?month=2027-06`) → July → Categories → Back keeps `?month=2027-07`, July and 222.22 (Available $522.21). Forward goes to Categories; the previous month still shows June's own amount. | `u4-history-pointer/` | Pass |
| U1 dark, long name, 999,999.99 sample | same | Dark at 390, 320, 1280 and 1024 (sidebar and inspector), 320 dialog | Persisted after reload. Input `999,999.99` with scrollWidth equal to clientWidth. Available $999,808.87 shown once. Group total $1,000,229.99 in full. No cut cells and no document overflow. Inspector and dialog amounts in full. | `u1-layout-dark-long/01–06` | Pass (opus-4 nit) |

#### Carried forward from my round-2 report at e4c4634 (exact source equivalence)

- U4 touch and keyboard history; U5 history, presets and Payee filter; U6 touch entry and held duplicate; U7 split (touch and keyboard); U8 copy and theme; loading, empty and failure states.
- Target keyboard setup and funding; held Cover name; touch target sizes.
- U1 phone inline Assigned.
- U3 reorder by keyboard and touch, and failed and late rename. These are proven by journeys at both SHAs; `categories/reorder` and `categories/manage` were re-run green today.

### Findings and dispositions of my prior findings

| Finding ID | Severity | Task and reproduction | Expected vs observed / user impact | Evidence |
| --- | --- | --- | --- | --- |
| opus-2 (prior, still open) | minor | Submit a held move or Cover, then close the inspector or open another Category, then release | The money lands correctly and persists, and no draft or focus is disturbed. But the completion is announced nowhere, because the keyed inspector that owned `role=status` is gone. Today I also observed it for a held **move** followed by a Category switch, and for Clear plus close while held. Nothing claims the move was cancelled; Clear never says "cancel". Sighted users see the table update. Code unchanged since round 2, so it remains a localized minor with a reliable path. Suggested follow-up: announce at page level, or keep the status outside the keyed inspector. | `held-desktop/log.txt` (C), `held-*/06` |
| opus-1 (prior) | minor | 320 emulated date inputs clip the last year digit | Source unchanged. Carried forward unchanged, with the same physical-phone caveat. | round-2 `u5-date-field-320/` |
| opus-3, opus-4, opus-5, opus-6, opus-7 (prior) | nit | Month grid tab stops; ragged seven-figure Group total at 390/320 (re-seen today in `u1-layout-dark-long/01`); unnamed region during header rename; split remainder on Shift+Tab; 40 px collapse/name hit areas | Source unchanged; carried forward as nits | round-2 paths; `u1-layout-dark-long/01-390-dark-reloaded.png` |
| opus-8 (new, pre-existing code) | nit | Move form: submit with an empty Amount, then type 5.00 | The refusal "Enter an amount above zero, such as 25.00." stays visible beside a now-valid amount until the next submit or Clear. This is the usual validate-on-submit pattern and is not caused by this diff; the stale error has negligible task impact. | `escape-phone-touch/02-esc-dirty-amount-focused.png` |

No blocker or major findings. The round-2 Escape correction request (phone dialog closing on dirty Escape) is resolved at 417d273 in every input mode tested.

### Rubric

| Rubric dimension | Score /10 | Observation supporting judgment |
| --- | --- | --- |
| Task completion and trust | 9 | Escape, Clear and stacked layers never wrote money, saved a Target or deleted a Category; verified after reload. The held move lands exactly ±$10 with RTA unchanged, and it persists. A held move cleared before landing still commits truthfully, with no false "cancel". Organizing results persist across reload and a second view. |
| Discoverability and language | 9 | Glossary terms throughout ("Move money", From/To, Ready to Assign, Category Group). The new focus on the picker makes clear what was reset and where to start again. "Clear" is honest wording, not "Cancel". |
| Efficiency and control | 9 | One Escape resets a started move and a second closes, the same at desktop and phone. Picker-first Escape protects the draft. Adding a Category with a new Group is a single dialog by touch. |
| Feedback and recovery | 9 | Truthful submitted-move announcement through a swap and retype, with the draft kept. Refusals are clear. Remaining: a held completion is silent when its inspector is gone (opus-2, minor); a stale refusal shows after correction (opus-8, nit). |
| Accessibility and input | 9 | Keyboard and touch both complete every mandatory chain. Focus is always useful: picker after a reset, the opener after each nested layer (Add Target, actions trigger, Select trigger), and Groceries after close. Only the top layer handles Escape. Touch move controls are 44 px. Prior nits opus-5 and opus-7 remain. |
| Responsive layout and visual clarity | 9 | Phone move controls sit clear of the pinned header and inside the viewport. 999,999.99 and seven-figure totals show in full at 320/390/1024/1280 dark with no overflow. Remaining: prior opus-1 minor and the opus-4 nit. |

### Overall score, verdict and gaps

- **Overall score: 9/10.** I exercised every affected task fresh at the final SHA, in the required modes, with reload proof. Those tasks are desktop/phone keyboard and touch Escape/Clear/close, nested Target/Delete/menu/Select/picker layers, held move/swap/Clear, and touch organizing. The repair resolves the round-2 phone Escape problem without regressing nested layers. Unchanged tasks carry forward from my complete round-2 coverage, by source equivalence that I validated against the diff. What remains is localized minors (opus-1, opus-2) and nits with reliable paths, which matches the 9 anchor. It is not a 10, because opus-2's silent completion is real friction for screen-reader users.
- **Coverage gaps and external limits:**
  - No required gap remains open.
  - External items stay unverified: physical phone hardware and native pickers, live Plaid, owner production authentication, reduced motion and measured contrast ratios, and the browser-chrome Back shortcut (driven through the browser API in round 2).
  - The amount envelope is bounded at $999,999.99 Assigned and seven-figure Group totals. I make no universal readability claim for larger server-admitted amounts.
- **Principles that changed a choice:**
  - *prove-it-works*: every Escape/Clear/nested run re-read Assigned and RTA after reload. The held Clear case checked that the committed write actually landed rather than trusting the absence of a "cancel" label.
  - *test-behavior-not-implementation*: the first desktop failure was traced to my recipe's Tab order (Swap sits between the picker and Amount) before any product verdict.
  - *separate-before-serializing-shared-state*: one owned backend with a single serial driver, and no driver during reseeds.
  - *guard-the-context-window*: logs and paths rather than ARIA dumps.
  - *experience-first*: drove the held move then switch, which closed my own round-2 inference instead of carrying it.
- **Verdict: APPROVE `417d273986dc93485e7e762a32ed3efed964b20f`** at 9/10, with full required coverage and no open blocker or major.

### Cleanup, ownership release and evidence retention

- **Browsers:** every manual run closed its browser in `finally`. No Chromium processes from this checkout remain (count 0).
- **App:** `bun run app down` printed "app: down.". `.local-app/running.json` is absent, and http://127.0.0.1:5174 no longer answers.
- **Git:** `git status --porcelain` is empty, and HEAD is still 417d273… (`test-results/` is ignored).
- **Evidence retained after teardown, all nonempty:**
  - `opus-r3-journeys/`: 107 files, 186 MB, 0 empty.
  - `opus-r3-manual/`: 259 files, 83 MB, 0 empty, including traces, screenshots, ARIA snapshots, logs and scripts.
- **Secrets:** a scan of the logs, ARIA files, JSON and scripts for Clerk keys, session cookies and Authorization headers found none. Storage state was never printed.
- **Ownership:** released. No app, backend or browser from this session remains running.
