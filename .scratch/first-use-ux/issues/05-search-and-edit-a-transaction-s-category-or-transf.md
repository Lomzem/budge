# 05: Search and edit a Transaction's Category or Transfer in place

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: choose a Category directly in the register without opening the full dialog, by typing to search. Include Ready to Assign with Categories and Transfer-to-Account choices in a separate section. The dialog uses the same searchable choice where applicable. Preserve existing Transfer linking and Starting Balance restrictions; do not add fuzzy vendor detection. Work deposits, transfers between budgeted Cash Accounts, and card payments retain their existing distinct accounting treatment. Support keyboard and phone use.

Proof: the primary new contract is the browser interaction through search, select, save, and reload, including keyboard and phone reachability. Reuse existing income/Transfer accounting tests. Add a delayed-response case only for a distinct save lifecycle risk, not as another replay of accounting. Use supported UI primitives; resolve any repository Select restriction coherently, without bypassing lint broadly.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.
