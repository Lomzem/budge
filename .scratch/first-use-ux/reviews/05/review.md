# Ticket 05 review

Reviewed `27af6a5...5e037bf` at `5e037bf6dfb3e6e4d26f00af33f458e260975ee4`, against the ticket, Comments, spec, repository standards and downstream tickets 06–08. Analysis only; no production edits or commits. Both review axes ran inline because the brief forbids further delegation.

## Standards

No separate documented-standard violations found. Authentication, owned writes, supported UI primitives and customized-component lint ownership are preserved. The two row render sites share one snippet rather than duplicating behavior. Findings: **0**.

## Spec

**P1 — an older Transfer lookup can overwrite a newer saved Category.** `src/lib/components/transactions/transaction-table.svelte:374–380`. On an imported Cash outflow, choose Transfer: Savings while `transferCandidates` is delayed, then choose Groceries. Groceries saves. If the old query subsequently returns no candidates, execution falls through to `categorize` without checking `latestPick`. The old Transfer writes last, removing the Payee and creating its counterpart; the guard after the mutation cannot undo that write.

Fix: await the candidate decision into a local, check the generation unconditionally, then branch into dialog handoff or mutation. Extend the lifecycle journey with this preflight-delay ordering; keep the existing delayed-mutation case because it protects a different boundary. Findings: **1**, worst **P1**. Ticket should return for correction.

Verification: **browser-reproduced and persisted after reload**, using `bank-sync` and SAMPLE PET SUPPLY 0311. Reproducer: `test-results/ticket-05-review/race.ts`; output: `race.log`. Screenshots and ARIA: `test-results/verify-budge/ticket-05-review-race/`. Earlier attempts exposed fixture/locator mistakes; the final run uses a stable Transaction-ID locator.

## Test audit

Keep the public mutation tests (approval/field preservation, endpoint wiring and restrictions), direction-choice table, search/save/reload journey and delayed-response journey. They exercise observable contracts without test-only production seams. Existing accounting tests remain the accounting owner. The delayed-response test starts after a mutation is sent, so misses the P1's candidate-query boundary. The phone step changes viewport only: coarse-pointer focus and an actual on-screen keyboard remain unverified. Historical red/green claims were read, not independently replayed. Changed-test baseline runtime was unavailable.

## `/correct` — analysis only

Recurring class: async completion escapes the interaction that initiated it. Evidence: fixes `ab7211c` (held Account) and `b9de9c4` (rename/other dialogs), plus the current row preflight gap. Highest useful enforcement: **architecture**—give the row operation one continuation after preflight, with one generation gate before either side effect. Retain completion guards for writes already sent. A result-only `DialogSession.run` wrapper around the whole operation would still permit the stale write inside it. Types cannot encode response order. Concrete proof target: the retained race script must stop producing a Transfer after Groceries saves; the current code provides the failing case. No broader framework or additional instruction is warranted.

## Open questions and downstream seams

1. **Keep the shared snippet's two instances for now.** CSS removes one trigger from layout/accessibility. A single instance is preferable if the register layout is rebuilt, but this ticket supplies no measured cost justifying that rework. Check resize-with-popup-open when changing layout.
2. **Accept the difference.** The row preserves amount/sign; the dialog edits them. In fact `transactionEditor.ts:344–345` already sets the valid card-payment direction on selection; the premise that it only refuses on Save is incomplete. Keep server validation.
3. **Keep tap-to-search on coarse pointers.** Preserve list space and immediate hardware-keyboard search. Real-device keyboard usability still needs evidence.

The seams support additive work: ticket 06 must make memory policy explicit at the write owner (`rememberPayee` still runs); ticket 07 should compose writes atomically with undo and omit Transfers from bulk choices; ticket 08 can retain Transaction-ID keyed row state. None requires replacing `CategoryPicker`. These are planned changes, not missing ticket-05 requirements.

## Checks and principles

99 focused tests passed in 1.25 s: Transactions, Transfers, monthly totals, authorization, editor and feature map. ESLint, UI lint, typechecks and diff whitespace passed. Seven verify-budge journeys passed: `transactions/{categorize,categorize-late}`, `transfers/{import-link,pair}`, `payees/last-category`, `splits/lines`, `accounts/start-edit`. Evidence: `test-results/verify-budge/ticket-05-review/summary.json`. Full `bun run check`, full E2E, historical baseline probes and three-judge shipping review were not rerun. All browsers closed; `bun run app down` passed; retained evidence is nonempty. No tracked files changed.

Prove It Works/Build the Lever prompted a reproducible browser race script. Test Behavior separated query ordering from accounting proof. Laziness/Experience First kept responsive-layout rework out of scope. Encode Lessons in Structure informed the single continuation recommendation; Model the Domain/Boundary Discipline kept memory and bulk policy at the writer.
