# Spec review — UI audit repairs

Pinned `0b01f27128641020e4091cfe1fa3b8885d0a93db`; reviewed `git diff caa9d25...0b01f27` (repair cherry-pick of `420daed`).

**No confirmed missing/wrong requirement or unasked scope change in this repair diff. Source review passes; rendered approval remains a separate gate.** Spec: all 26 outcomes, especially “Preserve money semantics…keyboard access, focus return” (spec.md:9), month heading/arrows/cutover (:24), and independent UI judging (:52).

Decisive evidence:

- Ticket 06:5 requires returning to the last viewed month after reload→change→Categories→Back. `src/lib/keepInUrl.ts:7` uses `goto` with replaceState/keepFocus/noScroll; Budget keeps explicit month parsing and current-month parameter removal (`src/routes/(app)/+page.svelte:43–60`). Store cutover/arrows remain unchanged. `e2e/journeys/budget.ts:322–365` exercises the June→July bug’s sequence using August→September, saves a different Assigned, checks Back/Forward, and checks August’s distinct Assigned. This does not introduce month-by-month history entries. Transactions uses the same helper; `search.ts:167–191` checks actual Payee results after return.
- Budget’s own container controls stacked versus separate Available (`budget-table.svelte:95–111`), retaining collapse totals/cues, direct Assigned/Target and Group creation. `budget.ts:370–425` asserts one visible Available/Group value and checks clipping at 320/390/1024/1280. The always-present desktop aside provides the constrained table width; these assertions alone cannot certify readability.
- `button.svelte:25,32` distinguishes the Target shortcut’s existing 24px visible/44px coarse-pointer hit area from Group +’s new 44px coarse-pointer box. `transaction-dialog.svelte:234–239` focuses the surviving adjacent split Category; the journey checks last-line removal only.
- `category-inspector.svelte:128–171,432–529` adds successful Move/Cover status and Clear/dirty-form Escape while retaining explicit From/To, searchable picker, validation and clean Escape. Other numbered outcomes and requested copy are not removed.

**Limit:** ticket 06:29 acknowledges larger valid amounts can cut on phones; ADR 0003 permits $10B. The spec establishes no $999,999.99 product limit. This repair proves only its sampled envelope; record the remaining readability risk explicitly, without calling it a newly introduced restriction or borrowing UI proof.

**Checks:** focused Vitest: 2 files/7 tests passed (1.39s): URL-import policy and feature-map contracts. The supplied E2E file is excluded by Vitest; no browser journey ran here. No app, full suite, source edits or commits.

**Principles:** Experience First and Prove It Works kept rendered approval pending; Test Behavior separated journey assertions from execution; Laziness Protocol and Guard the Context Window kept review scoped.

