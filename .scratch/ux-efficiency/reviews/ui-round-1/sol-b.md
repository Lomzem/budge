# UI review — UX efficiency, round 1

Archive note: protocol links were made repository-relative and private artifact links became local path references; observations and verdict are unchanged.

Protocol: [README](../../../../docs/quality/ui-review/README.md), [rubric](../../../../docs/quality/ui-review/rubric.md). This independent report follows the maintained report template.

## Coordinator brief

- Sources read: AGENTS.md; docs/agents/{domain,authentication,issue-tracker}.md; GLOSSARY.md; all 26 items of .scratch/ux-efficiency/spec.md; the shared review-brief.md; issues/05-ui-review-round-1.md; protocol, rubric and report-template; verify-budge skill and affected budget, categories, inspector, targets, transactions, search, splits, accounts, transfers, payees, settings, shell, auth and export map entries. Read the full principles index and all six assigned references, plus Build the Lever and Explain the Number. No other UI judge report, score or verdict was consulted.
- Scope: shared tasks U1–U8, mapped below to all 26 items. Desktop 1280×800 pointer, phone 320×640 browser touch, keyboard tasks; targeted 390px, dark, long names, large amounts, empty results, failures, held responses and cancellation.
- Reviewed SHA: `7aa0bbe5b5b1e8b8eaaf047b0c4f57643679adbf`, last implementation `cec8434`. Assigned integration branch feat/ux-efficiency; actual provisioned checkout branch `t3/ux-efficiency-ui-audit-1`.
- Synthetic fixtures: budget-with-accounts and the maintained approve-phone journey's bank-sync. Additional names/amounts were entered through UI controls. No production, real bank data or live Plaid operations.
- Parent's deterministic/capacity evidence was context, not rerun or substituted for UI observation. No check/typecheck/sync ran during the active app session. No source edits, delegation, commits, pushes, PR operations or external messages.

## Independent judge report — Sol B

- Actual runtime: GPT-6.1-Sol, high reasoning effort.
- Fresh context, independent judge, not implementor. I did not divide scope with another judge or adopt an implementor's assessment.
- Checkout/session owner: sol-b exclusively owned `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519`, its anonymous backend, login state, browser contexts and evidence. Clean HEAD confirmed before launch and after teardown at the exact SHA above. `git status --short` was empty both times.
- Readiness: dependencies initially absent; `bun install --frozen-lockfile` exited 0 before launch. `.local-app/running.json` absent before first start. Target classified local-anonymous. First `app up` printed readiness but doctor subsequently failed recorded Vite process liveness; `app down` exited 0. Second supported `app up`, with its terminal retained, printed app port 5174/backend port 3212. Doctor passed every check, login exited 0, seed budget-with-accounts exited 0. A fresh authenticated context required Budget H1 and Assigned for Groceries, and saved `ready.png`/`ready.aria.yml`. Existing development credentials loaded through the supported loader. No credential/deployment overrides.
- Browser: maintained Playwright path, private saved login, America/Los_Angeles. Phone custom contexts had `hasTouch: true`, `isMobile: true`, actual 320×640 viewport, and `Locator.tap()`; direct touch reorder/cancel/multitouch used the maintained CDP touch-event journey. Physical hardware unavailable; browser touch is the required mode used here. Resized mouse-driven maintained journeys are identified as such, never counted alone as touch proof. Preview tabs opened for setup/sign-in were closed; no preview session was used as authenticated readiness proof.

### Evidence roots

All paths below are inside this checkout, retained after shutdown:

