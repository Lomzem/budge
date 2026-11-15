# UI review — UX efficiency, round 1 — Sol A

Protocol: [README](../../../../docs/quality/ui-review/README.md); [rubric](../../../../docs/quality/ui-review/rubric.md). This is an independent judge report using the maintained report template's sections.

## Coordinator brief

- Scope: `.scratch/ux-efficiency/spec.md` items 1–26 and the identical shared `review-brief.md`, U1–U8. Coordinator record: `issues/05-ui-review-round-1.md`.
- Reviewed revision: **7aa0bbe5b5b1e8b8eaaf047b0c4f57643679adbf**, last application code `cec8434`, feature branch `feat/ux-efficiency`. Provisioned checkout branch is `t3/ux-efficiency-ui-audit-2`, at that exact SHA.
- Entry points: Budget table/inspector, Categories, named Account and All Transactions, Transaction and Target dialogs, Settings/export, signed-out sign-in.
- Required: desktop 1280×800 pointer; phone 320×640 browser touch; applicable keyboard completion; targeted 390 px, dark, long names, large amounts, empty/error/loading/held states. All changed outcomes remain in scope. Live Plaid, owner production authentication and physical hardware are excluded from this local gate.
- Fixtures: `budget-with-accounts`; maintained `transactions/categorize-late` and `transactions/approve-phone` use `bank-sync`. Custom invented names/amounts were entered through actual controls. No production access or direct database writes.
- Parent deterministic checks were supplied in the shared brief, not rerun or counted as my observations. No capacity/full unit/full isolated E2E rerun.

## Independent judge report — Sol A

- Actual model/setting: **gpt-6.1-sol, high reasoning effort**.
- Fresh context; reviewer, not implementor. I read no other UI judge report, score or verdict and did not use an implementor-preferred assessment. No delegation, source changes, commits, pushes, PR operations or external messages.
- Checkout and exclusive owner: `/home/lomzem/.t3/worktrees/budge/t3-cf91bfb6-3815e14c8e3e34b6`, **sol-a**. `pwd`, clean `git status --short`, and exact HEAD confirmed before launch and after teardown.
- Target classification: **local-anonymous**, announced before startup. No `.local-app/running.json` existed. Dependencies were absent: `bun install --frozen-lockfile` exited 0. `app up`, `doctor`, `login`, and `seed budget-with-accounts` exited 0. Doctor passed every check. Authenticated Budget H1 **and Assigned for Groceries** were asserted before driving; readiness screenshot/ARIA retained.
- Browser: installed Playwright Chromium with private saved login and `America/Los_Angeles`. Phone supplemental contexts used `hasTouch: true`, `isMobile: true`, 320×640 and real `tap()` events. Maintained reorder used CDP touch events, including cancel and a second finger. These are browser touch observations; **no physical phone** was available.
- Shared preview was used for initial signed-out copy. Two phone screenshot attempts failed with “The browser is not producing screenshot frames.” It was closed; remaining work used the required verify-budge Playwright path.

### Evidence roots

All paths below are local to the owned checkout:

- **J**: `/home/lomzem/.t3/worktrees/budge/t3-cf91bfb6-3815e14c8e3e34b6/test-results/verify-budge/sol-a-round1/`
- **S**: `/home/lomzem/.t3/worktrees/budge/t3-cf91bfb6-3815e14c8e3e34b6/test-results/verify-budge/sol-a-supplemental/`
- **M**: `/home/lomzem/.t3/worktrees/budge/t3-cf91bfb6-3815e14c8e3e34b6/test-results/verify-budge/sol-a-manual/`

### Task / viewport / input / persistence matrix

`budget` below means `budget-with-accounts`. Screenshots and matching ARIA snapshots exist under the stated evidence directories. Keyboard passes use actual key input (some initial focus is supplied by locators); they are not a screen-reader certification.

