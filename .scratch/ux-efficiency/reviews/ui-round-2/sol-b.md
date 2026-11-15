# UI review — UX efficiency, round 2 — Sol B

## Coordinator brief

Independent assessment of all 26 outcomes in `.scratch/ux-efficiency/spec.md`, U1–U8 in the neutral `ui-recheck-brief.md`, and issue 07, using `docs/quality/ui-review/{README,rubric,report-template}.md`. Exact reviewed commit: **e4c46349ef17488a3ff89af71f0a12136e7cabbc** (last application code 2ff1448), supplied from feat/ux-efficiency into this isolated checkout. No implementation changes or carry-forward of another judge's assessment.

Required sizes: desktop 1280×800 pointer; 320×640 browser touch; keyboard; targeted 390 px dark/long name/persisted amount; 1024 px sidebar and inspector. Synthetic budget-with-accounts and bank-sync fixtures only. Parent capacity/unit/full-E2E results were context, not rendered proof.

## Independent judge report — Sol B

- Actual model: **GPT-6.1-Sol, high reasoning effort**.
- Fresh independent reviewer, not implementor. Did not read state.md, issue05, ticket06, historical UI reports, or another current judge's report. No delegation, external messages, source edits, commits, pushes, PR or production operations.
- Checkout/session owner: Sol B exclusively at `/home/lomzem/.t3/worktrees/budge/t3-d0be7586-9726ad01307dea57`.
- `pwd`, HEAD and empty `git status --short` confirmed before work. HEAD and clean tree confirmed again after teardown.
- Read AGENTS, domain, GLOSSARY, authentication, issue-tracker, complete requested principles, spec, neutral brief, issue07, protocol/rubric/template and affected feature-map files. Used verify-budge.

### Readiness and lifecycle

No `.local-app/running.json` existed initially. Dependencies absent: `bun install --frozen-lockfile` exited 0. Announced anonymous local target. First `app up` reached its URL but doctor rejected recorded Vite-process liveness; cleaned with `app down` (0), retried using a PTY. Retry `up` (0), doctor (all checks ok, 0), login (0), seed budget-with-accounts (0). Independently required authenticated Budget H1 and Assigned for Groceries before driving. Browser contexts used private storage state and America/Los_Angeles.

Preview status/open were attempted first. Two snapshots failed with “The browser is not producing screenshot frames.” Closed that preview tab and used the skill's installed Playwright path. Browser touch used hasTouch/isMobile contexts and real `tap()`; maintained reorder uses CDP touch events. Resized pointer checks are separately identified below. Physical hardware was not used.

Ran 24 named maintained journeys serially, no manual driver during reseeding. Every journey passed; summary records the clean exact SHA. No check/typecheck/sync was run during browser work. After the first manual batch, closed browsers and ran app down (0). The retry repeated up/doctor/login/seed/readiness successfully. Final down exited 0. No running record remains.

### Evidence roots

All paths below are under this checkout, not the owner checkout:

- `test-results/verify-budge/sol-b-round2/` — maintained journey screenshots, ARIA, traces and actual downloads; `summary.json` lists 24/24 passed.
- `test-results/verify-budge/sol-b-manual/` — readiness, first manual attempts and retained control-driving scripts.
- `test-results/verify-budge/sol-b-manual-retry/` — successful exact history, keyboard Target, touch/keyboard splits, touch held entry, dark long-name layouts, sign-in controls, overspent funding and touch-hit evidence.
- `test-results/verify-budge/sol-b-filters-corrected/` — successful touch custom dates/filter history.
- `test-results/verify-budge/sol-b-keyboard-presets/` — successful full keyboard Payee/date-preset chain and reload.
- Other Sol B filter directories retain failed harness attempts, not asserted product defects.

Matrix evidence abbreviations: **J** = sol-b-round2; **M** = sol-b-manual-retry; **F** = sol-b-filters-corrected; **K** = sol-b-keyboard-presets. Each successful journey/task directory or filename stem has PNG/ARIA and a trace except the final standalone sign-in/layout captures, which have PNG/ARIA. Scripts are retained for reproducibility.

### Outcome × viewport/input × persistence/evidence matrix