- **J**: 23 maintained journeys and summary (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-round1/summary.json`). Each journey directory includes step PNG/ARIA and trace.zip.
- **M**: custom control-driven initial results (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-manual/manual-results.json`). Scripts/logs and original failed harness attempts are retained here too; do not interpret each recorded failure as an app defect.
- **R**: corrected locator/select recipes (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-recheck/manual-results.json`).
- **F**: final Cover/month navigation recipes (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-final/manual-results.json`).
- **K**: stricter Tab/arrow attempts (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-keyboard2/manual-results.json`). Successful U3/U4/U6/U7; failures and limits discussed below.
- **X**: 390/320/desktop edge results (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-extras/results.json`), plus signed-out desktop/320 screenshots and ARIA in the same directory.
- **S**: split Category/account effects (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-split-effects/manual-results.json`).
- **C**: focused keyboard Cover reproduction (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-key-cover-probe/reload.aria.yml`), with selected/reloaded PNG/ARIA. Completion output in M/keyboard-cover-probe.log.

### Task / viewport / input / persistence matrix

All rows use budget-with-accounts unless stated. “Partial” leaves the specifically named required combination unverified, even when the task works in other modes. Programmatically positioning focus before keyboard activation is distinguished from a full Tab traversal.

| Task / items / entry | Viewport / input | Observations and persistence | Evidence | Result |
| --- | --- | --- | --- | --- |
| U1, 1–2, Budget | 1280×800 pointer | Direct Groceries Assigned +$10 reduced Ready to Assign $10, increased Available $10, persisted. Coffee Target action remained offered while overspent; $25 funding and effects persisted. | M/pointer-U1; J/budget/assign, targets/monthly | Pass |
| U1 | 320×640 touch | Same direct field and overspent Target action completed by tap; no inspector needed to assign/fund. Stacked Assigned/Available are distinguishable at this width. Exact money effects and reload checked. | M/touch-U1 | Pass |
| U1 | 1280×800 keyboard | Focus-positioned keyboard actions completed with exact effects in initial run. Stricter Tab/radio setup did not produce the expected Target mode/action; this extra recipe is not a clean full keyboard-chain proof. | M/keyboard-U1; K/keyboard-U1; J/budget/assign | Partial: strict chain |
| U2, 3–5, inspector | 1280×800 pointer | Prefilled shortfall, searched Emergency Fund, explicit From/To; Dining Out $0, donor Available fell exact shortfall, Ready to Assign unchanged, reload retained both. Ready to Assign Cover also persisted. | F/pointer-U2; J/inspector/cover-and-manage | Pass |
| U2 | 320×640 touch | Same searched donor/shortfall and Ready to Assign shortcut, with exact donor/recipient/global effects and reload. Move control reachable by scrolling dialog. | F/touch-U2 | Pass |
| U2 | 1280×800 keyboard | Focus Dining Out then Enter; Tab to Cover from another Category; Enter, type Emer, Enter selects source and focuses Amount; Enter covers. Persisted after reload. Initial generalized helpers failed to preserve selection; focused reproduction completed. Empty Amount refusal and Escape/focus return also covered by maintained journey. | C; J/inspector/move-money; M/keyboard-cover-probe.log | Pass for focused task; no inferred defect from helper failures |
| U3, 6–10, Budget/Categories | 1280×800 pointer | Chosen Group preselected; new Group + Category; inline Category/Group names persisted. Inspector rename persisted. Category pointer order exercised; independently, direct pointer Group drag changed Bills/Everyday order and persisted. Maintained inspector management also moved, hid and deleted with history effects. | M/pointer-U3; X/1280-group-pointer-reload; J/categories/manage,reorder; J/inspector/cover-and-manage | Pass |
| U3 | 320×640 touch | Creation, long name, inline names and inspector rename via taps persisted. Maintained CDP drag actually changes Category/Group order, survives reload and Budget second view, covers edge-scroll, touchCancel, second finger and mouse Escape cancellation. Custom touch drag alone was a no-op and its immediate loading screenshots are not independent order proof. | M/touch-U3; J/categories/reorder; J/categories/failed-rename,late-rename | Pass via maintained touch reorder + custom taps |
| U3 | 1280×800 keyboard | Tab/arrow/Enter creation including new Group, Category/Group rename, handle Home ordering and inspector rename completed; final name after reload checked. Maintained journey asserts handle focus and persisted order. | K/keyboard-U3; R/keyboard-U3; J/categories/reorder | Pass |
| U4, 11–12, Budget | 1280×800 pointer | Collapse kept totals/overspend cue and survived reload. June 2027 jump/reload, Previous month, navigation to Accounts, Back to May, Forward to Accounts, current Budget values checked. | F/pointer-U4; J/budget/month-jump | Pass |
| U4 | 320×640 touch | Same collapse and month/navigation task by taps, persisted and retained current-month Assigned. Cutover boundary covered by maintained grid journey. | F/touch-U4; J/budget/phone-groups,month-jump | Pass |
| U4 | 1280×800 keyboard | Tab/Enter collapse, grid/year navigation, arrows, Back/Forward and reload completed. Immediate ArrowLeft/ArrowDown on reopened month grid covered maintained journey. | K/keyboard-U4; F/keyboard-U4; J/budget/month-jump | Pass |
| U5, 13–16, All Accounts | 1280×800 pointer | Searchable Payee identity distinct from free text/URL q, Category Gifts finds split parent, date preset/custom/Any dates, empty results and reset. Persisted Category filter and row checked. Desktop filter panel already visible; no nonexistent Filters button required. | R/pointer-U5; J/search/filters | Pass |
| U5 | 320×640 touch | Exact Payee, This year, fold/remove chips preserving Dates, reload/removal, empty search/reset, searchable Gifts and matching row after reload. Chips readable. Custom From/To and other presets covered desktop maintained recipe, not separately completed by touch. | M/touch-U5; J/search/phone,filters | Partial: touch custom-date combination |
| U5 | 1280×800 keyboard | Focus-positioned picker/Enter initial corrected recipe completed. Stricter Tab/arrow recipe did not select the intended Dates preset and no From URL resulted; this attempt cannot establish full keyboard date-filter completion or an app bug. | R/keyboard-U5; K/keyboard-U5 | Partial: strict keyboard preset chain |
| U6, 17–18,20, named Account | 1280×800 pointer | Compact Checking, Change to Savings in maintained recipe, Date retention, memo disclosure, clean next draft, focus Payee, exact balance/one-row checks and reload. Held duplicate click/Enter saved once; closing/reopening kept later draft. Existing edit/populated memo/All Accounts selector covered. | M/pointer-U6; J/transactions/create,add-another,late-save | Pass |
| U6 | 320×640 touch | Native Your Accounts disclosure, Checking, compact context, reveal Change selector and reselect Checking, memo, add-another, empty next draft, Payee focus, balance −$10 and persisted memo. Actual destination change to a different Account and held duplicate/late-response case were only completed desktop. | R/touch-U6; J/transactions/add-another,late-save; J/transactions/approve-phone (bank-sync) | Partial: different Account + held touch combination |
| U6 | 1280×800 keyboard | Tab/Enter entry, Change selector, memo, add-another, clear draft, correct balance and persisted edit memo. | K/keyboard-U6; M/keyboard-U6 | Pass; held adversarial case is maintained desktop mouse/Enter |
| U7,19, Transaction split | 1280×800 pointer | Reveal/save/reopen line memos, correct line/parent amounts and Account −$10 after reload. Maintained validation/add/remove/restart and hidden/populated memo checks completed. | M/pointer-U7; J/splits/lines,restart | Pass |
| U7 | 320×640 touch | Reveal both line memos; save 6+4 and reopen, Account −$10; second Budget view and reload separately confirmed Groceries Available −$6 and Gifts −$4. Full phone add/remove/restart sequence not independently driven. | R/touch-U7; S/touch-U7 | Partial: touch add/remove/restart |
| U7 | 1280×800 keyboard | Tab/Enter split selection, both Categories, amounts, memo disclosures, save/reload/reopen completed with balance effect. Add/remove/restart remains desktop maintained interaction rather than a complete keyboard-only variant. | K/keyboard-U7; R/keyboard-U7 | Partial: full keyboard line lifecycle |
| U8,21–26, sign-in/Settings/Categories/inspector | 1280×800 pointer | Empty inspector exact Select a Category.; Add Target without No Target yet.; no Categories intro; exact Download CSV or JSON.; no Theme reassurance. Export consequence text retained and actual JSON/CSV downloads checked. Signed-out heading/GitHub/email controls retained without app tagline. | M/pointer-U8; X/sign-in-1280; J/export/files,shell/navigate,settings/later-start | Pass |
| U8 | 320×640 touch | Applicable copy states, Settings/export dialog and dark after reload checked. Desktop empty-inspector prompt not invented as phone requirement. Signed-out controls retained. | M/touch-U8; X/sign-in-320 | Pass |
| U8 | 1280×800 keyboard | Applicable copy/dialog entry verified with focus-positioned actions. Extra strict radio helper failed to choose Dark; original keyboard theme persisted. Theme selection is existing behavior, not a new copy control. | M/keyboard-U8; K/keyboard-U8 | Pass for copy; strict theme traversal not claimed |