| Task / entry point / spec items | Fixture | Viewport / input | Observed result and independent persistence/effect | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| U1 Budget, 1–2 | budget | 1280×800 pointer | Direct Assigned +$10 changes Available +$10 and Ready to Assign −$10; reload retains it. Overspent Dining Out Target table funding persists. Ordinary Emergency Fund Target also covered by maintained journey. | S/pointer/U1-*; J/targets/monthly | Pass |
| U1 Budget, 1–2 | budget | 320×640 touch | Same direct Assigned and overspent Target outcomes. Separate ordinary underfunded Emergency Fund action assigns exactly $25, Ready to Assign −$25, reload retains $525. Stacked values inspected for legibility. | S/touch/U1-*; M/last-gaps/touch-underfunded-* | Pass |
| U1 Budget, 1–2 | budget | 1280×800 keyboard | Enter assignment and table Target action completed; exact Ready to Assign and reload assertions. | S/keyboard/U1-*; J/budget/assign | Pass |
| U2 Inspector, 3–5 | budget | 1280×800 pointer | Direct click Cover: Coffee $46.73 shortfall, donor Groceries −$46.73, Coffee zero, Ready to Assign unchanged; reload retains. Searchable explicit From/To and invalid input also covered. | M/pointer-probe/cover-*; J/inspector/* | Pass |
| U2 Inspector, 3–5 | budget | 320×640 touch | Search source, confirm calculated shortfall and To; exact donor/recipient values, unchanged Ready to Assign and reload. Negative amount refused; cancel/escape. Separate $1 shortfall covered from Ready to Assign, exact −$1 and reload. | S/touch/U2-* | Pass |
| U2 Inspector, 3–5 | budget | 1280×800 keyboard | Same exact money assertions, invalid input, search and Ready to Assign shortcut; retained after reload. | S/keyboard/U2-*; J/inspector/move-money | Pass |
| U3 Budget/Categories, 6–10 | budget | 1280×800 pointer | Add to chosen Group; create new Group with Category; inspector rename and Group rename retained after reload. Direct Category drag maintained; separate Group drag changes order and retains it in Categories and Budget. | S/pointer/U3-*; M/last-gaps/group-*; J/categories/reorder | Pass |
| U3 Budget/Categories, 6–10 | budget | 320×640 touch | Chosen/new Group creation and inspector/Group rename retained. Real CDP Category/Group reorder, edge scroll, second-finger behavior and touchCancel verified; persisted order appears on Budget. | S/touch/U3-*; J/categories/reorder | Pass |
| U3 Budget/Categories, 6–10 | budget | 1280×800 keyboard; reorder also 320×640 keyboard | Creation, in-place Category/Group rename and inspector management completed. Arrow/Home/End reorder retains focus and survives reload. | S/keyboard/U3-*; J/categories/reorder | Pass |
| U4 Budget, 11–12 | budget | 1280×800 pointer | Collapse keeps totals/cue and survives reload. Year jump, reopen/arrow, reload and This month work; current Assigned preserved. **After June reload → July → Categories, Back restores June.** | S/pointer/U4-*; M/history/pointer-*; M/pointer-month-return.* | **Fail: sol-a-1** |
| U4 Budget, 11–12 | budget | 320×640 touch | Collapse/totals/overspending cue, month/year selection and cutover boundary covered. Phone current-month return via grid retains Assigned. Same June/July Back defect reproduced. | J/budget/{phone-groups,month-jump}; M/history/touch-*; M/touch-month-return.* | **Fail: sol-a-1** |
| U4 Budget, 11–12 | budget | 1280×800 keyboard | Collapse, year grid and immediate arrow on reopening, reload and This month work. Same history defect reproduced with keyboard navigation. | S/keyboard/U4-*; M/final/keyboard-{grid,july,back,this-month}.*; M/final-keyboard.log | **Fail: sol-a-1** |
| U5 All Transactions, 13–16 | budget | 1280×800 pointer | Exact Payee uses identity URL parameter, leaves free-text empty; Category search, date presets/custom dates, count/row restrictions and empty/reset verified. Reload preserves remaining date restriction when Payee removed. | S/pointer/U5-*; J/search/filters | Pass |
| U5 All Transactions, 13–16 | budget | 320×640 touch | Payee search and custom dates; folded chips remain visible. Removing Payee preserves dates; URL/reload and count agree. Loaded empty search/reset exercised. | S/touch/U5-*; J/search/phone | Pass |
| U5 All Transactions, 13–16 | budget | 1280×800 keyboard; chip removal also 320 keyboard | Filter choices/removal and reset completed. Maintained chip test checks focus next chip/toggle and preserved restrictions. | S/keyboard/U5-*; J/search/{filters,phone} | Pass |
| U6 Named Account/All Accounts, 17–18,20 | budget | 1280×800 pointer | Compact Account, Add memo, clean Save-and-another draft, saved memo/edit Account picker, one row and exact −$12.34 balance after reload. Maintained Change-to-Savings, held duplicate prevention and late-save/new-draft safety pass. | S/pointer/U6-*; J/transactions/{create,add-another,late-save} | Pass |
| U6 Named Account, 17–18,20 | budget | 320×640 touch | Save-and-another keeps Account/date, clears amount/memo/Payee and focuses Payee; row and exact balance survive reload. Separate Change-to-Savings pass retains chosen date and saves exactly once, −$1.23 after reload. | S/touch/U6-*; M/account-change/touch-* | Pass |
| U6 Named Account, 17–18,20 | budget | 1280×800 keyboard | Same clean draft and saved edit proof; explicit Change-to-Savings completed with keys, exact balance and one saved row after reload. | S/keyboard/U6-*; M/account-change/keyboard-* | Pass |
| U7 Split dialog, 19 | budget | 1280×800 pointer | Empty memos revealed, $6 Groceries/$4 Gifts saved with memos; each Category Available changes by its exact amount; reload/reopen retains lines. Add/remove/restart and validation covered by maintained journeys. | S/pointer/U7-*; J/splits/* | Pass |
| U7 Split dialog, 19 | budget | 320×640 touch | $6/$4 lines and both memos saved/reopened after reload; independent Category Available effects asserted. Scroll and footer inspected; Save reachable. | S/touch/U7-* | Pass |
| U7 Split dialog, 19 | budget | 1280×800 keyboard | Closed picker typing/Enter selects Split and line Categories; reveal both memos, save, Account balance −$10 and both memos retained after reload/reopen. | M/final/keyboard-split-*; M/final-keyboard.log | Pass |
| U8 copy, 21–26 | budget/signed-out | 1280×800 pointer | Budge heading/Clerk controls remain with app tagline absent; Theme sentence and Categories intro absent; Add Target without No Target yet; exact export sentence and empty inspector prompt. Meaningful export dialog remains; actual files downloaded. | M/final/sign-in-1280.*; S/pointer/U8-*; M/readiness.*; J/export/files | Pass |
| U8 copy, 21–26 | budget/signed-out | 320×640 touch context | Applicable copy observed; phone inspector need not show desktop empty prompt. Signed-out controls fit. Dark 320/390 samples and Settings retained theme checked. | M/final/sign-in-320.*; S/touch/U8-*; M/edge/* | Pass |
| U8 copy, 21–26 | budget | 1280×800 keyboard | Applicable Settings controls completed, Dark retained after reload; empty inspector exact prompt and copied surfaces observed. Sign-in's external provider login is outside this task. | S/keyboard/U8-*; M/final/sign-in-* | Pass |

### Maintained journeys and edge-state evidence

`bun run app verify` ran **25 named journeys, 136 steps, all passed**, exit 0. J/summary.json confirms exact SHA and `uncommittedChanges: false`. Selected names:

- `budget/assign`, `assign-back`, `needs-you`, `month-jump`, `phone-groups`.
- `categories/manage`, `reorder`, `late-rename`, `failed-rename`.
- `inspector/move-money`, `cover-and-manage`; `targets/monthly`.
- `search/filters`, `phone`.
- `transactions/create`, `late-save`, `add-another`, `categorize`, `categorize-late`, `approve-phone`.
- `splits/lines`, `restart`; `export/files`; `shell/navigate`; `settings/later-start`.

Journeys ran first, serially, with their own reseeds; manual contexts started afterwards. No seed or independent mutation driver ran concurrently. Held/failure checks use existing Convex transport boundaries: delayed rename/Assigned/Transaction responses, failed Category and Group rename, superseded Category choices, held remembered-Category lookup, and inspector loading. A failed rename leaves another unsent draft/focus intact; retry/reload works. Touch drag cancellation/second finger and mouse Escape cancellation change nothing. These validate local transport recovery, not live Plaid or physical mobile gesture behavior.

M/edge contains the invented long Category name and $999,999.99 Assigned in light/dark at 320 and 390 px. Exact Ready to Assign delta and reload were asserted. The long name wraps; the full amount remains readable. The editable outline, two-line header and smaller colored Available distinguish the stacked amounts; controls remain reachable. Empty inspector, no Target, loaded empty search, loading and actionable failure states were inspected. Focus rings and sticky dialog controls are visible in the keyboard/phone evidence.

### Findings

| Finding ID | Severity | Task and reproduction | Expected vs observed / impact | Evidence |
| --- | --- | --- | --- | --- |
| **sol-a-1** | **Major** | U4: open Budget; month heading → next year → June 2027; reload; reopen heading, ArrowRight then Enter → July 2027; navigate to Categories through the Section link; browser Back. | Last-viewed Budget URL and heading are July before leaving, but Back restores `?month=2027-06` and June. Required navigation persistence loses the last budgeting context and forces the user to select it again. Reproduced independently at desktop pointer, 320 px browser touch, and keyboard. Heading truthfully says June; I observed no wrong-month write or money loss. | **M/history/observations.json**, `pointer-july.*`, `pointer-back.*`, `touch-july.*`, `touch-back.*`; **M/final/keyboard-july.***, `keyboard-back.*`; `M/history.ts`, `M/final-checks.ts` |

No other confirmed blocker/major/minor finding. Initial broad-script failures are retained rather than erased: formatting/name/disclosure assumptions were corrected; keyboard split was repeated using the supported closed-picker typing path. The extra pre-scroll desktop Cover helper was superseded by a direct-click probe with exact persisted money assertions. The original script's expectation that every month choice creates a history entry was dropped; sol-a-1 instead tests returning from another Section to the last-viewed Budget. This latter failure remains reproducible, including with ordinary direct clicks and viewport screenshots.

### Rubric assessment

| Dimension | Score /10 | Observed basis |
| --- | --- | --- |
| Task completion and trust | **8** | Money effects, exactly-once saves and persisted edits were solid across sampled tasks, but returning to an older month breaks required context persistence. |
| Discoverability and language | **9** | Explicit From/To, concise copy, chosen Group context, labeled memo reveal and filter chips make the next action clear. |
| Efficiency and control | **8** | Direct assignment/funding, search pickers, drag/key reorder and clean repeated entry reduce work. History loss requires reselecting the intended month. |
| Feedback and recovery | **9** | Inline validation, retained failed rename drafts, late-response isolation and held-save disabling give usable recovery without taking over newer work. |
| Accessibility and input | **9** | Applicable tasks completed with keys, visible focus/return and searchable controls; real browser touch reorder/cancellation verified. This is scoped behavioral evidence, not an exhaustive WCAG or screen-reader certification. |
| Responsive layout and visual clarity | **9** | 320 px stacked Assigned/Available are distinguishable and amounts remain legible; long names/large amounts/dark and 390 px hold up. Scrollable split form keeps Save reachable. |

- **Separate overall judgment: 8/10.** The main flows are clear and efficient, and the money/recovery checks are convincing. Returning from Categories to the wrong budget month is a material failure of the required navigation task. This is a judgment of observed experience, not an average or a score chosen to approach the approval threshold.
- **Verdict: changes required.** sol-a-1 remains open. I do not approve this SHA.
- **Required coverage gaps:** no U1–U8 task remains wholly unexercised in its required input/viewport modes; U4 has a demonstrated required-outcome failure. Domain leap/end-of-month exhaustive arithmetic was supplied by the coordinator's deterministic proof, not independently rerun here; representative local-date UI was exercised. No physical phone, live Plaid, owner production/provider sign-in, or exhaustive assistive-technology certification is claimed. Those external exclusions do not waive the changed UI outcomes.

### Cleanup and retained evidence

- Every audit Playwright launch closes its browser in `finally`, including failed scripts. Maintained verifier owns/closes its contexts/browser. The shared preview tab was explicitly closed.
- `bun run app down` from **this checkout** exited 0 and printed `app: down.` No other checkout/process was stopped. `.local-app/running.json` is absent after teardown. Checkout/backend/browser/login/evidence driving ownership is **released**; private saved login remains gitignored as the supported lifecycle specifies.
- HEAD still exactly `7aa0bbe5b5b1e8b8eaaf047b0c4f57643679adbf`; tracked working tree remains clean.
- **709 evidence/script/log/download files retained after teardown.** All screenshots, ARIA snapshots, summary and 25 valid trace ZIPs are nonempty. Four exported CSVs are intentionally zero bytes because their source tables are empty (`connectionAccounts`, `cutoverMoves`, `payeeRenames`, `cutoverMoveHistory`), matching the export contract; they are not missing screenshots/evidence.
- Traces retain actions, DOM snapshots and screenshots; raw network logs and non-image response/source attachments were removed from all 25 ZIPs and archives validated. See M/trace-privacy.txt. Artifacts use invented data; no auth state, raw headers, environment or credential values are in this report. Private session files are not report artifacts.

### Principles applied

- **Experience First** made me inspect stacked money labels, actual touch controls, long content and navigation behavior rather than infer usability from green journeys.
- **Prove It Works / Test Behavior, Not Implementation** drove reload, independent donor/recipient/Ready to Assign/Account/Category effects and actual downloads, and the independent history reproduction.
- **Separate Before Serializing Shared State** kept this checkout/backend exclusive and reseeding serial; no parent app was used.
- **Guard the Context Window / Laziness Protocol** kept investigation scoped and changes confined to audit artifacts. **Build the Lever** produced retained, rerunnable audit/probe scripts under test-results.

## Coordinator disposition and final gate

sol-a-1 awaits implementor disposition and independent re-check on the repaired clean SHA. No source repair was attempted by this judge. This report supplies only Sol A's independent judgment; the three-judge gate remains incomplete and cannot pass by averaging scores or silently carrying approval to a later SHA.
