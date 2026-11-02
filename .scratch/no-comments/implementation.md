# No-comments implementation record

Worktree: `/home/lomzem/.t3/worktrees/budge/t3-83579087`, branch `no-comments`, baseline `0a00863`. Continued the prior partial rename. No push, PR, merge, or edits in the main checkout.

## Rule

`eslint/rules/no-comments.js`, registered as `local/no-comments`, checks all parser comments regardless of scope, Svelte HTML nodes, and the parser's PostCSS style AST. Removed 686 prohibited comments across 155 ESLint inputs (the replacements have the same input count). No new disable directives.

Allowlist, each token followed by whitespace or end of comment: `eslint-disable`, `eslint-enable`, `eslint-disable-next-line`, `eslint-disable-line`, `@ts-expect-error`, `@effect-diagnostics`, `prettier-ignore`, `svelte-ignore`. The checkout actually uses `eslint-disable-next-line` and `svelte-ignore`; the others occur only in rule fixtures. No `@ts-ignore`, coverage directives, or `@effect-diagnostics-next-line` allowance.

Svelte styles are covered for CSS, PostCSS, and SCSS, including SCSS line comments. Unsupported style languages and style parse errors do not expose an AST through this parser and cannot be checked by this rule. There are no such styles in this checkout. Standalone CSS remains outside ESLint.

## Fact destinations

Most removed function/property documentation restated existing names, types, validators, and tests. The following names and existing executable contracts retain the non-obvious behavior; no random draws, expressions, branches, or statements were reordered.

- Build-time Convex URL: `convexUrlFromBuild` in `src/lib/convex.svelte.ts`; SSR test renamed to `uses the build-time Convex URL when runtime env omits it`.
- Clerk callback identity across routine session updates: `fetchAccessTokenStableWithinSession` in the same module. Its existing session-ID comparison still rejects a callback belonging to an old session. Audience remains `applicationID: 'convex'` in `convex/auth.config.ts`. Setup placement remains inside ClerkProvider in the root layout.
- Seed replayability: both generators renamed `replayableSeededRandom`, in `convex/monthlyTotals.test.ts` and `src/lib/domain/budget.test.ts`. Tests retain the sequence number in their titles. Their executable tokens are otherwise identical after removing comments and normalizing that identifier.
- Chromium download burst limit: `CHROMIUM_CSV_DOWNLOAD_SPACING_MS` in `src/lib/export.ts`; E2E title `exports every table as JSON and paced CSV downloads, past Chromium’s ten-file burst limit` still asserts the full set of downloaded tables.
- Reconciliation fixture isolation: E2E title `reconciles the seeded Card that later tests leave untouched, recording and locking the difference`.
- Clerk refresh-session and browser-token redaction: `CLERK_REFRESH_SESSION_AND_BROWSER_TOKENS` in `e2e/run-local.ts`; local runner policy already lives in `docs/agents/authentication.md`.
- Triple-slash type references: Clerk env augmentation is now `import type {} from 'svelte-clerk/env'` in `src/app.d.ts`. The Convex helper's Vite reference was already supplied by `types: ['vite/client', 'node']` in `convex/tsconfig.json`, so no second import was needed.
- Plaid webhook requests: existing `asks Plaid to refresh, and points the Item webhook at Budge` in `convex/lib/plaidClient.test.ts`, and `seals the token, maps the Account, and points the webhook at Budge` in `convex/bankConnections.test.ts`. `setWebhook` and `setupConnection` retain their exact request and operation order.
- Plaid retry behavior: existing `retries a network failure, making at most three attempts, with no request, token, or cause in the error`, `gives each attempt 10 seconds and the whole call 35`, `retries Plaid's outage even when its body isn't JSON`, and `fails a response it cannot read without retrying or keeping the body` in `convex/lib/plaidClient.test.ts`. Missing credentials fail before a network attempt; an API refusal retains only code/status/request ID. Existing tests assert those cases.
- Plaid pagination restarts and leases: existing `a bank change in a later batch restarts the whole update from its first cursor`, `an update left unfinished by one sync restarts from its first cursor in the next`, `renews the lease before starting an update over, and stops if it was lost`, and `a batch whose lease or cursor is no longer current writes nothing` in `convex/bankConnections.test.ts`. Replays remain idempotent, unknown bank Accounts hold rows, sandbox connections never sync, provider data never leaves the server, and refresh follows sync.
- Budget facts: `computeBudget`, `progressOf`, `nextDue`, `byDateDue`, `MAX_REPEAT_MONTHS`, and `UPCOMING_DAYS` in `src/lib/domain/budget.ts` retain the rules. Existing domain and Convex budget/credit-card/target tests cover hidden totals, carryover, future income, Uncategorized handling, payment funding, overspending, repeat dates, and funding. `GLOSSARY.md` already defines these domain terms.
- Persistence facts: existing Convex suites for transactions, transfers, importedTransfers, imports, categories, payees, reconciliation, search, migrations, seed, settings, accounts, splits, owner, and export hold the schema contracts: approvals on edits/imports; legacy missing fields; reconciliation locks; symmetric Transfer sides; split totals; rename/Payee memory; deduplication after deletion; search text refresh/backfill; system Categories; zero assignments; immutable cutover; synthetic seed guards; singleton deployment authorization; export secret exclusion. `monthlyTotals` remains a rebuildable cache, covered by its seeded test and ADR 0002.
- Parser/data facts: existing `bankFiles`, `plaid`, `csv`, `dates`, `money`, `matcher`, `pages`, `freshness`, and `unapproved` domain tests hold sign conversions, pending/correction exclusions, cutover filtering, CSV quoting/formula protection, local dates, match-window/pick behavior, duplicate multiplicities, SplitRequired rereads, whole-unit age labels, and bounded counts. Existing types and constants retain units and sentinel values.
- UI lifecycle facts remain in their existing code names and guards: `reads` and `anotherFileChosenWhileThisWasRead` in import-dialog, `chosenCategoryId` and Payee-memory guards in transaction-dialog, `saving` and reset/open effects in dialogs, `addingSaving` in the budget page, selection effects and focus helpers, `Theme` and blocked-storage handling, and subscription enablement in Accounts/Budget. E2E titles already describe keyboard/focus, narrow-screen, Payee-memory, transfer, import, split, target, and inspector contracts. Their compiled client/server executable output is unchanged after stripping generated comments.
- Cache/privacy headers: existing SSR tests `the signed-in Budget page is private and never cached`, `the sign-in page is never cached`, and `the error page renders privately with the render error, not a header clash` continue to cover final-response headers and error rendering.
- Design rationale that tests cannot establish moved to `docs/adr/0003-runtime-and-capacity-boundaries.md`: per-deployment ownership and pure-domain boundaries; typed rollback errors; mutation/action/lease sizing and read estimates; input/target/file caps; Chromium pacing; build-time environment and session stability rationale; version-pinned offline codegen internals; generated UI ownership; timezone/server-test configuration; shared E2E fixture isolation and local runner cleanup.

