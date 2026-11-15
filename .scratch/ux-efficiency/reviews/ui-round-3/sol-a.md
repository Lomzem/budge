# UI review — UX efficiency, round 3, Sol A

## Coordinator brief

Scope: `.scratch/ux-efficiency/spec.md`, all 26 outcomes/U1–U8, with fresh affected inspection defined by `.scratch/ux-efficiency/ui-final-recheck-brief.md` and `issues/08-ui-review-round-3.md`. Protocol/rubric/template: `docs/quality/ui-review/`. Exact assigned final revision: **417d273986dc93485e7e762a32ed3efed964b20f**, last source ce0dad7. This is an affected review with explicit own prior coverage carry-forward, not a claim to have rerun every unchanged task.

Expected fresh behavior: dirty Move Escape/Clear clears choice, amount and refusal, keeps inspector, focuses picker and writes no money; clean Escape closes back to opener; nested layers consume Escape correctly; submitted Move announcement stays truthful through a new draft/Clear; touch organizing persists; month history and bounded money layout remain coherent. External physical hardware, live Plaid and owner production authentication excluded.

## Independent judge report — Sol A

Actual model: **GPT-6.1-Sol, high reasoning effort**, as supplied by this runtime. Fresh independent review context; no implementation, delegation, cross-judge contact or other judges' reports/verdicts. I read only my specified previous full report and its own supplemental recipes as prior observations. I did not read state.md, issue05/07, ticket06, or other judges' reports. File names in the diff listing were not opened.

Exclusive checkout/session: `/home/lomzem/.t3/worktrees/budge/t3-478e8467-ebcbe4138302763b`, judge sol-a. Initial pwd/HEAD/empty status confirmed exact assigned clean SHA. No pre-existing running.json. No source edits, commits, pushes, PR or production operations.

Read AGENTS, domain, GLOSSARY, authentication, issue-tracker; full principles README plus Experience First, Prove It Works, Test Behavior Not Implementation, Separate Before Serializing Shared State, Guard the Context Window, Laziness Protocol and Build the Lever; spec, neutral final brief, issue08, full UI protocol/rubric/template, verify-budge and feature index/Inspector/Budget/Targets/Categories.

### Readiness and lifecycle

Dependencies initially absent: `bun install --frozen-lockfile` exit0 before app startup. Initial owned `app up` exit0 but doctor exit1: recorded Vite process no longer running. This attempt was rejected as readiness; `app down` exit0 before retry. No authenticated browser task was attributed to that attempt.

Retry: `app up` exit0, own anonymous backend `http://127.0.0.1:3210`, frontend `http://127.0.0.1:5175`; doctor exit0/all ok, login exit0, `seed budget-with-accounts` exit0. Authenticated Budget H1 and seeded Assigned for Groceries required and observed before maintained journeys. All contexts use private storage state and America/Los_Angeles. 320/390 touch contexts use hasTouch/isMobile and Playwright taps; desktop actions use Tab/Enter and actual keyboard events. No mouse input is described as touch. The user explicitly requested private authenticated Playwright; an unused shared-preview blank tab was closed. Authentication/session state is excluded from artifacts.

No sync/check/typecheck or other driver during app journeys. Reseeds and drivers serialized. Maintained command `bun run app verify inspector/move-money inspector/cover-and-manage budget/assign targets/monthly --run sol-a-r3-maintained` exit0, **4/4 pass**. Parent unit/capacity/full-E2E evidence is background context, not substituted browser proof and not repeated.

Evidence roots:

- **M:** `/home/lomzem/.t3/worktrees/budge/t3-478e8467-ebcbe4138302763b/test-results/verify-budge/sol-a-r3-maintained`
- **S:** `/home/lomzem/.t3/worktrees/budge/t3-478e8467-ebcbe4138302763b/test-results/verify-budge/sol-a-r3`
- Reproducible supplemental artifact: S/manual.ts; lifecycle: S/lifecycle.txt; exact inspected diff: S/source-diff.patch.

## Own previous report applicability

Own full report: `/home/lomzem/.t3/worktrees/budge/t3-b07d3136-6a31e973738cafaf/test-results/ux-efficiency/ui-review-round-2/sol-a.md`, exact clean **e4c46349ef17488a3ff89af71f0a12136e7cabbc**. Its M/S paths are separate historical evidence, never relabeled final-SHA executions.

