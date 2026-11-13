# 10: Make three-judge UI review a maintained repository workflow

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None — repository documentation work can proceed independently of the UX implementation.

Deliver: give the three-judge review a dedicated, maintained home outside scratch planning. Provide one authoritative protocol, a concise shared scoring rubric, and a review-report template. Add a short, explicit discovery pointer in the repository's agent instructions for when a user-facing flow change reaches its final review gate. Feature specs supply the scope and journeys; they reference the protocol rather than copying its rules. Preserve existing code-review, test-audit, and verify-budge roles. This is repository development tooling/documentation, not an in-app screen.

Acceptance: the workflow defines the two independent Sol high reviewers and one Opus 5.5 reviewer, fresh contexts, real-app inspection, scope setup, rubric dimensions with concrete examples of a blocker/major problem, separate scores, at least 9/10 from every judge, and the fix/re-check loop on the final revision. Reports identify the reviewed revision, exercised tasks/viewports, evidence, scores, and disposition of findings. Material changes invalidate the affected approval. Unavailable reviewers or unverified behavior remain explicit gaps; no silent model substitution or manufactured scores. Apply the workflow to user-facing flow changes before shipping; documentation-only work does not require a UI judging round. Define managed app/session ownership so independent judges do not reseed or shut down another judge's environment. Keep raw browser evidence and secrets out of maintained prose. Preserve old completed scratch reviews as historical records.

Proof: check documentation links, discoverability from the agent instructions, and template coverage. Ticket 11 is the first real use of the extracted workflow and must be runnable from the maintained documents without recovering essential rules from scratch history. Do not introduce source-grep tests, a fake scoring engine, a review dashboard, or a new automation framework to prove a documentation change. Use writing-for-agents when authoring the maintained instructions. Follow the repository's documentation-only commit/review policy when executing this maintenance ticket.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Ticket 12 describes future shipping work; this conversation is still drafting tickets, not executing a PR, merge, deployment, or live repair.