## Deletions worth calling out

Removed synthetic-fixture/history headers, section labels, generated-code ownership notes now in ADR 0003, commented-out empty SvelteKit interfaces, and redundant function/property prose. Removed the JSDoc `Config` annotation from `svelte.config.js`: runtime object is unchanged and Svelte check passes, but that particular JS annotation no longer constrains the object in the editor. No runtime fact was intentionally discarded. Comments in ESLint fixture strings deliberately remain as test inputs.

## Non-linted files still containing comments

- `.coderabbit.yaml`
- `.github/workflows/ci.yml`
- `.scratch/setup/wizard.sh`
- `.scratch/v1-spec/map.md` (HTML comments)
- `AGENTS.md` (HTML comments)
- `CLAUDE.md` (HTML comments)
- `lefthook.yml`
- `src/app.css`
- `convex/tsconfig.json` (JSONC)
- `renovate.json` (JSONC)

Git/Prettier ignore files also retain their explanatory comments. Generated `convex/_generated/` and vendor `src/lib/components/ui/` sources remain excluded from ESLint and retain generator comments.

## Verification

- `bun run lint`: passed, zero errors/warnings.
- `bun run typecheck`: passed; svelte-check zero errors/warnings and Convex Effect-aware typecheck passed.
- `bun run test`: initial full run 35 files / 403 tests passed; final rule coverage grew from 34 to 43. Final full rerun: 35 files / 412 tests passed.
- `bun run test:e2e:local`: 17 / 17 passed on the anonymous temporary local backend; runner restored caller SvelteKit types. Clerk emitted redacted token-refresh messages after some completed tests; they did not fail tests.
- Independent preservation check: 86 changed production/orchestration files had identical executable tokens after comment removal and explicit identifier normalization. Changed Svelte files were compiled in both client and server modes. Both seeded test files also retain draw order by direct diff inspection.
- Earlier attempted `vitest --project unit` matched no project; corrected to the repository's `eslint` project.
- No remaining functional questions. Unsupported style languages remain a parser limitation.