I independently ran `git diff e4c4634...417d273 -- src e2e` and retained the standard patch. Only two production files differ: Budget route adds phone Dialog Escape handoff when focus is inside inspector; category-inspector puts picker focus in clearMove and calls it directly for Clear. Only inspector.ts changes among journeys, adding picker-focus and actual phone Escape assertions. No CSS, shared Dialog primitive, stored-money/backend, Target, Category management/reorder, filter, transaction/split, URL-history or copy implementation changes. These facts justify retaining my prior task/input/persistence observations, with affected inspector Escape/focus and nested dependencies replaced by new evidence below. I carry no old score or approval.

| Prior scope / outcomes | Own evidence retained and why it applies |
| --- | --- |
| U1 / 1–2 | Prior M/budget/assign, large-amounts, targets/monthly; S/assign320, target-clean-keyboard, target-clean-touch-retry2, target-overspent-touch-retry3, layout-long-dark-touch prove direct phone assignment, desktop full keyboard and touch Target creation/funding, exact +25/−25 and reload, long/dark/1024/320/390/1280 bounded money layout. Table/Target/money implementations unchanged; new assignment/Target journeys and nested checks add final-SHA dependency evidence. |
| U2 / 3–5 | Prior M/inspector/move-money and cover-and-manage, S/move-persist and probes-v2 prove actual touch Move/Cover and exact persisted donor/recipient/RTA and calculated shortfall. Money implementation unchanged. All old Escape/focus conclusions superseded by fresh checks; held Move rerun in both maintained desktop and supplemental touch. |
| U3 / 6–10 | Prior M/categories/manage, reorder, late-rename, failed-rename and inspector/cover-and-manage retain creation failure/retry, submitted-name isolation, keyboard/CDP-touch reorder including cancel/second-finger/edge-scroll, failure recovery/unsent draft and persisted ordering. All those implementations unchanged, including shared primitives. Fresh actual-touch creation, renames and inspector management now supplement prior journey-only organizing input evidence. |
| U4 / 11–12 | Prior M/budget/phone-groups/month-jump and S/history-pointer, history-touch, history-keyboard prove collapse totals/overspending, 44px touch reach, keyboard grid/cutover bounds, June111.11→reload→July222.22→Categories→Back/Forward separately in each mode. Month/history/collapse unchanged. Fresh touch exact history sample below. |
| U5 / 13–16 | Prior M/search/filters, search/phone and S/filters-touch-retry1, filters-keyboard-retry1 retain exact Payee identity vs free search, Category/date presets/custom dates, folded chips/focus, combined results and reload/leave/Back in actual touch and full Tab/Command/Select keyboard. No implementation/shared primitive diff affects these paths. |
| U6 / 17–18,20 | Prior M/transactions/create, late-save, add-another, categorize, categorize-late, approve-phone; S/entry-held-change-touch-retry2 retain compact named Account/Change to different Savings, All Accounts, optional/populated Memo, clean repeated entry/date retention, duplicate prevention, late-save isolation, exact −21.50 Savings/−11 Checking and row-once reload, approval/header/tabbar reach. Transaction/auth/transport/shared Dialog implementations unchanged. |
| U7 / 19 | Prior M/splits/lines/restart and S/split-full-touch-retry1, split-full-keyboard-retry1 retain full add/remove/adjacent focus/unsplit/restart/memo lifecycle, save/reopen and exact Account−10, Groceries−6/Gifts−4 after reload in touch and full keyboard separately. Split/dialog/money implementations unchanged. |
| U8 / 21–26 and dependencies | Prior S/probes/probes-v2 actual development Clerk sign-in controls (not blank shell); S/copy-pointer; M/export/files, shell/navigate, settings/later-start retain all six copy outcomes, consequential export/history guidance, actual JSON/CSV contents and shell/settings phone navigation. No corresponding source or shared primitive change. Provider sign-in completion remained external, not passed. |

This accounts for all26 outcomes and the original required input/persistence proof. It retains only my own evidence; not another judge's or a green-suite inference. Prior required coverage was complete including a failed A1 behavior, which is now re-exercised and dispositioned. No additional real required gap identified in that prior report remains unaccounted for.

## New final-SHA task matrix

All fresh fixtures are synthetic budget-with-accounts. PNG/ARIA before/action/after/reload and sanitized trace retained per scenario. M summary records exact SHA and clean tree. Supplemental script runs return exit0 after recording individual results; results JSON, not process exit alone, determines pass/fail.

