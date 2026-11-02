# Model ownership

- **Opus 5.5** owns production application and library code: architecture, API design, and implementation.
- **UI implementation belongs exclusively to Opus 5.5**, including UI in prototypes. Sol must delegate all UI implementation and changes to Opus; Sol may review UI code but must not edit it.

# Delegation

Work inline when the current model owns the task. Delegate when another model is required, or when an independent task benefits from parallel work or a separate context. Keep routine lookups and small tasks inline.

## Agent skills

### Issue tracker

Before reading, creating, or updating issues or specs, read `docs/agents/issue-tracker.md`. Issues live as local Markdown files under `.scratch/<feature>/`.

### Triage labels

Before triaging issues or changing their status, read `docs/agents/triage-labels.md` for the five default triage labels.

### Domain docs

Before exploring the codebase, read `docs/agents/domain.md` for the single-context glossary and ADR consumer rules.

### Authentication

Before running Playwright E2E or changing Clerk setup, sign-in, or CI authentication, read `docs/agents/authentication.md`.

## Pull requests

**Local review per ticket:** before a ticket enters a PR, review it locally with the `code-review` skill and fix or answer every finding.

**Feature-slice PRs:** group related tickets (typically 3–5) into one branch and PR into `main`, squash-merged once CodeRabbit approves. This fits CodeRabbit's review limit of about one per hour. Docs, `.scratch/`, ticket 01 (the scaffold), dev-environment changes (tooling, lint rules, hooks, CI), and small fixes outside a ticket are committed straight to `main` after a local `code-review`. When unsure, open a PR.

`main` has no branch protection, so this merge rule is the gate:

1. CodeRabbit does not review automatically. Once CI and the local ticket reviews pass, comment `@coderabbitai review` and wait for the completed review. A rate-limit or "review skipped" message is neither a review nor an approval: wait out the window, then comment `@coderabbitai review`.
2. Address every CodeRabbit comment with a fix or a reply, and push.
3. Merge only when CodeRabbit has approved the latest commit and CI is green.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
