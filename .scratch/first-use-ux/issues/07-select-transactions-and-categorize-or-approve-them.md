# 07: Select Transactions and categorize or approve them together

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 05, 06 — reuse the picker and deliberate memory behavior.

Deliver: select individual Transactions across Payees and subsets within a Payee. Clearly show the selection/count and affected rows. Apply a Category, approve, or categorize-and-approve; saving a Category alone does not approve. Provide undo that restores the affected Category/approval state without overwriting subsequent unrelated changes. A bulk Category action must not silently change remembered defaults. Do not treat all selected Transactions as one Transfer; exclude or explain unsupported/locked rows before changing anything. Search/filter changes must never silently expand a selection to unseen rows.

Proof: the bulk-write owner is primary for exact persisted selection scope, approval choices, restrictions, memory side effects, and undo. Browser proof covers selecting a noncontiguous subset, filter/selection behavior, using the shared picker, and invoking undo, including a phone path. Extend existing approval/undo proof instead of cloning it. Do not create a production export solely to reach selection internals from tests.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Ticket 12 describes future shipping work; this conversation is still drafting tickets, not executing a PR, merge, deployment, or live repair.
