# UI review — UX efficiency, round 3

## Coordinator brief

Review spec `.scratch/ux-efficiency/spec.md`, neutral `ui-final-recheck-brief.md`, and issue08 against clean **417d273986dc93485e7e762a32ed3efed964b20f** (last source ce0dad7). Independent affected recheck plus explicit applicability decision for my own U1–U8/all26 prior observations. Required desktop1280×800 keyboard, phone320×640 actual browser touch with keyboard Escape, nested Target/Delete/Picker layers, held move, touch organizing, month-history sample and390 dark persisted999999.99. Synthetic budget-with-accounts only. External hardware/provider/production behavior excluded. Parent suites were supplied context, not repeated or represented as my rendered evidence.

## Independent judge report — Sol B

Actual model **GPT-6.1-Sol, high reasoning effort**. Fresh independent review; no implementation, source edits, commits, pushes, PR/production operations, delegation or other-judge communication. I read only my own supplied previous report, no state.md, issue05/07, ticket06, other reports or scores.

Exclusive checkout/session: `/home/lomzem/.t3/worktrees/budge/t3-54e18e52-c6b6302d0eab32cd`. `pwd`, HEAD and empty git status confirmed before startup. No `.local-app/running.json` initially; dependencies absent, frozen installation passed before startup. Announced anonymous local target. Read AGENTS, domain/GLOSSARY/authentication/issue-tracker, full principles index and required references, spec/neutral brief/issue08, protocol/rubric/template, verify-budge and Budget/Inspector/Categories/Targets maps.

### Source equivalence and prior evidence applicability

Independently ran `git diff e4c4634...417d273 -- src e2e` and checked Convex paths too. Exactly three changed paths: category-inspector.svelte (clearMove now focuses picker; Clear calls it directly), Budget +page.svelte (phone Dialog Escape handoff when focus is inside inspector), and inspector journey (focus assertion and phone dirty-Escape case). No CSS, shared Dialog, backend, transaction, search, organizing, Target, persistence/history or other implementation changes. Retained diff: `test-results/verify-budge/sol-b-r3-manual/source-diff.txt`.

My own complete prior report is `/home/lomzem/.t3/worktrees/budge/t3-d0be7586-9726ad01307dea57/test-results/ux-efficiency/ui-review-round-2/sol-b.md`, exact old SHA e4c46349ef17488a3ff89af71f0a12136e7cabbc. Its detailed task/input/persistence matrix is also retained verbatim as **historical**, with source root resolution stated, in `test-results/verify-budge/sol-b-r3-manual/own-prior-matrix-reference.md`. This is evidence applicability, not copying its verdict.

| Outcomes | Prior observations that still apply | Why; new evidence boundary |
|---|---|---|
| U1 /1–2 | Desktop/table phone Assigned, invalid recovery, keyboard Target setup/funding, touch overspent funding/hit area; exact RTA/deltas/reload. Bounded999999.99 layouts at320/390/1024/1280, dark long name, both panels | Their implementation and CSS unchanged; fresh budget/assign and targets/monthly plus390 sample supplement. Phone dialog dependencies rechecked independently |
| U2 /3–5 | Prior search/hidden choice, From/To semantics and money invariants remain applicable; old phone pointer Escape alone is insufficient | Fresh maintained inspector journeys and manual desktop keys/actual touch Escape/nested layers/held-write effects supersede affected evidence; no pass inferred from old phone pointer mode |
| U3 /6–10 | Reorder keyboard/Home/End, actual CDP touch cancel/multiple fingers/offscreen drop, desktop drag, reload/Budget order. Partial create refusal, held submitted names, late/failed inline rename with independent draft/focus/retry. Desktop management money/hide/delete history | Categories/reorder/InlineName/backend source unchanged, no shared primitive changes. Fresh actual-touch create/new Group/Category+Group rename/inspector management supplements old journey-only organizing input evidence; fresh cover-and-manage checks desktop destructive/manage dependencies |
| U4 /11–12 | Collapse totals/overspending/touch reload; month grid boundary/arrows/immediate reopen; exact June111→reload→July222→Categories→Back/Forward at desktop pointer,320 touch and full keyboard | History/collapse/layout implementations unchanged, Budget diff only phone inspector Escape handler. Fresh brief history sample supplements, not a claim of repeating all modes |
| U5 /13–16 |320 chips and removal focus, searchable Category/exact Payee vs text, combined keyboard preset/filter chain and touch custom dates; filter-history reload/results and URL identity | No search/register/date/query/history implementation changes. Prior J/F/K task-specific input and persistence evidence applies in its recorded modes |
| U6 /17–18,20 | Actual compact Account Change, optional memo, repeated entry, held duplicate/late draft survival; desktop and320 touch exact Checking/Savings effects and reopen/reload | Transaction/dialog shared source unchanged. Prior Account/count/draft/balance proof applies in recorded modes |
| U7 /19 | Split add/remove/restart and adjacent focus, hidden/revealed memos, touch and keyboard independent6+4 save/reopen, exact Activity/Available/Account effects | No split/transaction/shared primitive/backend changes; prior recorded modes and financial persistence proof apply |
| U8 /21–26 | Sign-in controls, theme copy/persistence, Categories copy, Add Target, export guidance plus actual JSON/14CSV inspection, empty inspector prompt | Copy/controls unchanged; fresh Add Target nested and Categories/theme sample cover dependencies. No real provider sign-in claim |

