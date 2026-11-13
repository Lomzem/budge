# Ticket 04 review — c4ed731..1f16135

Verdict: changes requested. No production files changed. Review ran at 1f16135 in the supplied worktree. The requested `/tmp/claude-1000/-home-lomzem-proj-budge/35d35561-c3a7-4b79-a12a-2870181ceaa7/scratchpad/review-brief.md` does not exist; its additional instructions could not be followed. This review uses the user brief, ticket 04 and its binding Comments, the spec, glossary, ADR 0002 and repository instructions. No further delegation.

## Findings

### P1: Undo silently overwrites changes to the Starting Balance

`convex/lib/laterCutover.ts:347–359` checks kind, Account, date, amount and whether the row is Reconciled. `undoLaterCutover` then replaces the whole row with `before` at lines 328–336. Changes to Category, memo, approval and Cleared state all pass the guard and disappear. A Category edit affects accounting, not just presentation.

Reproduced through public functions: start September with Checking 10,000 cents; record October outflow 1,000; preview/apply November 1; edit the resulting 9,000-cent Starting Balance using `transactions.update`, or use `setCleared`/`unapprove`; Undo succeeds and overwrites each edit. Four independent cases assert refusal and fail because no error is returned. Compare the complete post-apply fields that Undo would overwrite, or preserve allowed subsequent fields explicitly. Keep the check scoped to those rows so unrelated later edits continue to work.

### P2: Sync discards bank modifications during the recoverable move

`convex/lib/transactions.ts:703–709` puts folded Bank Rows through ordinary delete's bank-memory path. That path is safe for permanently deleted Transactions, but not for Transactions that Undo may resurrect. In `convex/bankConnections.ts:905–912`, a mapped Bank Row without a Transaction and without state `held` causes `changeHeldRow` to return true without applying the incoming modification. The sync cursor advances. `restoreEarlierHistory` then reattaches the stale Bank Row (`transactions.ts:752–753`).

Reproduction uses the production sync commit boundary `internal.bankConnections.apply`, with synthetic connection setup, and public preview/apply/undo/list: import October 15 outflow −1,000; move to November 1; receive modification of the same source ID to November 3, −1,500; sync returns `applied`; Undo. The restored Transaction and Bank Row both still report −1,000 and the Bank Row remains `linked`, with no bank-change flag. The bank correction has been consumed and lost. The modified date is after the new cutover, so normal exclusion of old history does not justify dropping it. Preserve these bank updates while recovery is possible and either surface the conflict after Undo or refuse Undo precisely. A dedicated move→sync→Undo regression is warranted; ordinary permanent-delete dedup proof misses this lifecycle.

## UI intermittency investigation

Normal maintained `app verify` run passed `bank-changes/take-the-banks`, `transfers/import-link`, and `settings/later-move`. Evidence: `../verify-budge/t04-review-1/summary.json` and each journey's screenshots, ARIA snapshots and trace.

A serial repeat of the existing bank-change journey with 800 ms of incoming WebSocket response latency completed its functional assertions and failed the existing layout observer. Form controls moved 198 px when the bank-change banner disappeared/reappeared, and register rows moved 125 px. Evidence: `latency-clean.log`, `latency-clean/bank-changes/take-the-banks/`, rerunnable `latency-journeys.ts`. No application behavior or responses were fabricated; only delivery was delayed.

These are real geometric movements, but the observer's attribution is too broad to call all of them unprompted defects. `e2e/journeys/layoutShift.ts` excludes only 500 ms after input. A user-requested deletion or resolution completing later is consequently labelled "without user input". Register rows moving after deleting a row is expected behavior. The clean evidence establishes response-time-sensitive reporting; a passing fast rerun is insufficient to dismiss the concern. Stabilize transient dialog content where needed, and distinguish movement caused by a pending user operation from unrelated background/loading movement. Do not disable the whole observer or add a generic wait.

Under 800 ms latency, `transfers/import-link` instead consistently hits an earlier readiness race: the Account is already selected, so the journey chooses its file before the dialog's settings query finishes. The dialog displays **Set the cutover date before importing** even though a cutover exists. Evidence: `latency-transfer/transfers/import-link/failed.aria.yml`, `failed.png`, `transfer-probe.log`. The input is enabled while `cutoverDate` is temporarily null (`import-dialog.svelte:92–94`, 170–176); the journey checks only Account selection. This is pre-existing and outside this diff. It prevents reproducing the original import-preview shift in this clean slow run, so that exact failure remains unclassified without its original failing trace. The original failed full-run traces were not found in this worktree; copied `t04-ui-10` is passing evidence only.

