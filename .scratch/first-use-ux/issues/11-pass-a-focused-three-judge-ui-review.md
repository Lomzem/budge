# 11: Pass a focused three-judge UI review

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 01–10 — use the maintained workflow to review the complete first-use UX on one integration revision after feature checks and corrections.

Deliver: complete the maintained three-judge UI review for the agreed first-use and review journeys: start-this-month onboarding, Account/balance confidence, repair preview/confirmation on synthetic data, searchable inline Category/Transfer choices, explicit Category memory, multiple selection, Payee groups, undo, and Sync feedback. Evaluate desktop, keyboard, and phone behavior, including the narrow phone layout. Keep the scope on these journeys and their dependencies.

Acceptance: the maintained protocol's final-revision approval gate passes for this complete focused scope. Record each judge's independent report, evidence, and the disposition of every finding using its template. Opus owns UI/production fixes; Sol coordinates reviews.

Proof: use verify-budge with synthetic fixtures and managed authenticated sessions. The judges' browser observations and reports are the acceptance evidence; retain the deterministic tests' separate role. Pass any new regression tests through test-audit; use existing journeys rather than creating duplicate suites for individual judges.

Workflow: use the [maintained protocol](../../../docs/quality/ui-review/README.md), its rubric, and its report template. This ticket supplies the first-use scope; the maintained protocol owns the reusable review and session rules.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.
