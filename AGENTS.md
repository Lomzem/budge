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

## Checking UI work in a browser

Before checking UI or behavior, use [verify-budge](.agents/skills/verify-budge/SKILL.md) as the required verification path. Follow its feature map, worktree-local `bun run app` lifecycle, Playwright storage state, evidence, and cleanup requirements before calling the change done.

## Every ticket

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

## Enforced rules

| Rule                                                                                           | Enforced by                                                                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Serialize app startup, shutdown, and process-record writes within each checkout.               | `scripts/app/lock.ts`; `scripts/app/lifecycle.test.ts`                                                                |
| Keep Effect failures in the error channel; defects require an allow-listed invariant boundary. | `local/no-effect-defects` and its reasoned allow-list in `eslint.config.js`; `eslint/rules/no-effect-defects.test.js` |

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
