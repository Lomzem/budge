# Independent UI review — UX efficiency, round 2, Sol A

## Coordinator brief

Spec: `.scratch/ux-efficiency/spec.md`, items 1–26; shared neutral brief `.scratch/ux-efficiency/ui-recheck-brief.md`; coordinator issue `issues/07-ui-review-round-2.md`. Protocol, rubric and template: `docs/quality/ui-review/`.

Exact revision: `e4c46349ef17488a3ff89af71f0a12136e7cabbc` (last application code `2ff1448`). Review covers U1–U8 at desktop 1280×800 pointer, narrow 320×640 browser touch, keyboard completion and targeted 390/dark/long-name/large-money/1024-panel states. External physical-phone, live Plaid and owner production authentication are excluded from local proof.

## Independent judge report — Sol A

Actual model: GPT-6.1-Sol, high reasoning effort. Fresh independent review context; reviewer did not implement the changes, consult historical UI reports, state.md, issue05, ticket06 or another current judge's report. No further delegation or cross-judge contact.

Exclusive checkout: `/home/lomzem/.t3/worktrees/budge/t3-b07d3136-6a31e973738cafaf`. Initial `pwd`, `git rev-parse HEAD`, `git status --short` confirmed this path, exact assigned SHA and a clean tracked tree. No pre-existing `.local-app/running.json`. All app/backend/browser/evidence ownership remained local to this checkout.

Dependencies were absent: `bun install --frozen-lockfile` exited 0 before startup. `bun run app up` exited 0 on this checkout's anonymous local backend; `app doctor` exited 0, all checks ok. `app login` and `app seed budget-with-accounts` exited 0. A fresh private Playwright context, America/Los_Angeles, reached authenticated Budget H1 and seeded `Assigned for Groceries`; readiness screenshot and ARIA retained in `test-results/verify-budge/sol-a-readiness/`. Credentials and storage-state contents were never printed.

Maintained journeys were selected from the actual registry and run serially through `bun run app verify ... --run sol-a-maintained`, with its own reseed before each journey. No parallel browser driver, check, sync or typecheck ran during those journeys. Supplemental scripts and observations live under `test-results/verify-budge/sol-a-manual/`. Browser touch means `hasTouch` plus actual Playwright taps/CDP touch, not resized mouse input; physical phone remains unverified.

## Coverage and observed experience

Evidence roots (all in this checkout):

- **M:** `/home/lomzem/.t3/worktrees/budge/t3-b07d3136-6a31e973738cafaf/test-results/verify-budge/sol-a-maintained`
- **S:** `/home/lomzem/.t3/worktrees/budge/t3-b07d3136-6a31e973738cafaf/test-results/verify-budge/sol-a-manual`

Every named maintained journey below passed in this review. `M/summary.json` records the exact SHA, clean tree, fixture, steps and per-journey result. Each journey directory retains PNG/ARIA pairs and a trace. Viewports/input below describe exercised modes; a narrow mouse journey is not called touch.