| Task / outcomes / entry point | Fixture | Viewport / input | Observed outcome and persistence | Evidence | Result |
|---|---|---|---|---|---|
| U1 / 1: table Assigned | budget-with-accounts | 1280 pointer/keys; 320 touch; 390 pointer | Direct edit, exact Ready to Assign delta, Enter/arrow behavior, invalid draft recovery, reload | J/budget/assign; J/budget/phone-groups | Pass |
| U1 / 2: underfunded Target | same | 1280 pointer; clean keyboard traversal | Setup Set aside via roving radio; table funding +$25 Assigned and −$25 Ready to Assign, funded after reload | J/targets/monthly; M/target-keyboard-*; M/target-rta.json | Pass |
| U1 / 2: overspent table Target and hit area | same | 320 touch | Target remains reachable while overspent; 24 px visible button has actual 44 px coarse hit area; tap funds; exact Assigned/RTA and Available effects after reload | M/extra-results.json; M/extra-2-target-touch-area.*; M/extra-3-funded-reload.* | Pass |
| U1 / financial readability | same, long Category name entered through UI | 320,390,1280; 1024 with sidebar+open inspector; dark | Saved 999,999.99 Assigned, Available and seven-figure Group totals readable; money occurs once per table value; no cell/input clipping. Explicit dark390 reload retained | J/budget/large-amounts; M/copy-layout-*-dark-*; M/dark390-reload.* | Pass for bounded case |
| U2 / 3: Cover from searched Category | same | 1280 pointer | Prefilled exact shortfall; recipient Available zero, donor decreases exactly, global Ready to Assign unchanged, reload | J/inspector/cover-and-manage | Pass |
| U2 / 3: Ready to Assign Cover | same | 1280 pointer | Recipient Available zero, RTA decreases by shortfall; status names original covered Category | J/inspector/cover-and-manage | Pass |
| U2 / 4–5: From/To, search, swap, invalid, clear, Escape | same | 1280 keyboard+pointer; 320 inspector pointer | Search narrows Coffee; explicit direction; invalid input changes nothing; dirty Escape clears form and keeps inspector; Clear returns useful picker focus | J/inspector/move-money | Pass |
| U2 / held submitted-command snapshot | same; existing Convex sync boundary held | 1280 keys/pointer | Submitted Groceries→Coffee $10; swap/type7 before landing; announcement still names submitted direction/$10; draft7 survives; exact donor−10/recipient+10 after reload | J/inspector/move-money step05 | Pass |
| U3 / 6: chosen Group Add Category | same | 320 pointer; Group+ CDP touch target | Group entry preselects Savings Goals; correct new Category persists | J/categories/manage; J/budget/phone-groups | Pass |
| U3 / 7: new Group within Add Category | same | 320 pointer/keyboard fields | Missing Group name focuses validation; partial refusal preserves created Group for retry; one Group after reload; held command uses submitted names | J/categories/manage | Pass |
| U3 / 8: inline Category/Group names | same | 320 pointer/keys | Empty refused, Escape restores; saves persist; held rename does not overwrite newer typing; failed rename preserves another row's unsent draft/focus, offers retry | J/categories/manage, late-rename, failed-rename | Pass |
| U3 / 9: direct reorder | same | 320 keyboard and CDP touch; 1280 pointer | Handle arrows/Home/End; touch cancel and Escape no-op; second finger does not finish first drag; offscreen group drag scrolls/drops; reload and Budget reflect order | J/categories/reorder | Pass |
| U3 / 10: inspector management | same | 1280 pointer | Inline rename; regroup expands collapsed destination, hide returns focus/main and preserves hidden money; deletion moves Activity into destination after reload | J/inspector/cover-and-manage | Pass |
| U4 / 11: collapse | same | 320 touch | Totals/overspending cue stay; collapsed state survives reload; overspent navigation expands it | J/budget/phone-groups | Pass |
| U4 / 12: picker, boundary, immediate keyboard reopen, arrows | same | 320 resized pointer/keys | Cutover boundary, year/month jump, immediate arrow handling, reload and distinct month assignments | J/budget/month-jump | Pass |
| U4 / exact June→reload→July→Categories→Back/Forward | same, June111/July222 saved via controls | 1280 pointer, 320 touch, 1280 full keyboard | All three modes return to July URL and heading with222; Forward reaches Categories; June111 independently survived reload | M/history-{pointer,touch,keyboard}-* | Pass |
| U5 / 13: folded removable chips | same | 320 pointer/keyboard | Count and chips remain visible; removing Payee preserves dates; last removal returns focus to Filters; URL clears correctly | J/search/phone | Pass |
| U5 / 14: Category filter | same | 1280 pointer/keys | Search Gifts finds split parent once and correct results; clear preserves other filter semantics | J/search/filters | Pass |
| U5 / 15: exact Payee vs text | same | 1280 pointer/keys; 320 touch | Identity filter uses payee param, blank q; all resulting rows are Sample Coffee Shop, not a presumed singleton | J/search/filters; F/filters-touch-*; K/filters-keyboard-* | Pass |
| U5 / filter history | same | 1280 maintained pointer; 320 touch; full keyboard | Reload Landlord→Coffee→Budget→Back preserves Coffee filter/results; no assumed history entry for each filter | J/search/filters; F; K | Pass |
| U5 / 16: presets and custom dates | same | 1280 full keyboard preset+Payee chain; 320 touch custom From/To | This year fills local Jan1/Dec31, retains Payee and reload; touch custom Nov3/Nov27 reads Custom dates and URL persists after reload | K/filters-keyboard-*; F/filters-touch-*; J/search/filters | Pass |
| U6 / 17: compact named Account and actual Change | same | 1280 pointer; 320 touch | Checking compact context, Change genuinely selects Savings; All Accounts/edit retain picker | J/transactions/add-another; M/entry-touch-* | Pass |
| U6 / 18: Memo disclosure | same | desktop pointer;320 touch | Empty optional memo hidden, Add memo focuses it; saved note visible on reopen | J/transactions/add-another; M/entry-touch-* | Pass |
| U6 / 20: repeat entry, held duplicate and late opening | same; existing Convex response hold | 1280 pointer/keys;320 touch | Held duplicate does not save twice; Escape/reopen new draft survives late response; Save and add another retains date/Account and clears Payee/Amount/Memo/Category, focuses Payee; normal Save/edit/All Accounts work | J/transactions/{create,late-save,add-another}; M/entry-touch-* | Pass |
| U6 / exact financial side effects | same | desktop and320 touch, reload/second Account view | Checking10556.84→10525.84 = −20 split entries−11 held entry; Savings8662.24→8640.74 =−21.50. Each saved entry once, saved Memo and Savings confirmed on reopen | readiness.aria.yml; M/copy-layout-5-dark-1024.aria.yml; M/entry-touch-* | Pass |
| U7 / 19: split lifecycle and memo | same | 1280 pointer;320 actual touch;1280 full keyboard | Add/remove/restart, adjacent focus, hidden/revealed memo; restarted lines reset; save/reload/reopen retains6+4=10 and final memo independently in touch and keyboard | J/splits/{lines,restart}; M/split-{touch,keyboard}-* | Pass |
| U7 / exact independent split effects | same | reloaded second Budget and Account view | Two $10 Checking splits: Groceries Activity−147.01→−159.01, Gifts Available117.75→109.75; Checking−20 excluding separate held entry. Parent amounts/line memos persisted | readiness.aria.yml; M/copy-layout-5-dark-1024.aria.yml; M/split-* | Pass |
| U8 / 21: sign-in | signed-out private context | 1280 pointer | Budge heading, GitHub and Email controls render; deleted app tagline absent. Clerk's own welcome copy remains inside sign-in widget | M/signin-ready.* | Pass |
| U8 / 22: Theme | same | desktop and390 dark reload | Removed sentence absent; theme controls still named and persistent | M/copy-layout-1-settings-dark.*; M/dark390-reload.* | Pass |
| U8 / 23: Categories intro | same | 320 and1280 | Removed management paragraph; named actions/create controls retained | J/categories/manage; M/copy-layout trace | Pass |
| U8 / 24: Add Target | same | keyboard1280; touch320 | Add Target without No Target yet; dialog and funding controls remain named | M/target-keyboard-*; M/extra-* | Pass |
| U8 / 25: export | same | 1280 pointer | Settings intro Download CSV or JSON.; dialog keeps backup/token exclusion/multiple-download guidance. Actual JSON +14 CSVs retained/checked | J/export/files and downloads | Pass |
| U8 / 26: empty inspector | same |1280,1024 pointer | Select a Category. shown while empty; selecting Category opens inspector | J/budget/large-amounts; J/targets/monthly | Pass |
| Dependencies / empty/loading/error | synthetic fixtures | desktop/320 | Empty Upcoming and cleared new drafts, invalid Assigned/Move/split and failed rename; held month makes inspector noninteractive; filter no-match/reset; settings later-start safety/dialog checks | J/budget/assign; categories/failed-rename; inspector/move-money; search/filters; settings/later-start; M/entry-touch | Pass |

