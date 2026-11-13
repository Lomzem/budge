# 08: Work through repeated Payees as groups

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 07 — grouping builds on individual selection and bulk actions.

Deliver: review Transactions grouped by their existing Payee identity, inspect dates/amounts, and select a group or exceptions. Retain individual and cross-Payee selection; the Payee is not forced into one Category. Validate the interaction against the repeated-vendor task before settling layout. Do not merge names or change stored Payee identity as a side effect of grouping.

Proof: one browser-owned mixed-purpose Payee scenario proves group membership, subset exclusion, and reuse of selection. Ticket 07 owns the write/undo contract; do not repeat its API matrix. A grouping unit test needs a distinct independent contract, not a mirrored inventory of rendered rows.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.
