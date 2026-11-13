# 04: Apply a confirmed start-date repair safely

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 03 — consume a reviewable repair proposal.

Deliver: a user can confirm the previewed change and get consistent Transactions, Starting Balances, and budget totals. Reject a stale preview rather than applying unreviewed effects. Interruptions/retries must not duplicate work; preserve Transfer integrity and respect reconciliation rules. Provide and verify a recovery path. Another sync must not reintroduce excluded history. Inspect the actual user's setup and prepare its November repair, but do not execute a live repair without approval of the concrete preview and recovery plan.

Proof: the repair owner is primary for before/after persistent accounting state, stale-preview rejection, and repeat/interruption safety using synthetic data. Reuse monthly-cache consistency proof rather than duplicate its implementation. Add one distinct sync-boundary regression for excluded history only if current sync proof does not cover the changed boundary. A browser journey proves preview-to-confirm completion and recovery access, not every accounting permutation. Actual account correctness requires checking actual inputs separately; fixture tests cannot certify it.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Ticket 12 describes future shipping work; this conversation is still drafting tickets, not executing a PR, merge, deployment, or live repair.