Prior proof is bounded to the exact input combinations and financial values in my report, with its existing unverified envelope retained below. This accounts for all26 outcomes without repeating unchanged24/25 journeys.

### Readiness and execution

Each app launch used this checkout's anonymous backend and CLI lifecycle. Doctor all-ok, login and seed exited0; private auth state never copied into evidence. Authenticated Budget H1 + Groceries Assigned asserted before driving. America/Los_Angeles contexts; actual touch uses hasTouch/isMobile with tap(), text entered after touch focus, Escape uses browser keyboard events. Desktop mode uses Enter to operate controls. No check/typecheck/sync ran during app sessions. No simultaneous manual driver during verify/reseed.

Shared preview status/open attempted; snapshot failed twice with “The browser is not producing screenshot frames.” Closed my preview tab and used installed Playwright per skill. Four maintained journeys ran serially: inspector/move-money, inspector/cover-and-manage, budget/assign, targets/monthly, all exit0 and4/4 passed at exact clean final SHA (`sol-b-round3/summary.json`).

Two manual organizing harness attempts stopped on selectors (first expected an inspector heading to be a button; next scoped an editable textbox under a region whose heading is temporarily replaced). Captures show controls present. Changed harness to actual Rename menu and the textbox's accessible name; no product fix. Each failed app attempt was torn down, then up/doctor/login/seed/readiness repeated. Successful captures and trace retained separately from FAILED captures.

### Fresh final-SHA task/input/persistence matrix

Evidence roots in this checkout: **J** = `test-results/verify-budge/sol-b-round3/`; **M** = `test-results/verify-budge/sol-b-r3-manual/`. Each named screenshot stem has PNG/ARIA. Four journey traces and manual keyboard/touch/organize/held/history traces retain UI evidence after network/auth-resource sanitization. Scripts retained in M. All rows below are fresh, not carried observations.