| Task / outcomes / journey | Fixture | Viewport and input | Observed result and persistence | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| U1 / 1 / budget/assign | budget-with-accounts | desktop keyboard fields; 390 narrow | Enter/arrow edit navigation, validation, Assigned/Ready to Assign and reload | M/budget/assign | Pass |
| U1 / 1 / direct manual assignment | budget-with-accounts | 320×640 actual touch | Direct table tap, Assigned +$10, Ready to Assign −$10, reload | S/assign320 | Pass |
| U1 / 1 / budget/large-amounts | budget-with-accounts | 390,320,1024,1280 | $999,999.99 saved/reloaded; individual and Group amounts full and each displayed once | M/budget/large-amounts | Pass |
| U1 / long-name and dark combination | budget-with-accounts, UI-created long name | 390 touch; 320/390/1024/1280; dark; 1024 sidebar + open inspector | Long Category name wraps, money stays readable inside boxes, table-width stacking; saved amount reloaded; name restored afterward | S/layout-long-dark-touch | Pass |
| U1 / 2 / targets/monthly | budget-with-accounts | 1280 pointer; 320 layout | Table funding, progress/Upcoming, focus return, Assigned persists | M/targets/monthly | Pass |
| U1 / 2 / full keyboard Target chain | budget-with-accounts | 1280 keyboard, Tab traversal; no locator.focus | Open Category → Add Target → Amount → roving radio → Save → table funding; +$25 Assigned/−$25 Ready to Assign, reload | S/target-clean-keyboard | Pass |
| U1 / 2 / touch Target chain and hit area | budget-with-accounts | 320 touch | Target setup/funding, clean focus and exact +$25/−$25 persist; actual 44px hit reach tested after dialog animation | S/target-clean-touch-retry2 | Pass |
| U1 / 2 / overspent Category Target | budget-with-accounts | 320 touch | Set-aside Target $25 above existing Assigned on overspent Coffee; table button remains available, funds exactly $25, Available increases $25, Ready to Assign falls $25, reload | S/target-overspent-touch-retry3 | Pass |
| U2 / 3–5 / inspector/move-money | budget-with-accounts | 1280 keyboard/pointer; 320 inspector navigation | Search, explicit direction/swap, empty refusal, move and reverse, exact donor/recipient and Ready to Assign; reload; held submitted direction survives swap/new $7 draft; desktop dirty Escape/Clear; loading inspector inert | M/inspector/move-money | Pass for those modes |
| U2 / 3–5, U3 / 10 / inspector/cover-and-manage | budget-with-accounts | 1280 pointer | Exact Cover from searched donor and Ready to Assign, original names in status; rename/regroup into collapsed Group/hide/delete history; reload and Activity side effect | M/inspector/cover-and-manage | Pass |
| U2 / touch Move submit | budget-with-accounts | 320 actual touch | $10 Groceries → Coffee submit and polite status observed; subsequent dirty Escape exposed finding A1. Exact held-money reload contract owned by maintained inspector journey | S/move-cover-touch; S/move-cover-touch-retry1 | Partial task: Escape fails |
| U2 / Clear and dirty Escape | budget-with-accounts | 320 touch context, focused Amount then keyboard Escape | Clear empties and focuses picker with inspector kept; dirty Escape empties but closes inspector. Reproduced twice independently of the longer recipe | S/probes; S/probes-v2 | **Fail A1** |
| U2 / touch Cover | budget-with-accounts | 320 actual touch | Dining Out shortfall $88.29, original Category named in polite status; Assigned +$88.29/Ready to Assign −$88.29 survive reload | S/probes-v2 | Pass |
| U3 / 6–8 / categories/manage | budget-with-accounts | desktop and 320 pointer | Chosen Group, new Group inside Category flow, empty-name validation, creation retry, submitted names held, Category/Group inline rename, hide/delete; reload | M/categories/manage | Pass |
| U3 / 9 / categories/reorder | budget-with-accounts | 320 keyboard and real CDP touch, 1280 pointer | Category/Group keyboard order; touch cancel, Escape cancel, second finger, offscreen edge scroll; order survives reload and Budget view | M/categories/reorder | Pass |
| U3 / 8 / categories/late-rename | budget-with-accounts | keyboard text/pointer | Late rename preserves another unsent draft/focus and newest submitted name; reload | M/categories/late-rename | Pass |
| U3 / 8 / categories/failed-rename | budget-with-accounts | 320; synthetic sync-boundary failures | Failed Category/Group rename feedback, retry and another row's unsent draft preserved; reload | M/categories/failed-rename | Pass |
| U4 / 11 / budget/phone-groups | budget-with-accounts | 320, CDP coarse touch target test, keyboard fields | Group Add 44px hit reach; collapse keeps totals/overspending, reload and expansion | M/budget/phone-groups | Pass |
| U4 / 12 / budget/month-jump | budget-with-accounts | 320 pointer + keyboard grid | Cutover disabled bounds, direct year/month, immediate reopening arrows, reload, distinct monthly Assigned and Back/Forward | M/budget/month-jump | Pass |
| U4 / exact June→July history | budget-with-accounts | 1280 pointer | Next-year June Assigned111.11 → reload → July222.22 → Categories → Back; July URL/heading/amount, Forward Categories | S/history-pointer | Pass |
| U4 / exact June→July history | budget-with-accounts | 320 actual touch | Same exact chain with touch taps; June111.11 distinct from July222.22 | S/history-touch | Pass |
| U4 / exact June→July history | budget-with-accounts | 1280 keyboard Tab/Enter/grid arrows | Same exact chain, no locator.focus; reload, Back July and Forward Categories | S/history-keyboard | Pass |
| U5 / 13–16 / search/filters | budget-with-accounts | 1280 pointer/keyboard picker | Bank Text/split memo, exact Payee identity distinct from q, Category, local presets/custom dates, reset, invalid URL, reload/change Payee/leave/Back and correct results | M/search/filters | Pass |
| U5 / 13–16 / search/phone | budget-with-accounts | 320 narrow, pointer/keyboard chip activation | Folded visible chips, count, removal preserves other filter and moves focus, Clear disabled after reset | M/search/phone | Pass |
| U5 / filter history + combined dates | budget-with-accounts | 320 actual touch | Reload Payee A → B → Categories → Back retains B; combined Payee/Category/preset and custom From/To, reload controls/URL/results captured | S/filters-touch-retry1 | Pass |
| U5 / complete keyboard chain | budget-with-accounts | 1280 keyboard Tab/Command/Select, no locator.focus | Same Payee history; combined Category/date preset, From/To traversal, reload. Native date values filled after reaching fields by Tab | S/filters-keyboard-retry1 | Pass |
| U6 / 17–18,20 / transactions/create | budget-with-accounts | 1280 keyboard/pointer | Manual entry, Payee→Amount Enter, validation/recovery, dirty discard and exact Account balance | M/transactions/create | Pass |
| U6 / 20 / transactions/late-save | budget-with-accounts | desktop | A dismissed save leaves new opening/draft alone | M/transactions/late-save | Pass |
| U6 / 17–18,20 / transactions/add-another | budget-with-accounts | 1280 | Checking compact context, Change to Savings, date/memo, duplicate held submission, late save, clean repeats, edit with populated Memo, All Accounts picker; exact balances and second view | M/transactions/add-another | Pass |
| U6 / mandatory narrow touch combination | budget-with-accounts | 320 actual touch | Checking→genuinely different Savings; held save disabled buttons, forced second tap and Enter save once; late opening preserved; next draft Payee focused/empty, Amount/memo cleared, Account/date retained; Savings −$21.50 and Checking −$11.00, saved Memo and each row once after reload | S/entry-held-change-touch-retry2 | Pass |
| U6 dependencies / transactions/categorize | budget-with-accounts | desktop keyboard; 320 narrow | Searchable Category and Transfer, persistence, approval unchanged | M/transactions/categorize | Pass |
| U6 dependencies / transactions/categorize-late | bank-sync | desktop, sync-boundary hold | Latest Category pick wins over old mutation/query; reload | M/transactions/categorize-late | Pass |
| U6 dependencies / transactions/approve-phone | bank-sync | 320 narrow | Approval dialog fields/Save clear pinned header and tab bar | M/transactions/approve-phone | Pass |
| U7 / 19 / splits/lines, splits/restart | budget-with-accounts | desktop pointer/keyboard | Held lookup, line validation/remainder/add/remove, adjacent focus, populated/optional Memo and restart reset, saved/reopened lines | M/splits/lines; M/splits/restart | Pass |
| U7 / full split lifecycle | budget-with-accounts | 320 actual touch | Add/remove adjacent focus, unsplit/restart clears memos/amounts, save6/4 + memo, reload/reopen; Account −$10 and Budget Available Groceries−$6/Gifts−$4 | S/split-full-touch-retry1 | Pass |
| U7 / full split lifecycle | budget-with-accounts | 1280 keyboard Tab/Enter/Command; no locator.focus | Same full line lifecycle including restart, saved memos/amounts, Account and separate Budget effects after reload | S/split-full-keyboard-retry1 | Pass |
| U8 / 21 | signed-out development Clerk test setup | 1280 pointer view | Budge heading, GitHub button, Email and Continue rendered; app tagline removed. Initial early blank-shell screenshot was insufficient and superseded | S/probes/sign-in-controls.*; S/probes-v2/sign-in-controls.* | Pass |
| U8 / 22–26 | budget-with-accounts | 1280; phone/390 copy also in maintained navigation | Theme sentence absent, Categories introduction removed, Add Target without No Target yet, Settings Download CSV or JSON., empty inspector Select a Category.; consequential export details retained | S/copy-pointer; M/shell/navigate | Pass |
| U8 / export dependency / export/files | budget-with-accounts | desktop | Actual JSON and complete paced CSV downloads, source inventory and private/rebuildable omissions checked | M/export/files/downloads | Pass |
| Shell and settings dependencies | budget-with-accounts | 1280 and 320 | Every Section/Account navigation; later-start preview money/history guidance, cancellation, pinned footer and narrow bounds | M/shell/navigate; M/settings/later-start | Pass |

