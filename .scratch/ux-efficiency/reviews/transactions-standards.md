# Transaction efficiency — Standards, test audit, corrections

Reviewed revision: `c7d354b665c0925988af44229a925cf029c6ec20`.
Comparison: `git diff --no-ext-diff 96d902f...c7d354b` (one implementation commit).
Read-only review; this report is the only file written by the reviewer.

## Standards summary (under 400 words)

**One P2 documented-standard violation, in test synchronization; no production-code violation found.**

- **P2 — Await register results before capturing the baseline.** `e2e/journeys/search.ts:94–107`: after choosing Any Category, the new journey immediately saves `everyDate`. The shared `choose` helper (`e2e/journeys/journey.ts:6–11`) waits only for the picker to close. Register queries are asynchronous and sequential (`transaction-table.svelte:181–207`); neither closing the picker nor its new label establishes that the unrestricted rows have rendered. The snapshot can contain the prior Gifts result or an empty intermediate list. The out-of-range precondition can then fail despite correct behavior, or the final clear comparison can wait for the wrong baseline. The range predicate at lines 104–107 also accepts an empty transient list before a separate non-retrying length check. Wait for an independently known unrestricted result, and poll nonemptiness and the date constraint together. **Rule:** test-audit `references/proof.md`, Boundary and cost: “Await observable completion rather than sleeps or action returns”; also Prove It Works, check the actual value. This is a static synchronization finding, not a browser-reproduced failure.

**Judgment-call smells:** none worth requesting a change. Reusing CategoryPicker for Payees is an intentional established primitive choice recorded in the ticket, so its name alone is not a Mysterious Name finding. Date choices derive from one registry; the draft reset reuses its existing owner; the focused reveal helper hides a real focus transition rather than speculative generality. No ADR conflict found.

Tooling-enforced rules were not relisted as findings. Three-judge review and full integration checks remain parent gates, explicitly pending in the ticket.

## Changed-test authoring audit

- **Date presets** (`src/lib/transactionFilters.test.ts:80–134`): retain. Concrete month/year rollover, leap-year and inclusive 30-day expectations are literals independent of the subject. Credible regressions include subtracting 30 rather than 29 days, wrong month-end clamping, overwriting Payee/Search, or treating one-sided dates as an existing preset. The `dateRangeOf` assertion follows independently verified From/To output, so this is not an ungrounded round-trip test. Both functions have production callers in transaction-filters.svelte. No test-only production exports or hooks added.
- **search/filters**: retain searchable Category and Payee interactions. Keyboard search, exact-Payee URL identity versus free-text `q`, and resulting register rows establish a distinct UI/transport contract that date unit tables do not cover. Retain preset wiring coverage, with the P2 synchronization repair above. Date helper reuse is acceptable here because fixed unit tables independently own arithmetic; this journey owns wiring and results.
- **search/phone**: retain. Accessible names, the combined date-filter count, URL removal, next-chip/last-chip focus and 320px overflow are observable contracts. They do not pin a private chip builder or component tree.
- **transactions/add-another**: retain. Driving held real responses through the UI, then observing one persisted row, retained Account/date, cleared amount/Payee/memo/Category, saved memo on edit, and independent balance differences covers lifecycle/persistence risk. This is distinct from ordinary create and late-save: successful save keeps the dialog open and creates another draft. No mock supplies the asserted persistence. A forced click on a disabled button does not isolate the explicit saving guard, but the test claims user-visible duplicate prevention, which the disabled controls can legitimately provide.
- **splits/restart and splits/lines**: retain. They check optional-field visibility/focus, saved line memo contents, and a fresh split's empty fields at the user boundary. Existing fixture memos are external expected data, not subject-generated expectations.
- **payees/transfers and existing transaction/split journeys**: exact Save locators and Add memo actions adapt existing proof to new user controls. These do not introduce duplicate owner regressions.

The original pre-implementation red run is reported by the implementor but was not replayed in this review. No baseline or browser execution claim is made here.

## Analysis-only /correct

