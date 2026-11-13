# First-use UX: proposed ticket breakdown

Published as `issues/01`–`12` on approval by `/implement`. The issue files are authoritative; this file is the historical breakdown.

Source: the first-use UX planning interview and its spec. Existing production/UI architecture and implementation ownership remains with Opus. Sol owns ticket preparation, fact-finding, and review.

## Proposed vertical slices

### 01: Choose the budget start before connecting a bank

Blocked by: None.

Deliver: a fresh user sees the first of this month as the proposed start, can choose another valid date, and connects/imports against the saved boundary. Pre-start bank history does not become a review backlog. The routine Account view gains no persistent start-date label. Reuse current date enforcement and import filtering rather than adding a parallel concept.

Proof: the primary new contract is the onboarding journey's default, save, and import handoff, including month-boundary behavior under a controlled clock. Existing import-owner tests retain responsibility for filtering before the boundary. Add filtering cases only for an independently missing contract.

### 02: Confirm Account setup and explain balance uncertainty

Blocked by: None.

Deliver: after connecting, the user can check where each bank account goes, correct a mapping/type choice through supported flows, and establish its Starting Balance before being directed to categorize. A short unresolved problem remains visible; details explain available bank/Transaction inputs and their limitations. Never call a connection or a derived estimate proof of a correct balance. Missing freshness or history coverage is unknown, not invented evidence. Keep the date and long explanations in the decision/details flow.

Proof: extend account-setup journeys for the distinct incomplete/confirmed presentation and correction path. Existing balance/suggestion owner proof remains primary for arithmetic. Extend fixed bank-fixture cases at that owner only if a missing/partial-data contract is absent. Do not replay the same arithmetic in browser assertions.

### 03: Preview a later budget start without changing data

Blocked by: 02 — use its Account/balance evidence in the repair preview.

Deliver: for an existing September-start budget, selecting November produces a read-only preview of the affected Transactions, proposed Starting Balances, budget effects, and what must be resolved before it can proceed. Cancel changes nothing. Do not assume the demo seed caused the user's problem. Unsupported or unverifiable cases produce a specific explanation rather than guessed balances. No pre-start archive feature is required.

Proof: the preview owner, exercised through its real public boundary with synthetic persisted Accounts/Transactions, proves independently expected effects and unchanged state. The browser journey proves date entry, readable preview, and cancel behavior without duplicating the numerical case matrix. This ticket is independently demoable as a read-only assessment.

### 04: Apply a confirmed start-date repair safely

Blocked by: 03 — consume a reviewable repair proposal.

Deliver: a user can confirm the previewed change and get consistent Transactions, Starting Balances, and budget totals. Reject a stale preview rather than applying unreviewed effects. Interruptions/retries must not duplicate work; preserve Transfer integrity and respect reconciliation rules. Provide and verify a recovery path. Another sync must not reintroduce excluded history. Inspect the actual user's setup and prepare its November repair, but do not execute a live repair without approval of the concrete preview and recovery plan.

Proof: the repair owner is primary for before/after persistent accounting state, stale-preview rejection, and repeat/interruption safety using synthetic data. Reuse monthly-cache consistency proof rather than duplicate its implementation. Add one distinct sync-boundary regression for excluded history only if current sync proof does not cover the changed boundary. A browser journey proves preview-to-confirm completion and recovery access, not every accounting permutation. Actual account correctness requires checking actual inputs separately; fixture tests cannot certify it.

### 05: Search and edit a Transaction's Category or Transfer in place

Blocked by: None.

Deliver: choose a Category directly in the register without opening the full dialog, by typing to search. Include Ready to Assign with Categories and Transfer-to-Account choices in a separate section. The dialog uses the same searchable choice where applicable. Preserve existing Transfer linking and Starting Balance restrictions; do not add fuzzy vendor detection. Work deposits, transfers between budgeted Cash Accounts, and card payments retain their existing distinct accounting treatment. Support keyboard and phone use.

Proof: the primary new contract is the browser interaction through search, select, save, and reload, including keyboard and phone reachability. Reuse existing income/Transfer accounting tests. Add a delayed-response case only for a distinct save lifecycle risk, not as another replay of accounting. Use supported UI primitives; resolve any repository Select restriction coherently, without bypassing lint broadly.