Final checks: `bun run test` 35/35 files, 412/412 tests; dedicated RuleTester 43/43; `bun run typecheck` 0 Svelte errors/warnings and Convex pass; `bun run lint` and `bun run lint:ui` zero errors/warnings; `git diff --check` passed; `gitleaks git --staged --redact --no-banner` found no leaks. Final change count: 129 files including this record and ADR 0003. Commit SHA is supplied in the handoff (the record is part of that commit).

## Review fixes after c49e8ec

- Converted `svelte.config.js` to `svelte.config.ts` with `satisfies Config`. Installed SvelteKit 2.70.3's `load_svelte_config` searches `js` and `ts` and dynamically imports the result; Vite's Svelte plugin 7.3.1 also recognizes TS configs. Native Node v26.13.0 imported the TS config with no flags or added dependencies. Added the config to the generated typecheck include list and updated both ESLint imports.
- Negative proof: changing `compilerOptions.runes` to a string failed standalone TypeScript with TS2322. A second experiment kept the runtime value true but assigned it the static type string (`true as unknown as string`); the actual `bun run typecheck:app` then failed with exactly one Svelte diagnostic at `svelte.config.ts:8:3`, proving that the normal check covers the config. Both temporary changes were reverted. This restores the type constraint whose loss the original record called out.
- Shared `eslint/ui-ownership.js` now excludes generated files while reopening directories and seven owned files in both ESLint configs. Ownership evidence: `0ec99ab` and ticket 03's recorded container-query decision introduce custom `table-variants.ts`, `table-head.svelte`, and `table-cell.svelte`; `fcded0c` extends those column variants; `197dfed` adds the button's wrapping size; `a05d175` adds the dialog width and strong table row; `2856449` adds dialog scrolling; `d536658` and ticket 08 explicitly record the progress prop typing customization. This includes customizations made in the same commit as generator output, not only later modifications.
- Owned paths, relative to `src/lib/components/ui/`: `button/button.svelte`, `dialog/dialog-content.svelte`, `progress/progress.svelte`, `table/table-cell.svelte`, `table/table-head.svelte`, `table/table-row.svelte`, `table/table-variants.ts`. The head/cell files need no content edits. ADR 0003 now documents the ownership boundary and the facts from their removed comments (typed alignment, shared variants, viewport/container breakpoints, strong Unapproved rows, amount-label wrapping, scrolling wide dialogs, and separately typed progress props).
- Newly exposed lint findings: preserved button radius/font/color-mix and dialog dimensions as named theme tokens in `src/app.css`; moved close-button positioning to a wrapper; expressed the unchanged progress transform through a CSS custom property and class. Removed redundant undefined defaults and nullish/optional operations guaranteed by the existing types. Button href is typed `ResolvedPathname` so callers supply the resolved link; the existing caller already does, and href rendering is unchanged. No disable directives were added.
- Added `PLAID_MIN_SYNC_COUNT = 1` and `PLAID_MAX_SYNC_COUNT = 500` beside `SyncRequest`; the bank-connections test `sync page size stays within Plaid’s 1–500 transaction contract` asserts `PAGE_SIZE` stays within that contract. `PAGE_SIZE` remains 100; no requests changed.
- RuleTester adds JSX, Svelte expression, template-interpolation, type alias, type parameter, and type-annotation rejection cases, plus template string content acceptance. Coverage is now 50 cases.
- Full unit run passed: 35 files, 420 tests. UI component edits go beyond comments, so the local isolated Playwright suite is also required for this follow-up. Final check results and commit follow below.

Follow-up final verification: `bun run lint` and `bun run lint:ui` passed with zero errors/warnings; `bun run typecheck` passed with zero Svelte errors/warnings and the Convex Effect-aware check passed; `bun run test` passed 420/420 tests across 35/35 files, including 50 RuleTester cases; `bun run test:e2e:local` passed 17/17 tests and restored caller types. The generated CSS was inspected: the named radius, font-size, and dialog dimension utilities retain their original declarations exactly. Native TS config loading required no runtime flags or dependencies. Both deliberately bad config experiments were reverted. This follow-up is a new commit on c49e8ec; no amend, push, PR, or merge.