The maintained summary contains 24/24 passes (command exit 0). Supplemental harness logs retain both failures and corrected replays. Initial selector/timing mistakes were not attributed to the application: native summary was mistaken for a button, nested Target dialogs were ambiguous, navigation URLs were sampled before the destination heading, and hit testing ran during a closing overlay animation. Corrected recipes await the user-visible state. An initial overspent refill assertion also wrongly treated monthly refill as a guaranteed final Available; the final independent test uses Set aside with a fixed +$25 contract and checks all three money effects. No production hooks, database setters or source changes were introduced.

The blank sign-in shell was not accepted as proof: the standard development Clerk testing setup was applied and the actual controls were awaited. Mocked held/failure cases use only the existing Convex sync transport; these do not prove live Plaid behavior.

## Findings

| ID | Severity | Reproduction | Expected vs observed / impact | Evidence |
| --- | --- | --- | --- | --- |
| sol-a-A1 | Minor; correction requested | At 320×640 in touch Chromium, open Groceries, tap Move Amount, type5.00, confirm Amount focused, press Escape. Repeat without having submitted any Move. | Required: clear the dirty Move and keep inspector open. Actual: Amount clears, then the entire phone inspector closes and focus returns to Groceries in the table. Clear works correctly and desktop dirty Escape works. This loses the inspection context and requires reopening/scrolling to continue. No money is saved by Escape and no data corruption was observed. | S/probes/escape-before-dirty.*, escape-after-closed.* and trace.zip; repeated S/probes-v2/escape-before-dirty.*, escape-after-closed.*, clear-keeps-inspector-focus.* and results.json |