### Recurring class: treating a filter action as completed register rendering

At least two actual historical occurrences qualify:

1. `789022e` (2026-11-11), transactions/approve-all-undo: clearing Search then immediately reading Unapproved rows captured an empty list in CI. The repair introduced `allUnapproved`, polling rendered row count before taking the snapshot.
2. `b1d8bdf` (2026-11-13), transactions/select-categorize: after Search changed to Warehouse, selecting the Split raced the old selection scope. The repair waits for the bookshop row to disappear before selecting.

The new `search.ts:94–95` repeats the same unsupported assumption. These are two distinct historical repairs plus this candidate; not merely two copies from one hunk.

**Strongest proportionate enforcement:** behavior-level readiness at the register journey boundary. Let each journey specify its independently expected result (or an unambiguous result-transition sentinel), then await it before snapshotting or acting on the rows. For this ticket, capture the unrestricted date baseline only after an expected unrestricted row set is visible, and poll the nonempty date-range result as one assertion. A small shared assertion can own the waiting if multiple callers migrate together; do not add a generic settle timer or a production-only-for-tests readiness flag.

**Why higher levels do not eliminate the class:** asynchronous queries are required product behavior; architecture cannot make all UI actions synchronous. Types cannot infer whether a particular visible row belongs to the latest query. A blanket lint against evaluateAll/raw DOM reads would reject valid stable snapshots and still miss premature actions. The observable expected result supplies the missing semantic fact; an agent rule alone supplies no enforcement.

**Past-mistake proof required if accepted:** replay the old `789022e^` raw-read sequence under a held Transactions response and show it captures the incomplete result; the readiness assertion must wait until release and then capture the complete independently expected set. Replay the old `b1d8bdf^` search/selection sequence with a held narrowing response and show the new boundary waits until the old row leaves. Use existing held-response machinery and real UI results, not helper-call assertions. No check was added or replayed by this read-only review; the proposal requires Opus's decision and implementation. Existing historical commits show these readiness conditions repaired their respective sequences, but do not prove a proposed new helper.

No second correction class is proposed: existing DialogSession handling and focus-return ownership are already structurally enforced; this diff follows them. Avoid inventing a new abstraction from a single instance.

## Evidence, checks, limits

- Sources read in full: AGENTS.md, CLAUDE.md, docs/agents/domain.md, GLOSSARY.md, ADRs 0002/0003; spec and ticket 02; code-review, test-audit and its proof/audit references, correct; principles README, laziness-protocol, experience-first, test-behavior-not-implementation, prove-it-works, encode-lessons-in-structure, guard-the-context-window, model-the-domain, boundary-discipline, type-system-discipline, minimize-reader-load. No source or test changes made; no further delegation.
- `bun run test src/lib/transactionFilters.test.ts src/lib/transactionEditor.test.ts src/lib/domain/dates.test.ts scripts/app/featureMap.test.ts`: **4 files, 100 tests passed, 722ms runner duration**. Checkout had no running app. Shared HEAD advanced during review from c7d354b to documentation-only 4e2ce7d; `git diff --quiet c7d354b --` across all executed test files and their reviewed production owners passed, confirming those sources were unchanged.
- `git diff --no-ext-diff --check 96d902f...c7d354b`: passed.
- No sync/typecheck, app lifecycle, browser, full-suite, or judge work run. Existing implementor browser evidence was treated as a record, not independently reverified. The P2 race is not experimentally reproduced here.
- Principles that changed choices: **test-behavior-not-implementation** retained persisted rows/balances and memo/focus tests rather than demanding internal guard assertions; **prove-it-works** identified the unawaited snapshot and limits the verification claim; **encode-lessons-in-structure** required two actual historical examples and favors an observable readiness boundary over another instruction; **laziness-protocol/model-the-domain** rejected speculative new picker/reset abstractions; **guard-the-context-window** bounded history to the affected journeys and owners.
- Unresolved: Opus disposition of P2 and the correction proposal; fresh browser reproduction/verification and integration gates remain with the parent.
