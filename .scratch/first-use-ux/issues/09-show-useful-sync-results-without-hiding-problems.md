# 09: Show useful Sync results without hiding problems

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: keep a concise Transactions-added count, including an honest zero result. Keep other diagnostic counts in details. Distinguish a sync with rows waiting for Account setup from a finished import, and preserve busy/failure/reconnect problems. A successful sync does not certify a balance. Use counts from the actual run, not total Transactions or the review backlog.

Proof: extend the existing outcome/report owner with independently defined outcomes: additions, zero additions, held rows, busy/failure as appropriate. Browser proof only for the distinct placement/action path needed to resolve waiting setup. Preserve existing sync integration proof for actual run counts and add a missing case at that owner only if necessary; do not mock a formatter and then claim sync arithmetic was tested.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Ticket 12 describes future shipping work; this conversation is still drafting tickets, not executing a PR, merge, deployment, or live repair.