| Task / entry / feature | Fixture | Viewport/input | Observed outcome and persistence | Evidence | Result |
|---|---|---|---|---|---|
| Inspector move-money incl desktop search/swap/refusal, phone Escape and navigation | budget-with-accounts |1280 keys/pointer;320 resized pointer with actual Escape | Exact donor/recipient effects; submitted-command status/new draft; reload; dirty clears, clean closes, picker focus; next Category focuses Assigned |J/inspector/move-money, trace.zip |Pass |
| Cover and inspector management |same |1280 pointer | Exact shortfall prefilled, donor falls/recipient zero/RTA invariant; RTA Cover delta; rename/regroup/hide/delete Activity history and reload |J/inspector/cover-and-manage |Pass |
| Budget assignment and Target funding siblings |same |1280 keys/pointer;390 Assigned refusal | Exact Assigned/RTA deltas and reload, valid/invalid recovery, table Target funding and focus |J/budget/assign; J/targets/monthly |Pass |
| Dirty selected Coffee + empty Amount refusal then5.00; Amount focused Escape |same |1280 keyboard;320 touch entry+keyboard Escape | Form remains open, choice/amount/error cleared, From focused; next clean Escape closes back to Groceries. Both independently exercised |M/{keyboard,touch}-2-dirty-refused, -3-escape-cleared; escape-results.json; respective traces |Pass |
| Picker Escape before form Escape; explicit Clear; clean outside-form Escape and header Close |same |1280 keyboard;320 tap+Escape | First Escape closes Command only, Coffee/5.00 draft retained; next clears form. Clear empties and focuses picker. Clean region Escape/header Close return focus to Groceries. No money write; final reload unchanged380/40 and RTA12865.19 in traced run |M/{keyboard,touch}-4-picker-open-dirty,-5-picker-only-closed,-6-explicit-clear,-11-no-money-write-reload; scripts/results/traces |Pass |
| Nested dirty Target Escape |same |1280 keyboard;320 actual touch+Escape |123.45 draft closes Target only (no discard layer presented), parent remains and Add Target focused; no saved Target/money effect |M/{keyboard,touch}-7-nested-target-dirty,-8-target-escape-parent-retained |Pass |
| Nested Delete confirmation Escape |same |1280 keyboard;320 actual touch+Escape |Delete closes only; parent retained, actions trigger focused; Groceries persists, no money/history write after reload |M/{keyboard,touch}-9-nested-delete,-10-delete-escape-parent-retained,-11-no-money-write-reload |Pass |
| Held Groceries→Coffee10; Swap/new7 before land; Clear |same; existing pausableSync Convex transport hold |1280 keyboard/pointer |Truthful submitted $10 direction announcement,7 draft survives; Clear empties draft but keeps completed announcement. Groceries380→370, Coffee40→50; RTA12865.19 unchanged; exact values after reload |M/held-1-submitted-draft,-2-new-draft-while-held,-3-truthful-landed,-4-clear-retains-committed-announcement,-5-persisted; held-results.json, held-trace.zip |Pass |
| Chosen Group Add + new Group within Add Category |same |320 actual tap/text |Savings Goals preselected; Touch Sample added; Touch New Category + Touch New Group made in same dialog. Categories reload and Budget second view show correct rows/groups |M/organize-1-before,-2-chosen-group-draft,-3-new-group-draft,-5-categories-reload,-7-budget-reload; organize-trace.zip |Pass |
| Category+Group inline rename, inspector management |same |320 actual tap/text;Enter commit |Touch Renamed and Touch Group Renamed persist; inspector Rename changes Touch Renamed→Touch Inspector Name without navigation; Budget reload retains it |M/organize-4-renamed,-5-categories-reload,-6-inspector-management,-7-budget-reload; organize-trace.zip |Pass |
| Brief June2027→reload→July2027→Categories→Back |same |390 browser touch context;tap navigation, field fill/Enter |June111 saved/reloaded; July222 saved; Back returns July heading/URL/value after destination readiness |M/sample-1-june111,-2-july222,-3-back-july; history-layout-trace.zip |Pass |
| Long name, persisted999999.99/dark |same |390×844 touch context |Renamed through inspector;999,999.99 and Available/Group totals retained on dark reload; rendered visual inspection below |M/sample-4-dark390-persisted; history-layout-trace.zip |Pass; visually inspected |

### Findings and prior dispositions

No reproduced blocker/major in completed fresh tasks. Harness failures are not product findings: the inspector name is a heading with menu Rename; during editing its heading is replaced by the correctly named textbox. A later layout assertion initially expected an unformatted string; the actual saved value was formatted999,999.99. Corrected observation methods, retained evidence, and reran. These do not justify an implementation change.

Own prior SB-H1 (history destination readiness), H2 (role/name ambiguity), H3 (Payee row-count/custom-date assumptions), H5 (departing-layer hit test) remain answered by their corrected evidence. Source-equivalence supports those dispositions. SB-H4 remains explicitly bounded: full keyboard preset/filter path and touch custom dates passed previously; extra native keyboard custom-date segmented editing remains unverified, not a required missing combination and not asserted passed. No prior product finding is silently erased.

The larger admitted phone-money range remains a deferred envelope risk outside the specified999999.99 case; this round supplies no evidence of readable rendering for every server-admitted amount. Physical phone/iOS gestures, native hardware keyboard/IME, standalone resume, live Plaid, owner production authentication/budget, real provider completion remain external/unverified. Local transport holds prove submitted-state behavior, not live-bank failures. No required local input combination is inferred from a different mode.


### Experience and rubric