### Findings

| ID | Severity | Task / reproduction | Expected / observed and impact | Evidence |
| --- | --- | --- | --- | --- |
| sol-b-1 | **Major** | U1/U3 visual clarity. Seed budget-with-accounts. Set Dark in Settings. At 390×640 browser touch, rename Groceries through inspector to “Sample Groceries With A Very Long Name For Narrow Screens”, close, edit table Assigned to 999999.99, Enter, reload and scroll the row into view. | The persisted amount and corresponding Available/Group totals should remain readable in full. Assigned displays only its leading portion, Available loses trailing cents, and Group totals run together/clamp at the right. Field `scrollWidth=110` exceeds `clientWidth=94`; page itself does not overflow. This demonstrates why a zero-overflow assertion is insufficient: the money is unreadable within its box. At 320 the stacked version does fit (`102/102`, page/viewport 320). No incorrect stored amount observed. | 390 post-reload viewport (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-extras/390-failed.png`), ARIA (local artifact: `/home/lomzem/.t3/worktrees/budge/t3-2e620823-82895439599c6519/test-results/verify-budge/sol-b-extras/390-failed.aria.yml`), X/results.json; 320-long-large-dark.png comparator |

No other confirmed major/blocker. Generalized keyboard helper failures are not promoted to findings: they mishandled roving controls, focus handoff or options; the focused Tab/typing Cover reproduction succeeds. Likewise, initial exact-dollar formatting, nonexistent desktop filter toggle, wrong Move button name, native summary locator, and navigation-before-settlement failures were harness errors. They remain visible in raw logs, with corrected evidence explicitly linked above.

### Rubric scores

All scores are provisional because the required combinations listed below remain incomplete. The overall score is independent judgment, not an arithmetic average.

| Dimension | Score /10 | Observation |
| --- | --- | --- |
| Task completion and trust | 8 | Core money effects, one-save behavior, persisted names and split effects checked successfully. 390px renders saved money incompletely. |
| Discoverability and language | 9 | Clear From/To, concise copy, useful disclosure controls, exact filter chips and Account context. |
| Efficiency and control | 9 | Table assignment/Target, prefilled Cover, inline names, direct reorder and clean add-another meaningfully shorten recurring work. |
| Feedback and recovery | 9 | Maintained failed/late rename keeps another draft intact; validation actionable; held duplicate/late-save checks truthful. |
| Accessibility and input | 8 | Real browser touch and focused keyboard Cover work; useful focus return observed. Remaining complete keyboard chains and touch variants prevent a stronger conclusion. |
| Responsive layout and visual clarity | 7 | 320 stacking is legible, including six-figure amount. 390 switches to cramped columns and clips exact monetary information; it needs correction. |

**Overall: 8/10, provisional. Verdict: changes required.** The changed core loops are generally clear and efficient. The observed 390px amount clipping is material for a budgeting app and independently prevents approval. This is not an assertion that stored money is wrong. Coverage gaps also leave the gate incomplete regardless of numerical score.

### Required coverage gaps and limits

- Complete clean keyboard traversal of the Target funding and combined date-preset/filter task was not established by the stricter recipe. Focus-positioned keyboard actions succeeded, but those are weaker evidence. Recheck with a correct roving-radio/Select/Command recipe rather than interpreting generic helper failures as defects.
- At 320 touch, a genuinely different destination Account, held duplicate/late entry-save combination, custom From/To input, full split add/remove/restart sequence; full keyboard split add/remove/restart. Their constituent behaviors were checked in other modes; that does not fill these explicit combinations. Required coverage is therefore **not complete**.
- Long/large/dark 320 passed and 390 failed as above. No full cross-product claimed. Loading, failure, held-response and gesture-cancel cases used the maintained existing transport boundaries; external delivery is not proved by mocks.
- No physical phone, real iOS virtual keyboard/safe-area behavior, live Plaid Link/webhooks, production owner session, or real GitHub/email authentication. These are outside the agreed local gate; authenticated synthetic UI outcomes remain in scope and are not waived.
- Some immediate post-reload custom snapshots contain Loading, and six early harness failures navigated to about:blank with empty ARIA files. Those are not persistence evidence. Use the later waited field/money assertions, maintained journey artifacts and corrected runs named in the matrix. The original artifacts remain for auditability.

### Checks, cleanup and ownership release

- `bun run app verify` with exactly the 23 named journeys in J/summary.json exited **0**, all passed. The invocation and output are in M/journeys.log. It reseeded serially; custom mutations began only after it completed. No capacity/full unit/full E2E rerun.
- Custom recipes recorded success/failure per task; their process exit code alone is not a pass, because failures were caught to continue inspecting other tasks. Matrix/report uses per-task records.
- Browsers closed in finally in each recipe; early preview tabs explicitly closed. The unsuccessful keyboard run's browser was already closed and outer finally attempted closure. No browser remains owned for this review.
- `bun run app down` exited **0** after the initial failed attempt and after the final session. Final `.local-app/running.json` absent. No other checkout's processes were killed, seeded or stopped. **Checkout/app/backend/browser ownership released.**
- After teardown, retained: 588 PNGs, 362 ARIA YAML files, 23 journey trace ZIPs, JSON summaries/results, scripts/logs and actual export files. Decisive finding/readiness/task artifacts are nonempty. Four exported CSVs are intentionally empty tables; six about:blank harness ARIA files are empty and explicitly excluded as proof. Trace network records were inspected without printing payloads; all 23 maintained traces had zero network records. No auth state, credentials or raw headers are included in this report; private login state stays in ignored lifecycle storage.
- Final HEAD unchanged and tracked working tree clean. Report/artifacts are untracked ignored review output only.

### Principles applied

Experience First changed the decision from “fits page width” to testing whether exact dollars and cents are actually legible, exposing sol-b-1. Prove It Works and Test Behavior, Not Implementation led to reloaded balances, donor/recipient/global checks, downloaded exports and independent split Category effects rather than draft-text claims. Separate Before Serializing Shared State kept this checkout/backend exclusive and reseeding serial. Guard the Context Window kept evidence in named artifacts instead of reading other judges or bulk browser dumps. Laziness Protocol/Build the Lever kept verification-only scripts under test-results and left production source untouched.

## Coordinator disposition and final gate

sol-b-1 awaits Opus disposition and affected reinspection on a new clean SHA. No fix implemented by this judge. Required gaps above await completion. No approval or carry-forward granted for this SHA. Other judges and final gate aggregation belong to the coordinator; this report does not claim their status.