| Task / feature entry | Viewport / actual input | Fresh observed result / persistence | Evidence | Result |
| --- | --- | --- | --- | --- |
| Authenticated readiness | 320×640 touch context | Budget H1 + seeded Assigned for Groceries | S/readiness | Pass |
| inspector/move-money, inspect-open/move-money | 1280×800 keyboard/pointer;320×640 maintained narrow | Explicit search/swap, held submitted status/new7 draft; exact donor/recipient reload; refusal/reset focus, phone two-Escape contract, navigation and loading inertness | M/inspector/move-money | Pass |
| inspector/cover-and-manage, cover/inspect-manage | 1280×800 pointer | Calculated shortfall Cover from donor and RTA; exact money/RTA/Activity after reload; rename/regroup/hide/delete management | M/inspector/cover-and-manage | Pass |
| budget/assign, targets/monthly | desktop keyboard/pointer;390/320 layout dependencies | Assigned/RTA persistence and Target table funding/progress/focus/Upcoming persisted | M/budget/assign; M/targets/monthly | Pass |
| Dirty Move: selected Coffee, empty Amount refusal, then5.00 with Amount focused→keyboard Escape | 1280×800 Tab/Enter;320×640 actual taps then keyboard Escape | Choice/amount/error cleared, inspector open, From focused; second clean Escape closes and focuses Groceries. No Assigned/RTA write after reload | S/escape-keyboard, escape-touch; strengthened replay S/retry2/escape-keyboard, escape-touch | Pass |
| Explicit Clear with selected Category/refusal/5.00; clean outside-form Escape; header Close | Both modes separately | Clear clears fields/error and focuses picker; outside-form Escape and header Close return Groceries; amount and picker centers hit-test unobstructed and inside viewport; reload no money changes | S/retry2/escape-* (02/03/05/13 artifacts) | Pass |
| Nested Target draft Escape over inspector; nested Delete Escape | Both modes separately, including required nested320touch | Target123.45 draft closes only Target with focus to Add Target, parent retained. Delete closes only confirmation, focuses actions, parent retained and Groceries still exists after reload | S/escape-* and S/retry2/escape-* (09–12) | Pass |
| Open CategoryPicker/Command Escape while dirty5.00 | Both modes separately | First Escape closes picker, retains selected Coffee/5.00 and inspector; next Escape clears Move and focuses From | S/escape-* and S/retry2/escape-* (06–08) | Pass |
| Held submitted Groceries→Coffee10; Swap/type7 before result | 320×640 actual touch | Existing Convex sync boundary hold, not backend fake. Status names original10/direction,7 draft retained. Clear retains truthful submitted status, does not claim cancellation. Groceries−1000c/Coffee+1000c/RTA unchanged, independently asserted after reload | S/held-touch (before-submit,held-new-draft,submitted-status-new-draft,clear-keeps-truth,reload-exact-money) | Pass |
| U3 chosen Group Add/new Group inside Add Category; inline Category/Group rename; inspector rename/regroup | 320×640 actual touch | Savings Goals preselected, UI names saved/reloaded; new Group+Category together; both renamed/reloaded; inspector rename then Move to Savings Goals retains inspector/focus; second Categories view confirms resulting Category | S/retry1/organize-touch | Pass |
| U4 exact June→July→Categories→Back | 320×640 actual touch, keyboard Enter to save | June2027 Assigned111.11 survives reload; July222.22 then Categories→Back restores July heading/URL/222.22; Forward Categories | S/history-touch | Pass |
| Bounded large money and long name in dark | 390×640 actual touch | UI-created long Groceries name,999999.99 saved/reloaded; full money assertions/right-edge assertions passed. Group labels wrap heavily in this stress state; see minor N1 | S/retry1/layout-long-dark-touch | Pass with minor |

Initial organizing harness used a region named after its heading while Rename temporarily removed that heading; the field existed in the ARIA but the named-region locator no longer matched. Initial layout helper matched both Budget and Upcoming tables. These are retained failed harness attempts, superseded by stable inspector-id and first Budget-table selectors, then fresh reseed/replays. They are not silently counted as app failures or passes. Four maintained journeys and every supplemental named task ultimately passed its assertions. Final replay also checked Clear with an actual refusal and real viewport/hit-test reachability. No full keyboard completion is inferred from touch or vice versa.

## Findings and prior dispositions

| ID | Severity / disposition | Repro / expected vs observed / impact | Evidence |
| --- | --- | --- | --- |
| sol-a-A1 (own prior) | Minor correction request; **fixed and verified** | Previously320touch focused dirty Amount Escape emptied draft then closed inspector. Final revision keeps inspector, clears choice/amount/refusal, focuses picker; next clean Escape returns Groceries. Explicit Clear equivalent. No money write. Disposition based on source ce0dad7 plus fresh mode-specific checks, not repair self-report | S/escape-touch; S/retry2/escape-touch; M/inspector/move-money; source-diff.patch |
| sol-a-R3-N1 | **Minor, follow-up; does not block approval** | At390dark with persisted999999.99 and long name, Group labels wrap into many short lines, increasing vertical scanning/scrolling. All money digits remain readable, names remain present, controls remain usable, no right-edge clipping. This extreme-state visual density merits later refinement with the tested money envelope preserved. Not a new source regression; unchanged layout is independently observed here rather than erased by carry-forward | S/retry1/layout-long-dark-touch/03-reload-dark-viewport.png and04-width-390-viewport.png plus full PNG/ARIA |