### 06: Change remembered Categories only when requested

Blocked by: 05 — adds the explicit remember choice to the new editing interaction.

Deliver: a one-off Category edit changes that Transaction only. An explicit separate remember choice sets the Payee's Category for later imports. Future imports remain reviewable. Apply the same meaning to existing edit paths so the result does not depend on which control was used. Keep current remembered choices usable. Make selection of a default deliberate when first categorizing a new Payee; do not silently treat every edit as a new default.

Proof: extend the production owner test sequence: set remembered Category, edit an exception, import again; then explicitly change the remembered Category and import again. Assert real imported/persisted outcomes with independent expected Categories. Browser proof owns the explicit choice and save interaction; it does not repeat the import-owner matrix.

### 07: Select Transactions and categorize or approve them together

Blocked by: 05, 06 — reuse the picker and deliberate memory behavior.

Deliver: select individual Transactions across Payees and subsets within a Payee. Clearly show the selection/count and affected rows. Apply a Category, approve, or categorize-and-approve; saving a Category alone does not approve. Provide undo that restores the affected Category/approval state without overwriting subsequent unrelated changes. A bulk Category action must not silently change remembered defaults. Do not treat all selected Transactions as one Transfer; exclude or explain unsupported/locked rows before changing anything. Search/filter changes must never silently expand a selection to unseen rows.

Proof: the bulk-write owner is primary for exact persisted selection scope, approval choices, restrictions, memory side effects, and undo. Browser proof covers selecting a noncontiguous subset, filter/selection behavior, using the shared picker, and invoking undo, including a phone path. Extend existing approval/undo proof instead of cloning it. Do not create a production export solely to reach selection internals from tests.

### 08: Work through repeated Payees as groups

Blocked by: 07 — grouping builds on individual selection and bulk actions.

Deliver: review Transactions grouped by their existing Payee identity, inspect dates/amounts, and select a group or exceptions. Retain individual and cross-Payee selection; the Payee is not forced into one Category. Validate the interaction against the repeated-vendor task before settling layout. Do not merge names or change stored Payee identity as a side effect of grouping.

Proof: one browser-owned mixed-purpose Payee scenario proves group membership, subset exclusion, and reuse of selection. Ticket 07 owns the write/undo contract; do not repeat its API matrix. A grouping unit test needs a distinct independent contract, not a mirrored inventory of rendered rows.

### 09: Show useful Sync results without hiding problems

Blocked by: None.

Deliver: keep a concise Transactions-added count, including an honest zero result. Keep other diagnostic counts in details. Distinguish a sync with rows waiting for Account setup from a finished import, and preserve busy/failure/reconnect problems. A successful sync does not certify a balance. Use counts from the actual run, not total Transactions or the review backlog.

Proof: extend the existing outcome/report owner with independently defined outcomes: additions, zero additions, held rows, busy/failure as appropriate. Browser proof only for the distinct placement/action path needed to resolve waiting setup. Preserve existing sync integration proof for actual run counts and add a missing case at that owner only if necessary; do not mock a formatter and then claim sync arithmetic was tested.

### 10: Make three-judge UI review a maintained repository workflow

Blocked by: None — repository documentation work can proceed independently of the UX implementation.

Deliver: give the three-judge review a dedicated, maintained home outside scratch planning. Provide one authoritative protocol, a concise shared scoring rubric, and a review-report template. Add a short, explicit discovery pointer in the repository's agent instructions for when a user-facing flow change reaches its final review gate. Feature specs supply the scope and journeys; they reference the protocol rather than copying its rules. Preserve existing code-review, test-audit, and verify-budge roles. This is repository development tooling/documentation, not an in-app screen.

Acceptance: the workflow defines the two independent Sol high reviewers and one Opus 5.5 reviewer, fresh contexts, real-app inspection, scope setup, rubric dimensions with concrete examples of a blocker/major problem, separate scores, at least 9/10 from every judge, and the fix/re-check loop on the final revision. Reports identify the reviewed revision, exercised tasks/viewports, evidence, scores, and disposition of findings. Material changes invalidate the affected approval. Unavailable reviewers or unverified behavior remain explicit gaps; no silent model substitution or manufactured scores. Apply the workflow to user-facing flow changes before shipping; documentation-only work does not require a UI judging round. Define managed app/session ownership so independent judges do not reseed or shut down another judge's environment. Keep raw browser evidence and secrets out of maintained prose. Preserve old completed scratch reviews as historical records.

