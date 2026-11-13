# 10: Make three-judge UI review a maintained repository workflow

**Status:** done

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
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.


## Comments

Implemented 2026-11-12; authorized documentation-only work, ready for parent integration. No push, merge, PR, UI implementation, or live data operation performed.

Decisions and changed files:

- Added `docs/quality/ui-review/README.md` (authoritative protocol), `rubric.md` (dimensions, severity examples and scoring anchors), and `report-template.md` (independent reports, dispositions, final-SHA approvals and cleanup). Kept the proposed location.
- Added the short shipping trigger in `AGENTS.md`. `CLAUDE.md` contains only Convex guidance and does not mirror the agent workflow; no change needed.
- Linked the first-use spec and ticket 11 to the protocol; ticket 11 now carries scope/acceptance rather than a second procedure.
- Corrected all twelve active ticket footers to reflect implementation authorization on 2026-11-12 while retaining concrete live-repair approval. The historical ticket-plan and bank-sync review records remain untouched.
- Verified `scripts/app/{verify,seed,lock,down}.ts` against verify-budge: each journey reseeds, lifecycle locks do not isolate browser sessions, and teardown retains evidence. Parallel judges get separate checkout/backend ownership; a single checkout requires sequential sessions and release. Lifecycle/auth instructions remain owned by verify-budge.

Checks:

- Read ticket 10, domain/glossary, issue/triage guidance, required principles, writing-for-agents and verify-budge. Manually mapped every Acceptance item to the protocol, rubric or template; walked ticket 11's setup/report/recheck path without relying on scratch history.
- All 25 relative documentation links resolve; template links also resolve from `.scratch/first-use-ux/issues/`. Checked agent discoverability, dimension coverage, independent overall scores, final revision, finding dispositions, gaps and session cleanup fields.
- `bun install --frozen-lockfile` passed. Initial format/commit attempt exposed missing worktree dependencies/Lefthook; installed dependencies, reran the complete pre-commit checks, then amended the implementation commit with hooks active. No hooks bypassed.
- `bunx lefthook run pre-commit --all-files` passed: Prettier, ESLint, UI lint and redacted staged gitleaks. `bun run format:check`, focused Prettier check, and `git diff --check` passed. Redacted gitleaks over `5a3bc8b^..HEAD` passed (two commits at initial review).
- No tests added/changed: test-audit authoring gate and changed-test runtime do not apply. No app feature changed, so no running-app round, feature-map update or UI judging round was required. No fabricated browser proof, scoring engine or new framework introduced.

Local code-review (`5a3bc8b^..HEAD`, including the published tickets), independent fresh-context Sol high Standards and Spec axes:

- Standards P2: copied-template links broke outside their source directory — fixed with links valid at both prescribed locations; verified both resolutions.
- Standards P3 / Spec P3: competing/unlinked review instructions in the first consumer — fixed with spec/ticket 11 links and removal of ticket 11's procedural copy. Historical ticket-plan is intentionally unchanged.
- Spec P2: active ticket footers still imposed planning-only restrictions — fixed across all twelve executable tickets; concrete live-repair approval remains required.
- Standards judgment call: repeated shared testing gates — answered/deferred. They predate this implementation and match the approved publication plan's self-contained ticket format. Consolidating that broader testing policy is outside this UI-review extraction; reusable UI-review rules now have one owner.
- Spec confirmed every published ticket body/dependency/proof matched the ticket-plan before these deliberate maintenance corrections. No missing ticket 10 Acceptance requirement or scope creep found. Parent verified decisive findings and fixes directly; no unresolved review blocker remains.

Principles that changed choices:

- Laziness Protocol / Minimize Reader Load: one maintained protocol with a short agent trigger; remove the first consumer's procedure copy and avoid an invocation wrapper.
- Encode Lessons in Structure: judgment-based gate encoded in explicit report fields, severity examples and a final-revision approval table rather than a fake scoring automation.
- Prove It Works: check actual CLI source, link resolution and the copied-template destination; distinguish docs proof from unrun browser proof.
- Separate Before Serializing Shared State: use separate worktrees/backends or exclusive sequential sessions, rather than treating browser contexts as isolation.

Remaining handoff: parent fast-forwards these documentation commits to main. Integration-stage `/correct` analysis belongs to the parent after landing; no production/UI suggestion was implemented here. Ticket 11 is the first real UI use of the maintained workflow. No unresolved implementation questions.

### Corrections (`/correct`, Sol analysis; Opus decisions)

1. Incomplete review provenance (bank-sync rounds 1–2 lack per-judge SHA, coverage, evidence): **no change.** The new report template already requires these fields; a field validator would reward filled-in prose without proving a judge observed the app.
2. Copied review procedure (bank-sync spec, first-use ticket plan, pre-`bff5319` ticket 11): **no change.** `bff5319` already made the protocol the one owner; prose-similarity checks would reject legitimate scope and miss paraphrase.
3. Approval freshness (round 12 fixes after approval): **declined.** One documented risk, not two incidents; the protocol already requires approval on the final reviewed SHA.