### Financial and experiential assessment

I visually inspected retained narrow and 1024 layouts, including the dark long-name table beside both panels, rather than treating overflow assertions alone as readability proof. Stacking follows the table's available width; the narrow financial column remains legible. Target setup/funding can be completed from a clean keyboard path using Tab/roving radios/Enter; split add/remove/restart likewise completed without locator.focus. Searching From/To is easier to interpret than implicit direction, and the submitted-command announcement stayed truthful under a changed draft.

The Target touch probe originally hit the departing inspector layer. After waiting for its removal, pointer:coarse=true, visible button24px, pseudo hit area44px and hits at centre±21px both resolved to the actual button. Touch funding then changed Assigned90→285.07, Available−88.29→106.78, Ready to Assign−987145.30→−987340.37; reload retained these results. These are measured UI effects, not an inference from CSS.

### Findings and harness dispositions

| Finding ID | Severity | Reproduction / expected vs observed | Evidence / disposition |
|---|---|---|---|
| — | No open blocker, major or confirmed minor product defect | Required local combinations above completed | Successful retained evidence listed above |
| SB-H1 | Harness, not product | Back invoked before destination rendered; blank initial history entry | Added destination H1 wait; exact three-mode month sequence passed |
| SB-H2 | Harness, not product | Filters label gains a count; desktop chips not present while controls unfolded; Accounts has sidebar and page headings | Corrected names, roles and readiness waits; retained failed attempts; final F/K runs pass |
| SB-H3 | Harness, not product | Assumed Coffee had one Transaction; custom range equalled This month | Verified every row's exact Payee and chose genuinely custom dates; touch pass |
| SB-H4 | Harness / unverified extra | Forward-Tab cap too short for long register; native custom-date segmented typing produced wrong dates | Reverse traversal resolves cap. Required keyboard combined preset+filter path passes. Extra keyboard custom-date recipe remains unverified; not reported as app bug or as a passed combination |
| SB-H5 | Harness, not product | Touch hit test ran during closing inspector layer | Wait for removal; settled measured44px hit test and actual tap/funding pass |