Proof: check documentation links, discoverability from the agent instructions, and template coverage. Ticket 11 is the first real use of the extracted workflow and must be runnable from the maintained documents without recovering essential rules from scratch history. Do not introduce source-grep tests, a fake scoring engine, a review dashboard, or a new automation framework to prove a documentation change. Use writing-for-agents when authoring the maintained instructions. Follow the repository's documentation-only commit/review policy when executing this maintenance ticket.

### 11: Pass a focused three-judge UI review

Blocked by: 01–10 — use the maintained workflow to review the complete first-use UX on one integration revision after feature checks and corrections.

Deliver: two independent GPT-6.1-Sol reviewers at high reasoning effort and one independent Opus 5.5 reviewer each use a fresh context and drive the running app. Focus on the agreed first-use and review journeys: start-this-month onboarding, Account/balance confidence, repair preview/confirmation on synthetic data, searchable inline Category/Transfer choices, explicit Category memory, multiple selection, Payee groups, undo, and Sync feedback. Evaluate desktop, keyboard, and phone behavior, including the narrow phone layout. Do not turn the review into an unrelated whole-app redesign.

Acceptance: each of the three judges independently scores the focused UX at least 9/10 on the same final reviewed revision. An average of 9 is insufficient. Record revision, exercised journeys/viewports, evidence, scores, and findings. Address every finding with a fix, evidence-backed answer, or reasoned deferral; no unresolved blocking or major finding may remain. Opus owns UI/production fixes; Sol coordinates reviews. Re-run affected checks after fixes and commission independent re-checks of the resulting revision until all three judges pass. Re-review any material later change before shipping; do not use stale scores as approval.

Proof: use verify-budge as the real-app verification path with synthetic fixtures and managed authenticated sessions. The judges' browser observations and reports are the acceptance evidence, not substitutes for deterministic tests. Pass any new regression tests through test-audit; do not create three duplicate E2E suites to mirror three judges. Use the native/T3 delegation rules and verify requested model availability when executing; do not silently substitute reviewers.

Repository precedent: the bank-sync UX spec's completion gate names two Sol (high) reviewers and one Opus reviewer, all at 9/10 or above. Its review-round-12 record explicitly ends the loop at three independent scores of 9, with no blocker or major problem. This ticket reuses that gate with a focused scope.

### 12: Open, babysit, merge, and verify production delivery without CodeRabbit

Blocked by: 11 — all feature tickets, corrections, and final three-judge approvals must be complete before delivery.

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

## Shared testing gate for every published ticket

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Ticket 12 describes future shipping work; this conversation is still drafting tickets, not executing a PR, merge, deployment, or live repair.

## Principles that changed the breakdown

- Sequence Verifiable Units: separate read-only repair preview from applying the change; every ticket has a demoable completion boundary.
- Laziness Protocol: reuse existing date, accounting, Transfer, and approval owners; no speculative scaffold or fuzzy matching ticket.
- Test Behavior, Not Implementation: assign proof to the production owner and reserve browser proof for interaction/transport/lifecycle differences.
- Minimize Reader Load / writing-for-agents: keep the reusable judging protocol in one maintained home and point to it from agent instructions; feature plans provide scope rather than duplicate the protocol.

## Proposed permanent review area

Recommend `docs/quality/ui-review/` for the protocol, scoring rubric, and report template, with a short pointer from `AGENTS.md`. These are proposed locations for ticket 10, not files created during this planning task. Runtime evidence stays in the existing managed verification artifact area. Completed scratch review records remain historical evidence rather than the workflow's source of truth. A dedicated invocation skill can be considered later if the protocol alone proves hard to invoke; no extra wrapper is required initially.

## Next step

The user added a maintained home for three-judge review outside scratch. There are now twelve proposed slices: ticket 10 extracts the reusable workflow, ticket 11 applies it to this UX, and ticket 12 ships without CodeRabbit. The original granularity/dependency review remains open. Per to-tickets, publish one local ready-for-agent issue per approved slice only after approval. Do not change the parent spec as part of publication.
