---
name: verify-budge
description: Verify Budge's web UI and budgeting behavior before declaring a change done, reproducing a user journey, or checking a regression. Uses the worktree-local app CLI, authenticated Playwright, and a maintained feature map.
---

# Verify Budge

## Launch

1. Work from the target checkout root. Read `docs/agents/authentication.md` and `docs/agents/domain.md`, then [the feature index](features/README.md). Select the affected journeys and entry points before driving. Use invented data only.
2. Require dependencies (`bun install --frozen-lockfile` if absent). Check for `.local-app/running.json` **before** startup. If it exists and this run did not create it, stop: another session may own this checkout. Coordinate ownership rather than reseeding or stopping it. Different worktrees may run concurrently; two drivers in one checkout may not.
3. Run `bun run app up`. Wait for `app: up at … (backend …)`. Use its printed URL, not an assumed port. The CLI creates an anonymous local Convex backend, configures the Clerk test user as owner, waits for `Convex functions ready`, and starts Vite. Each checkout has `.convex/local` and `.local-app`; ports advance to free ones. Port selection is not an atomic reservation: if concurrent startups collide, clean up this run and retry.
4. Run `bun run app doctor`, `bun run app login`, then `bun run app seed budget-with-accounts`. Require exit zero for each. `login` prints the private Playwright storage-state path; keep it private. `seed` resets **all** tables in this checkout's local backend. Use `empty-budget` instead only for onboarding journeys; `bun run app seed --list` lists fixtures. Fresh backend setup needs no separate migration command.
5. After authenticated navigation to `/`, require the Budget heading plus the seeded fixture's marker: `getByRole('textbox', { name: 'Assigned for Groceries' })` for `budget-with-accounts`, or `getByRole('region', { name: 'Cutover date' })` with its date setup for `empty-budget`. Only this makes the seeded app usable; a listening port alone is insufficient.

The CLI reads development Clerk credentials from the environment or main checkout's `.env.local`: `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `E2E_CLERK_USER_ID`, `E2E_CLERK_USER_EMAIL`. Inspect presence only. Let the CLI validate them; never print values or storage-state contents. It refuses non-anonymous deployment targets and deployment overrides. Report a refusal rather than changing credential or deployment files.

## Doctor

Run `bun run app doctor` first whenever anything looks off. Require all `ok` lines and exit zero: it checks credential presence and development-instance consistency, local backend, recorded live processes, Vite, generated code freshness (in a temporary copy), and the existing Clerk test user. It does not prove the saved browser session is still valid; require an authenticated heading after `login`. On auth failure, rerun `login`, create a fresh context, and retry. Report the exact failing check if recovery fails.

## Drive

Use the installed `@playwright/test` library and `browser.newContext({ baseURL: appUrl, storageState: loginPath })`. Take `appUrl` from startup (also `.local-app/running.json`'s `appUrl`) and `loginPath` from `login` (currently `.local-app/storage-state.json`). Navigate using `page.goto('/')`, then wait for `page.getByRole('heading', { level: 1, name: 'Budget', exact: true })` and fixture controls. Drive each selected feature's exact selectors and assert each listed outcome. Wait on locators or `expect.poll`, not fixed sleeps.

The [feature map](features/README.md) is the maintained verification source. Read matching files; account for every selected sub-feature and listed entry point. A missing precondition is a failed/blocked journey, never a pass through an easier entry. Desktop sidebar navigation changes to the `View …` menu on phones. Check 1280×800 and 320×640 when layout or interaction changes.

Existing `e2e/*.test.ts` provide additional selectors for Transfers, splits, Targets, Reconciliation, and export alongside the feature maps. Read the relevant spec when those behaviors change, drive the real path, and extend the map. The standard Playwright config starts a separate build/preview server on the runner's `E2E_PREVIEW_PORT` (4173 only for direct CI invocation) and its global setup signs in independently: do not run `bun run test:e2e` against the owner's configured backend. For the complete isolated suite use the documented `bun run test:e2e:local`; for this skill use the running app and `login` storage state, as the helper does.

## Evidence

Create a unique directory under `test-results/verify-budge/` in this checkout. Record fixture, checkout/commit, feature IDs, entry points, commands with exit codes, readiness, assertions, and any blocked journeys. Keep screenshots and ARIA snapshots before the action, with the draft/action visible, after completion, and after reload or a second user-facing view. For mutations, assert the balance/count/Assigned side effect as well as the visible row; reopen or reload to prove persistence. For downloads save and inspect the actual files.

Exercise user controls. Internal setters, direct database writes, and test-only endpoints are not behavior proof. Seed is setup, not proof. Mock only at an existing production boundary and label the unverified external behavior. A seeded Bank Connection without a login cannot prove Plaid sync. For any safe/test/dry-run path, observe what actually changed (downloads, network, stored values); its name is not evidence. Avoid raw request traces, auth headers, session state, env files, or real bank data in artifacts.

## Cleanup

Close the Playwright browser in `finally`. After **every** successful or failed attempt run `bun run app down` from this checkout, provided this run started it. This stops only recorded, identity-checked process groups and restores SvelteKit types; never kill by process name or stop another checkout's app. If startup fails before recording processes, `down` is still safe after this run's attempted start. If ownership cannot be verified, report it rather than killing survivors manually.

`down` retains local backend data and private auth state; the next run's `seed` resets data. Keep credentials and storage state gitignored. Cleanup preserves `test-results/verify-budge/`: after teardown require the evidence files still exist and are nonempty, and report their absolute paths. A failed attempt also retains evidence; create a new run directory for the retry.

## Helpers

After Launch, run from the repository root:

```sh
.agents/skills/verify-budge/features/prove-budget.sh .local-app/storage-state.json
```

This executable helper uses the existing app instance and installed Playwright; it does not launch a second harness/server, reseed, or perform auth independently. It proves all journeys in [Budget](features/budget.md), captures screenshots/ARIA/action results, restores the Assigned value on success, and prints only its evidence directory. Even if it fails, run Cleanup. Other feature files use the same `page`/`expect` context recipe.

To keep the map current as the app changes, use `/maintain-verification-skill` in Claude Code or `$maintain-verification-skill` in Codex.