### Rubric

| Dimension | Score /10 | Observations |
|---|---:|---|
| Task completion and trust | 9 | Exact financial deltas, retained drafts, correct submitted announcements and reload/second-view results; no wrong state observed |
| Discoverability and language | 9 | Explicit From/To, searchable Category and Payee, compact Account Change and meaningful export guidance; routine copy reduced |
| Efficiency and control | 9 | In-table funding/Assigned, inline names/reorder, collapsed totals, clean repeat entry, direct month/year navigation; cancel/clear preserve control |
| Feedback and recovery | 9 | Useful validation/focus, rename retry without stealing drafts, held saves land once, changed drafts survive; correct polite status |
| Accessibility and input | 9 | Required keyboard chains completed; actual touch combinations and44px Group/Target hit tests; focus return and adjacent split focus verified |
| Responsive layout and visual clarity | 9 | Required narrow values and long names readable in dark/light, table-width adaptation at1024 with both panels; phone controls reachable |

**Overall: 9/10, independent overall judgment, not an average.** The scoped workflows are clear and trustworthy across the required inputs and bounded financial layout case. Dense320px forms/registers still require scrolling and deliberate traversal; this is a strong resolved experience, not a claim of universal effortless behavior or all possible amount widths. No open major/blocker was reproduced.

**Verdict: APPROVE e4c46349ef17488a3ff89af71f0a12136e7cabbc for this scoped local UI review.** All26 outcomes/U1–U8 and the specifically required local combinations are covered above. This is Sol B's assessment only; no claim about the other judges or aggregate gate.

### Limits / unverified envelope

- Physical phone/iOS gesture, standalone resume and hardware behavior unverified. Browser touch is the local evidence.
- Live Plaid, owner production authentication/budget and real GitHub/email provider completion unverified. No real budget data accessed. Holds/errors use the existing Convex sync boundary, not live-Plaid failure proof.
- Amounts larger than the specified999999.99 phone case remain unverified. Server admission up to10B does not establish readable phone rendering. Approval is bounded to the specified case and observed seven-figure Group totals; larger-value readability remains a real envelope risk, not a universal pass claim.
- Additional keyboard custom-date segment editing remains unverified after a failed harness recipe; required keyboard combined **preset/filter** traversal and required **touch custom From/To** are independently passed. No pass inferred across modes.

### Cleanup / evidence retention / ownership release

All Playwright contexts/browsers closed in finally, preview tab closed, final `bun run app down` exit0. Only this checkout's CLI-owned/identity-checked processes were stopped. Running record absent; ownership released. HEAD remains the exact reviewed SHA; git status clean. No source files changed.

Evidence retained after teardown: 542 files, 499 nonempty PNG/ARIA/trace artifacts at the time of retention check. Export directory contains JSON plus14 CSVs; intentionally empty tables correctly have zero-byte CSVs. Actual downloads inspected, source table inventory and provider exclusions checked by maintained journey. Trace network records and nonimage network resources were removed; session-token patterns in remaining trace events were redacted before handoff. Traces retain UI actions/snapshots/screenshots, with reduced network/stylesheet replay fidelity. No auth state, credential files, raw headers or environment values are included in this report.

Principles that changed the work: **Prove It Works** required independent money/reload evidence and correction of failed observation methods; **Experience First** required actual rendered inspection beyond green journeys; **Test Behavior, Not Implementation** kept assertions on visible rows/balances/focus; **Separate Before Serializing Shared State** kept this checkout/backend exclusive and reseeds serial; **Guard the Context Window** kept targeted source reads and artifact pointers; **Laziness Protocol** used small retained control-driving scripts without production changes. No performance claim is made.