No open blocker or major. Prior A1 is the only correction request in my own previous full report; no other judge's localized findings are dispositioned by this report. The earlier crowded RTA concern remains answered by actual visible digits, not promoted to clipping. N1 is accepted as a bounded minor follow-up; a later implementation would require its own affected check.

## Rubric assessment

| Dimension | Score /10 | Evidence supporting judgment |
| --- | --- | --- |
| Task completion and trust | 9 | Exact independent money effects/reload retained and freshly checked, no writes from resets/dismissal;26 outcomes covered through explicit own carry-forward plus new checks. |
| Discoverability and language | 9 | From/To/search, concise routine copy and consequential guidance remain clear; submitted status explicitly describes original amount/direction. |
| Efficiency and control | 9 | Phone reset now preserves inspection context; direct assignment, creation, renames and regrouping reduce navigation; clean Escape still closes deliberately. |
| Feedback and recovery | 9 | Refusal→clear/focus works in both modes; new draft survives submitted Move and Clear makes no false cancellation claim; retained retry/failure evidence remains valid. |
| Accessibility and input | 9 | Fresh desktop Tab/Enter and actual touch plus keyboard Escape; picker/Target/Delete top-layer dismissal, useful focus return, reachable active fields and controls; own prior full keyboard/filter/split and touch reorder evidence explicitly retained. |
| Responsive layout and visual clarity | 9 |320 inspector focus/control reach and pinned header clear;390dark full money visible after persistence; prior multi-width proof applies. N1 is localized heavy label wrapping under extreme money width, not hidden money or an inaccessible control. |

**Separate overall judgment: 9/10.** The central budgeting and repeated-entry tasks are clear, efficient and trustworthy within this explicitly measured scope. The prior recovery defect is resolved on the actual final revision, and dependent nested controls do not regress. The overall judgment is not an arithmetic average or a carried prior score. The bounded layout follow-up is minor and does not compromise financial readability/task completion.

**Verdict: APPROVE 417d273986dc93485e7e762a32ed3efed964b20f.** Full assigned scoped coverage is accounted for using own prior equivalent-source evidence and fresh required affected tasks. No open major/blocker and no required unverified gap. This is only sol-a's approval; no assertion that the three-judge gate has passed, no assumed approval or averaging.

External/unverified limits remain: physical phone/native gestures/installation, live Plaid, owner production authentication, provider sign-in completion, and phone amounts above tested999999.99 through server-admitted maximum. Browser touch is not external hardware proof. Existing Convex transport holds are labeled and do not prove external provider behavior. No universal amount-range readability claim.

## Principles, evidence and cleanup

Experience First kept the review focused on continuity/recovery and real touch organizing, rather than green-journey inference. Prove It Works and Test Behavior Not Implementation required user controls, independently fixed money deltas, truthful announcements and reload/second-view proof. Separate Before Serializing Shared State required own checkout/backend/auth and serial drivers/reseeds; the failed startup was cleaned before retry. Guard the Context Window constrained reads to neutral scope and own report. Laziness Protocol kept source unchanged and restricted new files to ignored review evidence. Build the Lever produced the retained rerunnable manual artifact. No production test seam or tracked tests were introduced.

Both owned startup attempts ended with `bun run app down` exit0. All Playwright contexts/traces/browser closed in finally, unused shared-preview tab closed. Final app down exited0; running.json absent; HEAD unchanged exact final SHA; git status --porcelain empty. No other checkout backend was driven, seeded or stopped. No active review browser/app remains; **ownership released**.

After teardown, **164 nonempty PNGs,123 nonempty ARIA snapshots,15 nonempty trace ZIPs** retained across M/S, including initial harness failures and corrected replays. Traces sanitized using S/sanitize-traces.py: storage-state/cookie/header/auth fields removed recursively, network records blanked, non-image network resources removed. Post-sanitization assertions checked these exclusions in all15 traces. DOM/actions/screenshots remain; full raw network replay intentionally unavailable. Private login remains outside evidence; screenshots contain synthetic app data only. Lifecycle and results remain nonempty after cleanup.
