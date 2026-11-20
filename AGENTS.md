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

## Rules and their enforcers

When the owner corrects a mistake, fix it and add its rule here with the strongest enforcer that works. An exception to a `local/` lint rule sits on the offending line as `eslint-disable-next-line <rule> -- <reason>; expires YYYY-MM-DD; approved by <owner>`, written only after the owner approves it.

| Rule                                                                                                                                                                             | Enforced by                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only Opus edits UI: `.svelte` files, `src/app.css`, `src/app.html`, `src/lib/components/**/*.ts`.                                                                                | `scripts/ui-owner.sh` in pre-commit refuses those staged paths from a Codex session. The owner's Codex permission profile can also set `src/**` to `read`.                    |
| One run of visible text, or one `alt`, `aria-label`, `aria-description`, `placeholder` or `title`, in a `.svelte` file is at most 12 words.                                      | `local/concise-copy` in `bun run lint`.                                                                                                                                       |
| Copy leaves out filler, empty-state narration, history, and how Budge works inside (`right now`, `Nothing needs you`, `each month`, `due on the`, `moved from`, `Budge checks`). | `local/banned-copy` in `bun run lint`. The phrase list is in `eslint.config.js`.                                                                                              |
| A page or section heading (`h1`–`h3`) has no muted explanatory sentence under it.                                                                                                | `local/no-heading-lede` in `bun run lint`.                                                                                                                                    |
| Copy names the next action or the result, says each fact once, and fits the device showing it.                                                                                   | The [copy review](docs/quality/copy-review.md) on every change that adds or rewrites UI text: Sol reports, Opus decides. The three-judge review scores it under language.     |
| `settings.get`, the Unapproved and bank-change counts, `categories.list` and `payees.list` come from `getShellQueries()`, so tab switches never show Loading.                    | `local/shell-queries` in `bun run lint`. It reads its list from `src/lib/shellQueries.svelte.ts`.                                                                             |
| Menu, select, and popover content unmounts as soon as it closes: no `data-closed:` exit animation, which leaves a closing popup catching the next tap. Dialogs keep theirs.      | `no-restricted-syntax` for `src/lib/components/ui/{context-menu,dropdown-menu,popover,select}/*-content.svelte` in `bun run lint:ui` (`eslint.ui.config.js`).                 |
| An exception to a copy or shell-query rule names that one rule for one line, with a reason, an expiry date, and the owner's approval.                                            | `local/exception-terms` in the second pass of `bun run lint` (`eslint.exceptions.config.js`, which ignores inline disables). Blanket, file-wide, and expired exceptions fail. |

## Checking UI work in a browser

Before checking UI or behavior, use [verify-budge](.agents/skills/verify-budge/SKILL.md) as the required verification path. Follow its feature map, worktree-local `bun run app` lifecycle, Playwright storage state, evidence, and cleanup requirements before calling the change done.

## Every ticket

Before shipping a user-facing flow change, run the [three-judge UI review](docs/quality/ui-review/README.md) after feature checks and corrections. Documentation-only work is exempt from UI judging.

Run these for each ticket, scoped to the ticket's diff. A ticket is not done until each step has run and its findings are fixed, answered, or deferred with a reason in the ticket:

1. **Principles:** run `/principles` before designing, before writing tests, and before calling the ticket done, and read every matching reference in full.
2. **Tests:** pass every test the ticket adds or changes through the `test-audit` authoring gate.
3. **Running app:** prove the ticket's features with the `verify-budge` skill, and update its feature map when a feature changes.
4. **Copy:** run the [copy review](docs/quality/copy-review.md) on every UI string the ticket adds or changes, and record a disposition for each finding.
5. **Review:** run a local `code-review` and fix or answer every finding.
6. **Corrections:** once the ticket lands on the integration branch, Sol runs `/correct` on it (analysis only). Opus decides on each suggestion, then implements the accepted ones on the same branch.

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
