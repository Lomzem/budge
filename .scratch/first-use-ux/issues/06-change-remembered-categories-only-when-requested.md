# 06: Change remembered Categories only when requested

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 05 — adds the explicit remember choice to the new editing interaction.

Deliver: a one-off Category edit changes that Transaction only. An explicit separate remember choice sets the Payee's Category for later imports. Future imports remain reviewable. Apply the same meaning to existing edit paths so the result does not depend on which control was used. Keep current remembered choices usable. Make selection of a default deliberate when first categorizing a new Payee; do not silently treat every edit as a new default.

Proof: extend the production owner test sequence: set remembered Category, edit an exception, import again; then explicitly change the remembered Category and import again. Assert real imported/persisted outcomes with independent expected Categories. Browser proof owns the explicit choice and save interaction; it does not repeat the import-owner matrix.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.
