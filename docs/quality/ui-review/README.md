# Three-judge UI review

Use this protocol before shipping a user-facing flow change, after feature checks and corrections. Documentation-only changes do not require a UI judging round. Feature specs define scope and journeys and link here for the gate. This protocol owns the review process; [the rubric](rubric.md) owns scoring and [the report template](report-template.md) records each round.

This gate complements local code-review (standards and spec), test-audit (test quality), and [verify-budge](../../../.agents/skills/verify-budge/SKILL.md) (running-app verification). Keep their required checks. A judge's score is experiential evidence, not a replacement for deterministic tests or shipping requirements.

## 1. Prepare one review brief

The coordinator records the following in a report copied from the template into the feature's issue directory:

- Exact clean commit SHA, spec/ticket links, intended user outcomes, in-scope entry points and tasks, and explicit exclusions.
- Affected verify-budge feature IDs and named journeys, synthetic fixtures and any extra setup, expected outcomes, and checks/corrections already completed. Identify external behavior the environment cannot exercise.
- Desktop 1280×800 and narrow phone 320×640, keyboard tasks, and additional sizes/states relevant to the change (for example 390 px phones, long names, empty/loading/error states, or light/dark themes).
- Environment assignment and session schedule from the ownership rules below; each judge's separate report destination.

The brief is ready when every scoped outcome has an exercisable task or an explicit verification gap. Keep scope focused on the changed flow and its dependencies; record unrelated redesign ideas as follow-ups.

## 2. Commission independent judges

Commission two independent **GPT-6.1-Sol reviewers at high reasoning effort** (Sol A and Sol B) and one independent **Opus 5.5 reviewer**. Check requested model availability using the current native/T3 delegation rules. If a reviewer is unavailable, record that slot as blocked; seek an explicit user decision rather than silently substituting a model or inventing a score. The gate remains incomplete.

Give each judge a fresh context with the same brief, this protocol, rubric, template, and applicable repository instructions. Each judge inspects the real app and submits their own findings and score before seeing other judges' reports, scores, or the implementer's preferred assessment. A re-check also uses a fresh context; include neutral reproduction steps and dispositions for that judge's affected findings, without other judges' verdicts. Judges review rather than implement; route UI/production fixes to Opus and review coordination to Sol.

### App and session ownership

Use verify-budge for all launch, authentication, readiness, evidence, and cleanup steps. Assign exclusive checkout ownership **before launching**:

- For parallel inspection, provision one separate worktree at the pinned revision per judge through the supported orchestration path. Each judge owns that checkout's local backend, browser context, login state, and evidence directory. Follow verify-budge's port-collision recovery if concurrent startups collide.
- With only one checkout, schedule judges sequentially. The next judge starts only after the previous judge closes the browser, runs their own cleanup, retains evidence, and releases ownership. Start a fresh authenticated browser context and independently initialize the next session using verify-budge.

Two browser contexts against one backend are not isolation. Both `app seed` and `app verify` reset backend data; verify reseeds before **each journey**. The CLI's lifecycle lock serializes lifecycle commands, not whole browser sessions. A `.local-app/running.json` belonging to another run is an ownership conflict: coordinate release or use another checkout. Never reseed or stop that environment. Only the run that started an app cleans it up, including on failure. Record release before handing the checkout to another judge.

## 3. Inspect and report

Each judge runs selected maintained journeys, then manually drives scoped tasks those journeys leave out, using verify-budge. Observe user controls, feedback, persistence, keyboard/focus behavior, phone reachability, and the rubric dimensions. A screenshot or a successful automated journey alone cannot establish ease of use.

Submit a separate report with exercised tasks/viewports, observed outcomes, evidence references, severity and reproduction steps for each finding, gaps, dimension assessments, and an overall score with reasons. Use `unverified` for behavior that could not be exercised. Required unverified behavior blocks approval; scores for partial coverage must be labeled provisional.

Keep raw screenshots, ARIA snapshots, traces, and downloads in the private/local evidence locations required by verify-budge. Maintained protocol/rubric/template files contain rules and synthetic examples only. Feature reports contain sanitized observations and evidence paths, never raw browser dumps, credentials, environment values, auth/session contents, or real bank data. Inspect artifacts for sensitive content before sharing them.

## 4. Fix and re-check the final revision

The coordinator records every finding's disposition: fixed (commit and check), answered (reproduction/counter-evidence), or deferred (reason and follow-up). Disagreement requires evidence and the affected judge's reassessment; the coordinator cannot erase a major finding by relabeling it.

After fixes, re-run affected deterministic checks and verify-budge journeys; update the feature map if behavior changes. Commission independent re-checks on the resulting clean revision until every required judge approves. All three must independently score **at least 9/10**, with full scoped coverage and no unresolved blocker or major problem. An average does not pass.

Material later changes invalidate affected approvals: changed behavior, copy that alters meaning, layout, focus, errors, or shared components used by a reviewed task need a fresh affected inspection and score. Each judge must explicitly confirm approval for the same final SHA, re-exercising affected tasks and dependencies. For an unrelated or documentation-only diff, record why earlier evidence still applies and obtain each judge's explicit carry-forward confirmation for the final SHA. Never silently carry a score forward.

Close the gate only when the report accounts for all findings, gaps, checks, three final-revision approvals, and environment cleanup. Unavailable judges or blocked required tasks leave it open. Apply the repository's remaining shipping rules separately.

## Provenance

Extracted from the [bank-sync completion gate](../../../.scratch/bank-sync-ux/spec.md#done-when) and its review rounds 1–12 (issues 08–19). The final [round 12 record](../../../.scratch/bank-sync-ux/issues/19-review-round-12.md) records three scores of 9 with no blocker or major problem. Those scratch records remain historical; running this protocol requires no rules recovered from them.