I visually inspected the phone dirty/error Move, nested Target, touch inspector-management, and final dark390 captures. Move controls remain below the pinned header and reachable by scrolling; the modal is above the tab bar. Nested Target remains legible with Save inside the dialog. Explicit From/To and a focused picker after reset remove a direction/focus guess. On390 the long name wraps independently,999,999.99 stays wholly visible, and Available1,000,299.87 plus Group Assigned999,999.99 / Available1,000,214.85 read in full. Dense320 forms still need scrolling; this is resolved task access, not an assertion of effortless navigation at every financial scale.

| Rubric dimension | Score /10 | Observation supporting independent judgment |
|---|---:|---|
| Task completion and trust |9|Fresh exact380→370/40→50 money effects and invariant RTA, reload, no-write Escape/Clear, retained submitted direction; prior unchanged transaction/split independent money proofs remain applicable |
| Discoverability and language |9|From/To and searchable picker make direction explicit; completed move wording remains truthful under Swap/Clear; retained concise copy/exact Payee/Account semantics |
| Efficiency and control |9|Dirty Escape resets without dismissing work surface, clean Escape returns to opener; touch Group creation and inline renames complete without prerequisite navigation; prior reorder/repeat-entry scope retained |
| Feedback and recovery |9|Refusal clears with draft reset, useful picker focus, correct late submitted announcement/new draft preservation; prior unchanged failed-rename retry proof applies |
| Accessibility and input |9|Desktop keyboard and actual320 touch+keyboard Escape independently pass; nested Target/Delete/Command close proper layer with useful focus; no money write or lost parent. Prior keyboard funding/splits and CDP reorder remain applicable |
| Responsive layout and visual clarity |9|320 dialog/header/control reachability inspected;390 persisted long-name dark money values read in full; prior unchanged320/1024 panels evidence retained within specified amount boundary |

**Overall: 9/10**, an independent overall assessment, not an average or inherited score. The affected interaction now offers reliable control: an accidental Escape removes the draft first, focuses the next useful choice, then closes deliberately; nested dialogs preserve the inspector. Fresh money/announcement/persistence proof supports trust. Touch organizing completed and persisted. Dense small-screen forms and the explicitly bounded larger-money envelope prevent a universal or frictionless claim.

**Verdict: APPROVE 417d273986dc93485e7e762a32ed3efed964b20f** for the full scoped local UI review, with affected evidence freshly exercised and all26/U1–U8 coverage accounted for through explicit own-source-equivalent prior observations plus new proof. No open confirmed minor, major or blocker in the scoped local tasks. No required local coverage gap remains. Optional/external limitations above remain unverified; none has been silently promoted to a pass. This is only Sol B's verdict; other judge results and the aggregate gate are outside this report.

### Cleanup, retained evidence and ownership release

All Playwright browsers/contexts closed in finally. My shared preview tab was closed. Each failed app attempt and the final successful attempt ran this checkout's `bun run app down` (exit0); each restart repeated up/doctor/login/seed/readiness successfully. No other checkout's processes, backend, browser, data or evidence used or stopped. Final running record absent; ownership **released**. Final HEAD remains 417d273986dc93485e7e762a32ed3efed964b20f and `git status --short` is empty.

After teardown independently counted retained evidence: maintained root67/67 files nonempty including4 UI traces; manual root98/98 files nonempty including5 UI traces. Nine traces were sanitized: network records and nonimage resources removed,16 session-token patterns redacted, then absence rechecked. This retains UI action/screenshot/snapshot evidence with reduced network/stylesheet replay fidelity. No private storage-state contents, credentials, raw auth headers or real-bank data included.

Absolute evidence roots:

- `/home/lomzem/.t3/worktrees/budge/t3-54e18e52-c6b6302d0eab32cd/test-results/verify-budge/sol-b-round3/`
- `/home/lomzem/.t3/worktrees/budge/t3-54e18e52-c6b6302d0eab32cd/test-results/verify-budge/sol-b-r3-manual/`

Principles that changed choices: **Experience First** required actual rendered inspection beyond journey success; **Prove It Works** required fresh real controls, exact balances and reload, and correcting observation errors rather than inferring failure; **Test Behavior, Not Implementation** kept proof at visible drafts/announcements/focus/money; **Separate Before Serializing Shared State** kept backend/browser ownership exclusive and reseeding serial; **Guard the Context Window** kept source checks targeted and historical evidence explicitly linked; **Laziness Protocol** reused maintained journeys plus small evidence-only scripts, with no production modifications. No performance measurement claim is made.
