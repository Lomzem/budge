# 03: Preview a later budget start without changing data

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 02 — use its Account/balance evidence in the repair preview.

Deliver: for an existing September-start budget, selecting November produces a read-only preview of the affected Transactions, proposed Starting Balances, budget effects, and what must be resolved before it can proceed. Cancel changes nothing. Do not assume the demo seed caused the user's problem. Unsupported or unverifiable cases produce a specific explanation rather than guessed balances. No pre-start archive feature is required.

Proof: the preview owner, exercised through its real public boundary with synthetic persisted Accounts/Transactions, proves independently expected effects and unchanged state. The browser journey proves date entry, readable preview, and cancel behavior without duplicating the numerical case matrix. This ticket is independently demoable as a read-only assessment.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Ticket 12 describes future shipping work; this conversation is still drafting tickets, not executing a PR, merge, deployment, or live repair.
