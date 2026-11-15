# Integration Standards, test audit and correction dispositions

Reviewed `git diff 6bdc864...d824517`, with repair focus `git diff f821979...17bbcc5`. Initial HEAD was clean `d8245171b198249209fd73c2f3d77bd7f8db8122`; final shared HEAD advanced to `6f4fe2f` through a state-record-only commit. `git diff --quiet d824517 HEAD -- src e2e scripts/app/featureMap.test.ts vite.config.ts package.json` passed: reviewed and executed subjects stayed identical. No source edits, app/browser operations, full suite, sync, commits or further delegation. This report is the only file written.

## Standards (under 400 words)

**Request changes: two P2 ownership defects and one P3 coverage-description correction. Tooling-enforced rules excluded.**

1. **P2 — A failed rename can displace another row's newer editor.** `src/lib/components/categories/inline-name.svelte:51–54` unconditionally writes `editing = true` after failure. Categories binds every editor to one shared `renaming` ID (`src/routes/(app)/categories/+page.svelte:61–68`). Submit A, begin typing an unsubmitted name in B, then let A fail: A's binding selects A and removes B's editor, losing B's draft/focus. The per-component `latest` counter cannot see the newer interaction in B. **Rules:** Model the Domain's lifecycle ownership; Experience First's error-state/core-loop details. The repair must preserve the current editor while reporting A's failure. This is a source finding, not browser reproduction.

2. **P2 — Another pointer's cancellation ends the owned drag.** `src/lib/reorder.ts:137–138,163–164` wires both cancellation events to unconditional `end()`, although move/drop correctly compare `pointerId`. While pointer 1 drags, a second pointer down is ignored; its cancellation on the same handle nevertheless releases pointer 1 and silently loses its eventual drop. An actual-attachment event probe reproduced this; control commits index 2, foreign cancellation commits nothing. **Rules:** Model the Domain's ownership of lifecycle state; Experience First's touch-interaction details. Filter event cancellation by the owning pointer; keep explicit Escape/disposal cancellation unconditional.

3. **P3 — Feature-map prose overstates maintained coverage.** `.agents/skills/verify-budge/features/categories.md:23` attributes a 390px touch drag and cancellation/lost-capture/Escape/leave checks to `categories/reorder`. That journey uses 320px until its desktop step and contains successful drags only. Interruption evidence came from deleted scratch probes. **Rules:** Prove It Works' direct, repeatable evidence and AGENTS.md's maintained feature-map verification path. Correct the viewport and distinguish manual/probe evidence from retained journey assertions.

**Judgment-call baseline smells:** none independently warrants change. Shared Target assignment and InlineName remove duplication; local snapshot and focus helpers hide real responsibilities. No repo-overridden smell, ADR conflict, speculative generic framework, or additional tooling finding reported.

## Decisive evidence and repair status

### Prior findings

- **S1, late success / same editor:** `inline-name.svelte:33–41` initializes only when entering editing, and `untrack` avoids pending/name subscriptions. Success clears pending without replacing an active draft. `categories.ts:394–423` now holds a real response, types an unsubmitted draft, lands the old response, observes the server-backed handle and checks draft/focus. The later two-submitted-save case remains. This repairs the original success defect, but does not cover the failed-save/cross-row case above.
- **S3, submitted snapshot:** `add-category-dialog.svelte:67–81` captures both names before `dialog.run`; both mutations and the retained Group label use that snapshot. `categories/manage` holds Group creation, changes the Category field, then reloads and expects the original submitted name. A separate real whitespace rejection proves Group-success/Category-failure retry produces one Group and its Category. No successful persistence is fabricated by mocks.
- **S2, owned interruption:** `reorder.ts:79–90,166–173` now cancels its frame, removes Escape handling, releases capture and clears transforms/dragging on own cancellation/disposal. Pointer up alone commits. Edge movement uses page coordinates and rAF scroll; a stationary initial pointer cannot activate scrolling. Foreign cancellation remains unfiltered.
- **S4, intended guard and exact money:** `categories.ts:132–147` fills a valid Category Name before submitting an empty Group name and checks the intended field's `valueMissing`, plus neighboring Name validity. `inspector.ts:175–191` independently reads negative Available, requires exact negated prefill, zero recipient balance and donor decrease by exactly that shortfall. The deletion step now reads both Activities and requires their exact sum at Coffee after reload.
- **S5, month/focus:** `budget.ts:242–315` explicitly drives the shown year, checks its first-year bound, and uses June next year for Left/Down/Enter. January–March no longer request another year's absent button; February no longer starts Left on January. `month-picker.svelte:44–56` returns focus only when closed and avoids overriding focus already inside the reopened grid. Retained journey checks immediate reopened-grid movement; no fresh browser claim here.
- The Target table's overspent exclusion is gone (`budget-table.svelte:77`). The destination Group expansion owner is present (`+page.svelte:138–154`), with a collapsed-destination journey assertion.