The initial crowded Ready to Assign impression was checked against the final dark320 screenshot. All digits remain visible and label/amount are distinguishable; I do not report it as clipping. The tested phone envelope ends at Assigned $999,999.99 and its resulting seven-figure Group totals. Amounts above that, up to the server's 10B admission envelope, remain unverified. This is a stated limitation, not a claim of universal financial readability.

## Rubric assessment

| Dimension | Score /10 | Supporting observation |
| --- | --- | --- |
| Task completion and trust | 9 | All26 primary outcomes have direct rendered/control-driven evidence; fixed independent money deltas, persisted names/order, saved memos and actual downloads checked. No money corruption observed. |
| Discoverability and language | 9 | From/To, compact Account with Change, optional Memo, folded chips and concise routine copy have clear labels; consequential export/history information remains at decisions. |
| Efficiency and control | 9 | Direct phone Assigned/table Target funding, group-aware creation, reorder handles, repeated clean entry and searchable filters avoid prior detours. Dirty phone Escape still adds an unnecessary reopen. |
| Feedback and recovery | 8.5 | Held Move names submitted direction and preserves newer typing; rename failure preserves another draft; repeat saves isolated. Phone Escape violates the specified recovery behavior. |
| Accessibility and input | 8.5 | Full Tab-based Target/filter/split completion passed; actual touch reorder/adversarial paths and 44px targets passed; adjacent line focus and polite statuses verified. Phone dialog Escape differs from desktop and from its explicit Clear action. |
| Responsive layout and visual clarity | 9 | Full requested money digits, long name and dark layout retained across320/390/1024/1280; table container governs stacked amounts with both panels open. Larger phone amounts remain outside measured proof. |

