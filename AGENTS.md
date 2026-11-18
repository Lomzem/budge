# Model ownership

- **Opus 5.5** owns production application and library code: architecture, API design, and implementation.
- **UI implementation belongs exclusively to Opus 5.5**, including UI in prototypes. Sol must delegate all UI implementation and changes to Opus; Sol may review UI code but must not edit it.

# Delegation

Work inline when the current model owns the task. Delegate when another model is required, or when an independent task benefits from parallel work or a separate context. Keep routine lookups and small tasks inline.

Every delegate brief lists the `~/.agents/principles/` references whose triggers match the delegated work and requires the delegate to read each one in full before deciding. The delegate's report names the principles that changed a choice and the choice they changed.

## Agent skills

### Issue tracker

Before reading, creating, or updating issues or specs, read `docs/agents/issue-tracker.md`. Issues live as local Markdown files under `.scratch/<feature>/`.

### Triage labels

Before triaging issues or changing their status, read `docs/agents/triage-labels.md` for the five default triage labels.

### Domain docs

Before exploring the codebase, read `docs/agents/domain.md` for the single-context glossary and ADR consumer rules.

### Authentication

Before running Playwright E2E or changing Clerk setup, sign-in, or CI authentication, read `docs/agents/authentication.md`.

## UI copy

| Rule                                                                                                                                        | Enforced by                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| One run of visible text, or one `alt`, `aria-label`, `aria-description`, `placeholder` or `title`, in a `.svelte` file is at most 12 words. | `local/concise-copy` in `bun run lint`. An exception is an `eslint-disable-next-line local/concise-copy -- <reason>` comment the owner approved. |
| Copy names the next action or the result. It leaves out how Budge works inside and what the heading or control already says.                | Run `/unslop` on every UI string a change adds or rewrites, before `code-review`. The three-judge review scores it under language.               |

## Checking UI work in a browser

Before checking UI or behavior, use [verify-budge](.agents/skills/verify-budge/SKILL.md) as the required verification path. Follow its feature map, worktree-local `bun run app` lifecycle, Playwright storage state, evidence, and cleanup requirements before calling the change done.

## Every ticket

Before shipping a user-facing flow change, run the [three-judge UI review](docs/quality/ui-review/README.md) after feature checks and corrections. Documentation-only work is exempt from UI judging.

Run these for each ticket, scoped to the ticket's diff. A ticket is not done until each step has run and its findings are fixed, answered, or deferred with a reason in the ticket:

1. **Principles:** run `/principles` before designing, before writing tests, and before calling the ticket done, and read every matching reference in full.
2. **Tests:** pass every test the ticket adds or changes through the `test-audit` authoring gate.
3. **Running app:** prove the ticket's features with the `verify-budge` skill, and update its feature map when a feature changes.
4. **Review:** run a local `code-review` and fix or answer every finding.
5. **Corrections:** once the ticket lands on the integration branch, Sol runs `/correct` on it (analysis only). Opus decides on each suggestion, then implements the accepted ones on the same branch.

## Pull requests

**One integration PR per spec:** every ticket of a spec, plus its corrections, lands on one integration branch, which has one PR into `main`. Docs, `.scratch/`, ticket 01 (the scaffold), dev-environment changes (tooling, lint rules, hooks, CI), and small fixes outside a ticket are committed straight to `main` after a local `code-review`.

**CodeRabbit once, at the end:** request CodeRabbit only when every ticket and correction is on the integration branch, and only after the steps above pass and CI is green. Don't request it per ticket or per push.

`main` has no branch protection, so this merge rule is the gate:

1. CodeRabbit does not review automatically. Comment `@coderabbitai review` and wait for the completed review. A rate-limit or "review skipped" message is neither a review nor an approval: wait out the window, then comment `@coderabbitai review` again.
2. Address every CodeRabbit comment with a fix or a reply. Batch the fixes, push, and request one incremental review.
3. Merge only when CodeRabbit has approved the latest commit and CI is green.

## CI time budget

The `budget` job fails CI when any job runs longer than `BUDGET_SECONDS` in `.github/workflows/ci.yml`. The budget makes CI growth the owner's decision.

When the `budget` job fails:

1. Rerun every job once with `gh run rerun <run-id>`. A slow runner alone can cross the budget.
2. If it fails again, bring the job under budget yourself: make it faster, add a Playwright shard, or split the job. These keep every test, so they need no approval.
3. Raising the budget, changing the `budget` job, or skipping, deleting, or weakening a test to get under the budget needs the owner's approval. Finish the rest of the ticket, then ask once, with the job's time before and after the change. The change lands only after the owner approves it.
