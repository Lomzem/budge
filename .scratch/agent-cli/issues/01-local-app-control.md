# 01: Local app control

**What to build:** One command, `bun run app <verb>`, gives an agent a running, signed-in local Budge with known data, so it can check its work in a browser without re-deriving the E2E setup.

**Blocked by:** the `tooling-dev-loop`, `lint-errors-and-nesting` and no-comments changes landing on `main`

**Status:** ready-for-agent

- [ ] `doctor` reports, pass or fail per line: local Convex backend reachable, Vite reachable, required env var **names** present (never values), `convex/_generated` fresh (`bun run codegen` check), Clerk test user available. Exit code is non-zero on any failure.
- [ ] `up` starts the local Convex backend and Vite with the same env `test:e2e:local` uses, and leaves no stale SvelteKit types; `down` stops both. Both are safe to run twice.
- [ ] `login` signs in as the Clerk test user, reusing the logic in `e2e/global.setup.ts` (shared, not copied), and writes a Playwright storage-state file under a gitignored path. It prints that path.
- [ ] `reset` empties every table on the local backend only. It refuses any non-local deployment.
- [ ] `seed <fixture>` loads a named dataset of invented data (public repo). Ship at least `empty-budget` and `budget-with-accounts`; `seed --list` names them. Local backend only.
- [ ] Each verb has `--help`; `bun run app` alone lists verbs.
- [ ] AGENTS.md: one short section telling agents to use `bun run app` to check UI work, and when.
- [ ] The repo's lint rules hold (no try/catch, no throw outside `publicError`, nesting limits, no in-body comments) with no `eslint-disable`.
- [ ] Tests cover the guard that refuses non-local deployments and the fixture list. Manual check: `up`, `login`, `seed budget-with-accounts`, then the budget page shows the seeded accounts.