**Separate overall judgment: 8.5/10.** This is an experiential judgment, not the average of the dimensions. The central money and repeated-entry flows are clear and trustworthy in the observed scope. I request one correction before approval because the expressly required phone Escape recovery still dismisses the work context. The finding is localized, with a reliable Clear workaround; its severity is minor rather than a keyboard completion blocker or financial integrity failure.

**Verdict: changes required. I reject approval of `e4c46349ef17488a3ff89af71f0a12136e7cabbc` in this round.** No blocker or major was observed. This report supplies no approval for another SHA or any other judge's slot. The gate remains open on this independent score/verdict; scores must not be averaged.

Required cases have been exercised, including the failing phone recovery case. No whole-app or all-input cross-product is implied. External/unverified: physical phone/native gesture feel and installation, live Plaid, owner production authentication, provider sign-in completion, larger-than-tested phone money envelope. These are not silently treated as passed. Development Clerk controls were rendered; no external sign-in was completed.

## Verification choices and authoring gate

Experience First made the held/keyboard/touch completion and correction feel part of judgment rather than equating green journeys with ease. Prove It Works required reload/second-view effects and the actual Clerk controls instead of an early shell. Test Behavior Not Implementation and the test-audit authoring gate kept additional checks at user controls with independently fixed +$25, −$10, $6/$4 and count contracts; the existing journeys did not cover the exact input/viewport combinations. No production seam was added. Separate Before Serializing Shared State governed exclusive checkout/backend ownership and serial reseeds. Guard the Context Window kept exploration to the neutral sources and affected map; historical reports and score-bearing records stayed unread. Laziness Protocol kept changes confined to ignored evidence/report files, with no source edits or commits. Scripts are retained as verification artifacts; no baseline regression checkout was modified.

## Final persistence check and cleanup

A final separate `S/move-persist` run completes the 320-touch Move side-effect proof that the earlier Escape failure interrupted: authenticated Budget/Groceries readiness, touch From/To search and $10 submit, submitted-direction announcement, donor Assigned −$10, recipient Assigned +$10, Ready to Assign unchanged, all independently asserted again after reload. Before/action/announcement/after/reload PNG and ARIA plus trace retained. Command exited0. The partial earlier rows therefore leave **no touch Move persistence gap**; A1 remains a reproduced failed behavior, not an unexercised task.

There were two owned app attempts. Both inspected absent running records before startup, used anonymous local targets, passed doctor/login/seed/readiness, closed their browsers in finally, and ended with `bun run app down` exit0. The second attempt existed solely to finish the touch Move's independent persistence proof. No backend outside this checkout was seeded or stopped. The temporary shared-preview blank tab opened for availability checking was closed; all review driving used the skill's private authenticated Playwright contexts.

After final teardown:

- `.local-app/running.json` absent; CLI reported `app: down.` using its recorded process identity checks.
- `git status --short` empty; HEAD still exactly `e4c46349ef17488a3ff89af71f0a12136e7cabbc`. No source edits, commits, pushes, PR operations, production writes, further delegates or external messages.
- Retained **251 nonempty PNGs, 249 nonempty ARIA snapshots and 54 nonempty trace ZIPs**, including failed harness attempts; **15 actual export files (1 JSON and14 CSV)** remain. Empty-table CSV bodies may legitimately be empty. Parent feature tests are not rerun as a proxy for this browser review.
- Trace sanitization removed storageState/cookie/header fields, network records and non-image network resources. Traces retain actions, DOM snapshots and screenshots; full network replay/resources are intentionally unavailable. The sanitizer and post-sanitization assertions are retained in `S/sanitize-traces.py`. No session values, raw headers or credential files are included in the report or retained trace payloads. Standalone PNG/ARIA artifacts retain the direct visual evidence.
- All artifacts above were checked after teardown and remain under the two absolute evidence roots. Judge report is `/home/lomzem/.t3/worktrees/budge/t3-b07d3136-6a31e973738cafaf/test-results/ux-efficiency/ui-review-round-2/sol-a.md`.

**Ownership released.** This checkout has no running app or open review browser. Review work is complete; correction/disposition of sol-a-A1 belongs to the coordinator and implementation owner. No revised SHA is approved by implication.
