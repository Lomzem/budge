# 02: Confirm Account setup and explain balance uncertainty

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: after connecting, the user can check where each bank account goes, correct a mapping/type choice through supported flows, and establish its Starting Balance before being directed to categorize. A short unresolved problem remains visible; details explain available bank/Transaction inputs and their limitations. Never call a connection or a derived estimate proof of a correct balance. Missing freshness or history coverage is unknown, not invented evidence. Keep the date and long explanations in the decision/details flow.

Proof: extend account-setup journeys for the distinct incomplete/confirmed presentation and correction path. Existing balance/suggestion owner proof remains primary for arithmetic. Extend fixed bank-fixture cases at that owner only if a missing/partial-data contract is absent. Do not replay the same arithmetic in browser assertions.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.