### Actual production-attachment probes

Ran Bun with `--no-env-file`, importing `reorderHandle` itself. An EventTarget/HTMLElement adapter supplied row geometry, pointer capture and a controllable frame queue; it supplied no reorder/cancellation decisions. Three rows at y=100/140/180, height 40: down pointer 1 at 120, move pointer 1 to 210, then the listed interruption and up pointer 1:

| Interruption | Capture 1 before its up | Move callbacks | Frames after up | Remaining transforms/dragging |
| --- | --- | --- | --- | --- |
| None | true | `[2]` | 0 | none |
| Pointer 1 cancellation | false | `[]` | 0 | none |
| Down 2, cancellation 2 | false | `[]` | 0 | none |
| Down 2, lost capture 2 | false | `[]` | 0 | none |
| Detach | false | `[]` | 0 | none |

A second probe confirmed foreign move/up preserve pointer 1's capture. With height 640 and start y=500, one frame while stationary scrolls 0; move the owned pointer to 590 and one frame scrolls 14; detach leaves zero scheduled frames, no move callback and no transforms. This is bounded event/disposal proof, not physical touchscreen or browser proof. The foreign lost-capture case is a handler-level input probe; no claim that the adapter reproduces browser capture generation.

## Changed-test authoring audit

All changed test owners were inspected against test-audit's observable contract, credible regression, strongest boundary and production-caller gates. No test-only production seam or new implementation-grep test found.

| Owner | Contract retained / audit outcome |
| --- | --- |
| `transactionFilters.test.ts` | Literal inclusive date, leap-year and year/month rollover expectations; other filters preserved. Independent pure arithmetic owner, production callers present. Retain. |
| `search/filters`, `search/phone` | Searchable exact identities, preset wiring/results, chip removal/URL/focus and overflow. `datesOnceListed` now requires a known non-Gifts sentinel and an out-of-range row before baseline capture; final range assertion requires nonemptiness and bounds together. Distinct transport/UI risk from date unit tables. Retain. |
| `transactions/add-another` | Held real response, disabled controls, one saved row per Payee, clean draft, Account/date retention, saved memo and independent balance deltas. Retain; forced click proves user-visible prevention, not the private guard in isolation. |
| `splits/restart`, existing split/payee/transfer journeys | Visibility/focus and persisted memo expectations; exact Save selectors adapt existing flows. Retain; no new duplicate persistence suite needed. |
| `categories/manage`, `categories/late-rename` | Real server refusal/retry, submitted input ownership, rename persistence and same-row late-success preservation. Retain; add one failed-save ownership regression for finding 1. |
| `categories/reorder` | Keyboard boundary/focus, CDP touch to an offscreen destination, mouse drag, exact persisted order and Budget order. Retain. Cancellation/disposal regressions are not retained here; the handler probe catches finding 2. Extend the existing owner rather than duplicating the reorder algorithm. |
| `budget/month-jump`, `budget/phone-groups` | Calendar-independent interior keyboard movement, first-year bound, reload/focus; direct Assigned edit and exact Ready to Assign delta; collapse preserves prior displayed totals and exact independently counted overspent rows. Preservation comparison is meaningful. Retain. |
| `inspector/move-money`, `inspector/cover-and-manage`, `targets/monthly` | Exact money effects, intended negative field, history destination, collapsed-group focus and table Target funding/persistence. Retain. |