CPU 6x alone: bank-change journey passed; Transfer journey hit a navigation/File locator timeout. Not counted as an accounting failure or as proof of the original layout issue.

An initial concurrent capacity/browser attempt was invalidated by a shared-backend collision and excluded from conclusions (`capacity.log`, `latency-journeys.log`). The serial `latency-clean` and `latency-transfer` probes ran after that attempt ended.

## Other checks and conclusions

- Existing owner/sibling suites: settings, monthlyTotals, imports, bankChanges and owned-writes configuration — **105 tests passed**, 2.38 s. `owner-tests.log`.
- New adversarial probe: **13 cases, 8 passed, 5 failed** (four Starting Balance overwrites plus the lost bank modification), 0.742 s. `adversarial-tests.log` and `repro.test.ts`.
- Passing additional cases: Undo preserves an unrelated November Transaction and November Assigned amount; Checking independently totals 8,679 cents afterward; kept monthly totals equal a rebuild. Undo refuses an older move after a second move, including after the second move is undone.
- Six independent server-clock cases pass: UTC−12/UTC+14 date endpoints and just-outside refusal around November month rollover/fall DST and spring DST. These exercise public apply against a pinned server clock. The numeric UTC envelope is independent of DST; no local-time conversion is used there.
- Existing settings tests cover atomic stale-preview rejection, reconciled unlock, repeat confirm, repeat Undo, Transfer relinking, split restoration and cache rebuilding. Convex's single mutation transaction serializes confirm with competing writes; no intermediate committed fold exists. This review did not simulate real concurrent OCC retries in convex-test.
- Changed accounting writes are in `convex/lib/transactions.ts` and `convex/lib/monthlyTotals.ts`; Starting Balances use `saveStartingBalance`. No owned-write bypass found. `git diff --check` passed; tracked working tree unchanged.
- Actual owner November repair remains unprepared, as the ticket acknowledges. Synthetic checks do not certify the owner's inputs. No production access or live repair was attempted.

## Recommendations

1. Add the AGENTS.md enforced-rules row for the atomic cutover bounds and `capacity:check`, using the writing-for-agents pass. The constants and capacity harness already share `LATER_CUTOVER_READS`.
2. Extend `settings/later-move` to **perform** confirm and Undo at 320 px (and 390 px), rather than resize after a desktop move. The two-line moved row is known; the existing journey cannot prove that the move avoids a phone layout shift or that the controls remain reachable during it.

## Re-running the accounting reproduction

From the checkout root, copy `test-results/cutover-review/repro.test.ts` to `convex/review-cutover.test.ts`, run `bun run test convex/review-cutover.test.ts`, then remove the temporary file. It imports only existing test helpers and production public/internal API references, with no production seams. The five failures are expected on 1f16135. No repair was implemented, so post-fix green proof remains for the implementer.

## Principles applied

- **Make Operations Idempotent:** checked repeated confirm/Undo and the second-move lifecycle, beyond the happy path.
- **Separate Before Serializing Shared State:** assessed apply's atomic mutation and redo dependencies; excluded the accidental shared-backend experiment and reran browser evidence serially.
- **Boundary Discipline:** drove accounting behavior through registered APIs, with synthetic external bank events at the existing sync commit boundary.
- **Foundational Thinking:** inspected recovery's stored data against every field/link it must restore; this exposed the incomplete Starting Balance post-image and bank-memory lifecycle mismatch.
- **Fix Root Causes:** traced the lost bank modification to deletion-memory semantics and layout reporting to its 500 ms attribution rule rather than calling rerun success proof.
- **Prove It Works / Test Behavior, Not Implementation:** used independent amounts and post-state, kept a reproducible failing artifact, and distinguished synthetic proof from actual owner-data correctness.

## Final capacity and cleanup

The serial `bun run capacity:check` passed, including both cutover shapes: `test-results/capacity/2026-11-13T20-48-03.843Z/summary.json` reports `check.passed: true`, `check.cutover.passed: true`, and 106.3048 seconds. Apply's maximum reproduced 2,641 index ranges and 15,575 documents read; the starting-balance Undo used 2,335 index ranges. The cutover shapes are under the hard limits but not under half (`belowHalf: false`); this is consistent with the recorded bounds, not a newly demonstrated capacity failure. `restore.json` records exit zero and original environment restored. `capacity-serial.log` retains the measurements.

`bun run app down` exited zero. Browsers were closed in `finally`. Retained screenshots, ARIA evidence, test logs and report are nonempty. `git status --short` is empty; no tracked changes or temporary `convex/review-cutover.test.ts` remain.
