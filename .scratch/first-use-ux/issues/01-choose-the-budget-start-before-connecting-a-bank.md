# 01: Choose the budget start before connecting a bank

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: a fresh user sees the first of this month as the proposed start, can choose another valid date, and connects/imports against the saved boundary. Pre-start bank history does not become a review backlog. The routine Account view gains no persistent start-date label. Reuse current date enforcement and import filtering rather than adding a parallel concept.

Proof: the primary new contract is the onboarding journey's default, save, and import handoff, including month-boundary behavior under a controlled clock. Existing import-owner tests retain responsibility for filtering before the boundary. Add filtering cases only for an independently missing contract.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.