Recorded artifacts were checked directly: `red-originals.log` shows the old typed draft replaced, mutable submitted Category name consumed, offscreen touch destination unreachable and collapsed destination staying closed. `red-mutations.log` shows required-field removal failing the intended Group-name step and excess cover failing `5421` versus `5521`. `search-p2-probe.log` records an empty premature snapshot versus 53 converged rows and the old vacuous predicate. `probe-red.log`/`probe-green.log` record focus-loss rounds 4→0 and stationary edge scroll 235→0. These are prior implementor artifacts, not executions by this reviewer; their deleted scratch sources limit independent rerunning. `final-e2e.log` records 61 passes; `final-check.log` ends with capacity refusal, not an all-green check. Parent owns fresh browser/capacity/judge gates.

## /correct disposition audit

**C1: local state ownership is the right level, partially repaired.** Inspected actual historical diffs: `9db39a9` scopes pending Assigned settlement to a save ticket; `92837d3` checks the latest row pick immediately after the asynchronous lookup, before either outcome. These are two occurrences of the class. Immutable submitted inputs and editor-entry initialization are proportionate local fixes; a generic asynchronous framework would duplicate DialogSession without expressing shared Categories editor ownership. The remaining failed-save path still needs the current editor owner's decision. Historical parent/fix browser pairs were not replayed here; do not claim they were.

**C2: semantic readiness at the existing journey boundary is proportionate.** Inspected `789022e` waiting for all expected Unapproved rows before capture and `b1d8bdf` waiting for the old Bookshop to leave before selecting a narrowed Split. The current sentinel and simultaneous nonempty/range predicates address the same mistake without timers, production flags, broad source lints or a new framework. Exact monetary expectations and valid neighboring inputs repair tests rather than adding duplicate layers. The existing `settled` helper in Categories is one animation frame after an independently observable server-backed rename; it does not establish register convergence and must not be copied as such.

Same-opening Group reuse/retry is now proven at its public boundary. Crash/reload between Group and Category creation is outside that guarantee; the spec does not establish a new backend atomicity requirement. No new global rule or additional correction class is justified from this bounded review.

## Checks and principles

- `bun run test src/lib/transactionFilters.test.ts src/lib/transactionEditor.test.ts src/lib/domain/dates.test.ts scripts/app/featureMap.test.ts`: **4 files, 100 tests passed; 710ms runner duration, 1.35s command wall time**. No tests edited and no measured cost change claimed.
- `git diff --no-ext-diff --check 6bdc864...d824517`: passed.
- Two bounded production-attachment probes: passed execution; foreign cancellation reproduced the defect above.
- Applied code-review Standards and test-audit skills; read their full instructions/references, the analysis-only correct skill, required principles, AGENTS/CLAUDE/domain/issue-tracker guidance, glossary, all ADRs, spec, ticket 03 and prior reviews. Prior transaction report copies were byte-identical.
- **Model the Domain / Experience First** exposed ownership that the per-instance ticket and unconditional cancellation do not protect. **Test Behavior, Not Implementation / Prove It Works** retained public persistence/monetary proof, checked real attachment behavior and separated artifacts from fresh browser evidence. **Encode Lessons in Structure / Laziness Protocol / Minimize Reader Load** supported local ownership and semantic journey preconditions over a new framework or source lint. **Guard the Context Window** kept review on the pinned source, bounded history and focused checks.

Unresolved: findings 1–3; retained failure/interruption owner proof; final pinned browser/judge coverage and required full-check completion remain with the parent. This review does not approve shipping or certify rendered UI behavior.
