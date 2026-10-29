# Local authenticated E2E setup

Goal: one command that runs the Playwright suite locally, from the main checkout or any worktree, against a
disposable anonymous Convex backend with the synthetic seed and the existing Clerk CI test user.

## Diagnosis

- Root `.env.local` sets `CONVEX_DEPLOYMENT` to a `local:` deployment linked to the cloud project
  (`.convex/local/default`, port 3210): the owner's dev data. Bun loads `.env.local` into every
  `bun run`, and `convex dev`/`convex run` and the Vite build read it too. So `bun run test:e2e` in the
  root would build against, seed, and mutate the owner's dev backend. Running `convex dev` with
  `CONVEX_AGENT_MODE=anonymous` in the root would also collide with that project-local state.
- Worktrees (`~/.t3/worktrees/budge/*`) have no `.env.local`, so they lack the Clerk test variables.
- `playwright.config.ts` reuses any server already on port 4173 outside CI, which could be a preview
  built against another backend.
- CI already does the right thing: a fresh anonymous backend, `seed:run`, Clerk dev keys, test user as
  owner. The local runner mirrors those steps.

## Decisions

- Runner: `bun run test:e2e:local` (`e2e/run-local.ts`). It copies the checkout's tracked and
  unignored files into a temp directory, links `node_modules`, and runs everything there. No
  `.env*` file and no `.convex/` state is copied, so the root deployment and its env stay untouched.
- The child environment drops every inherited `CONVEX_*`, `PUBLIC_CONVEX_*`, Clerk, `BUDGE_*`,
  `E2E_*`, `DEPLOY_*`, `PLAID_*` and `VERIFIED_*` variable, then adds back only five allowlisted
  names: `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`,
  `E2E_CLERK_USER_ID`, `E2E_CLERK_USER_EMAIL`. Each comes from the environment, else from the main
  checkout's `.env.local`. Nothing else is read from that file.
- Guards: keys must be `pk_test_`/`sk_test_`, the issuer must match the publishable key's Frontend API
  host, the backend must classify as `anonymous:` on loopback inside the temp directory, and port 4173
  must be free. Values are never printed. Convex env values go through stdin, not argv.
- Serial: Playwright config keeps `workers: 1`; the runner does not change it.

## Changed files

- `e2e/run-local.ts` (new): the runner. Also redacts the five values and Clerk session tokens from
  Playwright's output; `@clerk/testing` logs dev browser tokens when a token refresh outlives a test.
- `package.json`: `test:e2e:local` script.
- `playwright.config.ts`: header comment only.
- `docs/agents/authentication.md`: "Local E2E" section. `README.md`: one pointer.

## Verification (2026-10-29)

- `bun run test:e2e:local` from the main checkout: 6/6 passed, target `anonymous-agent` on
  127.0.0.1:3210 in `/tmp/budge-e2e-*`. This first run predates redaction: its output showed
  test-user session IDs and dev browser tokens for the Clerk development instance.
- `bun --no-env-file e2e/run-local.ts` (no inherited env, as in a worktree without `.env.local`):
  credentials read from the main checkout's `.env.local`; 6/6 passed; output redacted.
- After both runs: root `.env.local`, `.convex/local/default/config.json`, and the root SQLite file's
  mtime unchanged; temp copy deleted; no Convex or Vite process left; ports 3210, 3211, 4173 free.
- Guards: `pk_live_` publishable key refused before any backend starts; a listener on 4173 refused.
- `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test` (168 passed), and
  `gitleaks dir --redact` on each changed file: all clean.

## Open

- Not run from an actual T3 worktree; the `--no-env-file` run covers the same credential path. A
  worktree needs `bun install` first, and its runs test that worktree's files.

## Parent review and verification

- Reviewed the runner and the installed Convex CLI's port selection. Reserved ports 3210 and 3211
  with listeners, then ran `bun --no-env-file e2e/run-local.ts`: 6/6 passed on port 3212.
  Root `.env.local` and backend configuration hashes remained unchanged. This verifies occupied-port
  handling without starting or modifying the owner's backend.
- Confirmed an existing worktree resolves its Git common directory to the main checkout's `.git`,
  matching the runner's credential fallback. Full execution from a real worktree remains untested.
- GitHub already has all five required CI secrets; the latest CI run was successful. No dashboard
  settings or credentials needed changing.
- Updated `AGENTS.md` to route Playwright E2E runs through the authentication instructions.
- Formatting and diff checks passed; redacted secret scans of the runner and instruction change
  passed. Changes are local and uncommitted; unrelated files remain untouched.
