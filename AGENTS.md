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

## Enforced rules

| Rule                                                                                                                                                                                                                                                                                                                            | Enforced by                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serialize app startup, shutdown, and process-record writes within each checkout.                                                                                                                                                                                                                                                | `scripts/app/lock.ts`; `scripts/app/lifecycle.test.ts`                                                                                                                                                                                                           |
| Keep Effect failures in the error channel; defects require an allow-listed invariant boundary.                                                                                                                                                                                                                                  | `local/no-effect-defects` and its reasoned allow-list in `eslint.config.js`; `eslint/rules/no-effect-defects.test.js`                                                                                                                                            |
| A Starting Balance is identified by its Transaction `kind`, never by its Payee name or date.                                                                                                                                                                                                                                    | `kind` in `convex/schema.ts` with index `by_accountId_and_kind`; `saveStartingBalance` in `convex/lib/accounts.ts` is its writer, apart from the `backfillStartingBalanceKind` migration; `convex/accounts.test.ts`                                              |
| Monthly totals are a cache: rebuilding them from Transactions gives the incrementally kept rows ([ADR 0002](docs/adr/0002-monthly-totals-cache.md)).                                                                                                                                                                            | the seeded write sequences in `convex/monthlyTotals.test.ts`                                                                                                                                                                                                     |
| Every Plaid endpoint states whether a failed call may be repeated; the public token exchange runs once.                                                                                                                                                                                                                         | the required `limits` argument of `post` in `convex/lib/plaidClient.ts`; the exchange test in `convex/lib/plaidClient.test.ts`                                                                                                                                   |
| On a phone, the content and controls a journey uses stay clear of the tab bar and of a dialog's pinned header.                                                                                                                                                                                                                  | `expectClearOf` in `e2e/journeys/journey.ts`, used by `budget/assign` and `transactions/approve-phone`                                                                                                                                                           |
| On a phone, nothing a journey checks reaches past the screen's right edge or hides past the right edge of a box that neither scrolls sideways nor truncates with an ellipsis.                                                                                                                                                   | `expectNothingPastTheRightEdge` in `e2e/journeys/journey.ts`, used by `settings/later-start`, `categories/manage`, `search/phone`, `shell/navigate` and `transactions/approve-phone`                                                                             |
| Dialog components run async work through `DialogSession.run`, which hands a result only to the latest run of that operation in the opening that started it.                                                                                                                                                                     | `$lib/attempt` is a restricted import in dialog components (`eslint.config.js`; `eslint/rules/dialog-attempt-config.test.js`); the delayed-response journeys in `e2e/journeys/{accounts,categories,imports,transactions,plaid}.ts` through `e2e/heldResponse.ts` |
| A malformed bank file fails before preview.                                                                                                                                                                                                                                                                                     | the one parser `src/lib/domain/bankFiles.ts`; the malformed and preserved-format tables in `src/lib/domain/bankFiles.test.ts`                                                                                                                                    |
| Every E2E test starts from its own fixture.                                                                                                                                                                                                                                                                                     | `e2e/test.ts`; `no-restricted-imports` in `eslint.config.js`; `eslint/rules/e2e-imports.test.js`                                                                                                                                                                 |
| A journey runs outside Playwright Test, and every journey is both an E2E test and a `bun run app verify` target under one name.                                                                                                                                                                                                 | the `e2e/journeys/**` `no-restricted-imports` block in `eslint.config.js`; `eslint/rules/e2e-imports.test.js`; `e2e/journeys/index.ts` run by `e2e/journeys.test.ts` and `scripts/app/verify.ts`                                                                 |
| Every journey's browser and the process driving it run in one fixed time zone that isn't UTC, so a date worked out in UTC rather than local time fails the journey on every machine.                                                                                                                                            | `journeyTimeZone` in `e2e/journeys/timeZone.ts`, set by `playwright.config.ts` and `scripts/app/verify.ts`; `requireJourneyTimeZone` in the `e2e/journeys/index.ts` wrapper fails a journey run any other way; `settings/start`                                  |
| The verify-budge feature map names every public Convex function and exactly the journeys that exist.                                                                                                                                                                                                                            | `scripts/app/featureMap.test.ts`, in `bun run test`                                                                                                                                                                                                              |
| Each E2E run owns its frontend and backend ports.                                                                                                                                                                                                                                                                               | `scripts/local/e2e-ports.ts`, `scripts/local/preview.ts`, `playwright.config.ts`; `scripts/local/e2e-ports.test.ts`                                                                                                                                              |
| The admitted import file cap fits the measured preview and commit transaction limits.                                                                                                                                                                                                                                           | `bun run capacity:check`, in `bun run check` and CI's Import capacity contract step                                                                                                                                                                              |
| A later cutover move and its Undo each run in one mutation, so a history past `LATER_CUTOVER_READS` is refused before preview and the largest admitted one fits the transaction limits.                                                                                                                                         | `LATER_CUTOVER_READS` in `convex/lib/laterCutover.ts`, whose worst-case shapes `bun run capacity:check` applies and undoes, in `bun run check` and CI's Import capacity contract step                                                                            |
| Generated Convex code matches the Convex modules.                                                                                                                                                                                                                                                                               | `bun run codegen:check`, in `bun run check`, the pre-push hook and CI                                                                                                                                                                                            |
| Transactions, split lines, Bank Rows and monthly totals are written only through `convex/lib/transactions.ts` operations and `convex/lib/monthlyTotals.ts`; migrations, seed and Convex tests may write them raw.                                                                                                               | `local/owned-writes` and the `refreshDerivedFields`/`countTransaction`/`rebuildTotals` import restriction in `eslint.config.js`; `eslint/rules/owned-writes.test.js`, `eslint/rules/owned-writes-config.test.js`                                                 |
| App components pick with the shadcn-svelte Select (`SelectField`), or a Category with the searchable `CategoryPicker` (shadcn-svelte Popover and Command), and scroll inside the shadcn-svelte ScrollArea: no native `<select>`, no `overflow-auto` or `overflow-scroll` class.                                                 | `no-restricted-syntax` in `eslint.ui.config.js`, in `bun run lint:ui`; `eslint/rules/ui-primitives-config.test.js`                                                                                                                                               |
| A closing dialog returns focus through `restoreFocus` (`src/lib/focusReturn.ts`): to its opener (a menu item's opener is the menu's trigger), else the caller's continuation, else the caller's fallback, never to `<body>`; while another dialog stays open, only inside the topmost one, else to its first focusable control. | the required `returnFocus: FocusReturn` prop, with `onCloseAutoFocus` omitted, on `Dialog.Content` and `AlertDialog.Content`, in `bun run typecheck`                                                                                                             |

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
