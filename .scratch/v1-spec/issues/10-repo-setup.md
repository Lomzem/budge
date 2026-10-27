# How is the repo set up?

Type: grilling
Status: resolved
Blocked by: 03, 13

## Question

How is the repo set up: Bun workspace layout for SvelteKit plus Convex, ESLint with shadcn-lint, Prettier, lefthook pre-commit checks (lint, format, typecheck, tests), CodeRabbit configuration, and keeping secrets and personal data out of a public repo (env files, gitignore, secret scanning)?

## Answer

**One Bun package, strict tooling in hooks and CI, a local Convex backend for all dev and test work, and three layers that keep secrets and real data out of the public repo.**

- **Layout:** one package at the root (no Bun workspaces). SvelteKit in `src/`, Convex in `convex/`, pure domain code (budget math, matcher, Effect schemas) in `src/lib/domain/`, imported by both. An ESLint import rule keeps `src/lib/domain/` free of `convex/`, `$app`, Svelte, and browser imports.
- **Versions:** exact pins (`bunfig.toml` `install.exact = true`), committed `bun.lock`, Bun version in `packageManager`, Node LTS in `engines.node` for Vercel SSR and the Convex CLI. `@sveltejs/kit` held at 2.x (SvelteKit 3 is out; `svelte-clerk` supports 2 only), Effect at 4.x, with `effect` and `@effect/vitest` on the same exact version and `@effect/platform` never installed. Renovate weekly, grouped (Effect and Convex groups separate), never auto-merged.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `@effect/language-service` plugin. Typecheck is `svelte-check` plus a Convex typecheck that enforces `@effect/language-service` diagnostics (`@effect/tsgo` on TypeScript 7), per [Where does Effect go in Budge?](14-effect-boundaries.md).
- **ESLint:** flat config with `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, `eslint-plugin-svelte` recommended, `@convex-dev/eslint-plugin` recommended, `eslint-config-prettier` last; the domain-purity rule; no floating promises, no `any`. `@shadcn/lint` (0.2.x, a standalone Tailwind design-system linter, not an ESLint plugin) runs as `bun run lint:ui`.
- **Prettier:** `sv create` defaults plus `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`; nothing else tuned.
- **lefthook:** pre-commit, in parallel on staged files: Prettier `--write` (re-staged), ESLint `--fix`, `@shadcn/lint` on staged `.svelte`, `gitleaks git --staged` (the system gitleaks binary; the npm package named `gitleaks` is unrelated). Pre-push, whole project: the full typecheck above, `bun run test` (Vitest 5). Playwright never runs in a hook.
- **Workflow and CI:** every change is a branch and a PR into a protected `main` that requires CI; squash merge. One GitHub Actions workflow: format check, ESLint, shadcn-lint, typecheck, Vitest, the gitleaks Action, Playwright. Vercel's Git integration deploys previews and production; production Convex deploys from Vercel's build with `npx convex deploy --cmd 'bun run build'` and `CONVEX_DEPLOY_KEY`.
- **CodeRabbit:** committed `.coderabbit.yaml` with the `assertive` profile, auto-review on PRs to `main`, `request_changes_workflow: true`; `path_instructions` point at `AGENTS.md`, `GLOSSARY.md`, and the map's UI rules for `src/**/*.svelte`, and flag any real-looking financial data, names, account numbers, or Plaid IDs anywhere in a diff; exclude `bun.lock` and `convex/_generated/**`; review `.scratch/**` lightly as docs.
- **CodeRabbit merge rule:** scaffolding adds a "Pull requests" section to `AGENTS.md`: a CodeRabbit rate-limit or "review skipped" message is neither a review nor an approval. The agent waits out the limit window, re-requests with `@coderabbitai review`, waits for the review, addresses every comment, and merges only after CodeRabbit approves and CI is green. Branch protection requires CI only (a GitHub App approval may not count toward required reviews), so the rule lives in `AGENTS.md`.
- **Environments:**
  - Production Convex is never a test target.
  - Default dev backend, for the owner and for agents, is a Convex **local deployment** (beta): its function calls and bandwidth don't count against plan quotas. `.convex/` is gitignored.
  - The cloud dev deployment is kept only for what local can't do (Plaid webhooks, real-iPhone checks) and gets a daily function-call usage limit that pauses it.
  - CI Playwright runs against an anonymous local backend (`bunx convex dev --once`, kept running), seeded with synthetic data through an internal seed function, the app served by `bun run build && bun run preview`, signed in with `@clerk/testing` against the Clerk dev instance (Clerk dev keys as Actions secrets). CI needs no `CONVEX_DEPLOY_KEY`.
  - Plaid Sandbox in every non-production deployment; real Bank Connections only in production (Plaid Trial's 10 lifetime Items). Dev Convex pairs with the Clerk dev instance, prod Convex with Clerk production (set up per [Which domain does Budge run on?](12-domain.md)).
- **Secrets:** never in a repo file. Convex env (`convex env set`, per deployment): `PLAID_CLIENT_ID`, `PLAID_SECRET`, `BUDGE_TOKEN_KEY`, `BUDGE_OWNER_SUBJECT`, `CLERK_JWT_ISSUER_DOMAIN`. Vercel env: `PUBLIC_CONVEX_URL`, `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CONVEX_DEPLOY_KEY`. Local `.env.local` (Convex writes `CONVEX_DEPLOYMENT`). Every `.env*` is gitignored except a committed, names-only `.env.example` that notes each variable's store. Owner copies live in a password manager and the private location from [Connect real accounts and capture sample data](08-connect-accounts.md).
- **Secret scanning:** gitleaks in pre-commit, the gitleaks Action in CI, and GitHub secret scanning with push protection on. `.gitleaks.toml` extends the defaults with rules for Plaid `access-` tokens and Item IDs and Clerk `sk_` keys.
- **Personal data:** gitignore `*.csv`, `*.qfx`, `*.ofx`, `*.qif`, and any `captures/` everywhere, except `src/**/fixtures/synthetic/**`, which holds hand-written fixtures with invented payees and amounts that mirror only the structure of the private samples. Real-data checks happen only in the running app against the owner's own deployment, never through fixtures or snapshots. `.scratch/` tickets are public too: shapes and counts, never real merchants, balances, or IDs.
- **Tests:** Vitest `projects`: `domain` (node, `@effect/vitest`, `src/lib/domain/**/*.test.ts`) and `convex` (`convex-test`, edge-runtime, `convex/**/*.test.ts`); Playwright smoke tests in `e2e/`. Playwright auth details are confirmed during implementation.

## Comments

- From [Where does Effect go in Budge?](14-effect-boundaries.md): the typecheck step must run `@effect/language-service` diagnostics (`@effect/tsgo` on TypeScript 7), not just plain `tsc`; tests run under Vitest 5 via `bun run test`; pin `effect` and `@effect/vitest` to the same exact version and never install `@effect/platform`.
