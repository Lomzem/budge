# 11: Pass a focused three-judge UI review

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 01–10 — use the maintained workflow to review the complete first-use UX on one integration revision after feature checks and corrections.

Deliver: two independent GPT-6.1-Sol reviewers at high reasoning effort and one independent Opus 5.5 reviewer each use a fresh context and drive the running app. Focus on the agreed first-use and review journeys: start-this-month onboarding, Account/balance confidence, repair preview/confirmation on synthetic data, searchable inline Category/Transfer choices, explicit Category memory, multiple selection, Payee groups, undo, and Sync feedback. Evaluate desktop, keyboard, and phone behavior, including the narrow phone layout. Do not turn the review into an unrelated whole-app redesign.

Acceptance: each of the three judges independently scores the focused UX at least 9/10 on the same final reviewed revision. An average of 9 is insufficient. Record revision, exercised journeys/viewports, evidence, scores, and findings. Address every finding with a fix, evidence-backed answer, or reasoned deferral; no unresolved blocking or major finding may remain. Opus owns UI/production fixes; Sol coordinates reviews. Re-run affected checks after fixes and commission independent re-checks of the resulting revision until all three judges pass. Re-review any material later change before shipping; do not use stale scores as approval.

Proof: use verify-budge as the real-app verification path with synthetic fixtures and managed authenticated sessions. The judges' browser observations and reports are the acceptance evidence, not substitutes for deterministic tests. Pass any new regression tests through test-audit; do not create three duplicate E2E suites to mirror three judges. Use the native/T3 delegation rules and verify requested model availability when executing; do not silently substitute reviewers.

Repository precedent: the bank-sync UX spec's completion gate names two Sol (high) reviewers and one Opus reviewer, all at 9/10 or above. Its review-round-12 record explicitly ends the loop at three independent scores of 9, with no blocker or major problem. This ticket reuses that gate with a focused scope.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Ticket 12 describes future shipping work; this conversation is still drafting tickets, not executing a PR, merge, deployment, or live repair.
