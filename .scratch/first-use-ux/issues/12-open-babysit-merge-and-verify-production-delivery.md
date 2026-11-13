# 12: Open, babysit, merge, and verify production delivery without CodeRabbit

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 11 — all feature tickets, corrections, and final three-judge approvals must be complete before delivery.

Deliver: Sol opens the one integration PR into main, with the full feature scope and verification evidence, and follows it through CI, merge, and production deployment. Read the current PR workflow and repository deployment instructions before acting. For this first-use UX spec, the user's explicit instruction overrides the normal CodeRabbit requirement: DO NOT invoke CodeRabbit, request its review or approval, or wait for it as a merge gate. Do not weaken the policy for unrelated work or change repository-wide configuration just to implement this exception. Automatic CodeRabbit reviews are currently disabled; recheck that no action inadvertently opts this PR into a review.

Acceptance:

- Complete required local checks, review, corrections, and fully redacted secret checks before commit/push. Open the PR as a draft while preparing it, then mark ready when evidence is complete. Link the PR in the host immediately after creating it or pushing to it.
- On the latest PR head, every applicable CI job and test passes: generated-code freshness, formatting, lint, UI lint, typecheck, unit/integration tests, secret scanning, import capacity, and authenticated Playwright E2E. Missing, failed, canceled, or unexpectedly skipped tests are not passes. Resolve failures without bypassing tests or hooks. Route production/UI fixes to Opus; re-run the focused judge gate when a material UX change invalidates approval.
- Babysit through the event-driven PR watcher while checks are pending, address actionable results, and verify gates against the current head before merging. No CodeRabbit request or approval is required for this spec. Keep human-requested or other applicable review findings resolved under the remaining repository rules.
- Verify the PR actually merged into main and record the resulting commit. Track the production deployment associated with that commit through a terminal outcome, including the frontend build and its coupled Convex deployment. Do not treat merge, a started build, or a preview deployment as production success.
- Vercel's documented production build deploys Convex and builds the SvelteKit app using the target URL. Confirm the production target before deployment-affecting actions, follow deployment guards within the user's shipping authority, keep credentials redacted, and never seed/reset real budget data. Do not execute the user's separate start-date/data repair as an incidental deployment step.
- Babysit failures through diagnosis, repair, and a subsequent successful deployment. Check the deployed version and perform a read-only production smoke of sign-in, navigation, and changed UI availability; report any live verification blocked by access. Do not use synthetic reseeding verification against production or mutate the user's budget to demonstrate success.
- Report the PR, merged commit, final CI state, frontend/backend deployment evidence, and production smoke results. Stop reporting completion until the relevant deployment is actually healthy. If external access blocks progress, report the specific blocker rather than claim success. Remove any active PR watch before final handback.

Proof: reuse deterministic CI and the focused judge evidence rather than authoring another duplicate test suite for the release ticket. Deployment evidence must be tied to the merged commit and observed production result. Use the deployment provider's event-driven monitoring when supported; do not infer success from a successful local build.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.
