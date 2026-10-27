# 01: Scaffold the repo

**What to build:** An empty Budge app that runs locally with `bun run dev`, plus every guardrail that later tickets rely on. A first PR goes through CI and CodeRabbit to a protected `main`. This is the prefactor ticket: it builds no budget behavior, but it makes every later slice a matter of adding code.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): Architecture; Repo and workflow; Environments, deployment, and free-tier limits

- [ ] One Bun package with SvelteKit 2 (held at 2.x), Svelte 5, and a Convex backend directory. A pure domain module is imported by both, and an ESLint rule blocks Convex, SvelteKit, Svelte, and browser imports in it.
- [ ] Exact version pins with a committed lockfile. The Bun version is in `packageManager` and Node LTS is in `engines.node`. `effect` and `@effect/vitest` are on the same exact 4.x version, and `@effect/platform` is not installed.
- [ ] Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`) with `@effect/language-service`. Typecheck runs `svelte-check` plus a Convex typecheck that enforces the Effect diagnostics.
- [ ] ESLint flat config: `strictTypeChecked` and `stylisticTypeChecked`, Svelte recommended, the Convex plugin recommended, no floating promises, no `any`, and `eslint-config-prettier` last. Prettier uses the Svelte and Tailwind plugins. shadcn-svelte is initialized, and `bun run lint:ui` runs `@shadcn/lint`.
- [ ] Vitest 5 runs through `bun run test` as two projects: `domain` (node, `@effect/vitest`) and `convex` (`convex-test`, edge runtime). Each has one trivial passing test. Playwright is configured with an empty smoke suite.
- [ ] lefthook. Pre-commit runs these on staged files in parallel: Prettier `--write` (re-staged), ESLint `--fix`, `@shadcn/lint` on `.svelte`, and `gitleaks git --staged`. Pre-push runs the full typecheck and `bun run test`. No hook runs Playwright. This replaces the untracked example `lefthook.yml`.
- [ ] `.gitleaks.toml` extends the defaults with rules for Plaid `access-` tokens, Plaid Item IDs, and Clerk `sk_` keys. The gitignore covers every `.env*` except `.env.example`, `.convex/`, `*.csv`, `*.qfx`, `*.ofx`, `*.qif`, and any `captures/`, with an exception for synthetic fixture directories.
- [ ] A names-only `.env.example` lists every variable and the store it lives in (Convex env, Vercel env, or `.env.local`).
- [ ] One GitHub Actions workflow runs the format check, ESLint, shadcn-lint, typecheck, Vitest, the gitleaks Action, and Playwright. Playwright runs against an anonymous local Convex backend, never a cloud deployment.
- [ ] `.coderabbit.yaml` uses the `assertive` profile with `request_changes_workflow: true`. Its `path_instructions` point at `AGENTS.md`, `GLOSSARY.md`, and the UI rules, and flag real-looking financial data. It excludes the lockfile and generated Convex code, and reviews `.scratch/**` lightly.
- [ ] Renovate runs weekly with grouped updates (Effect and Convex in separate groups) and never auto-merges.
- [ ] `AGENTS.md` gains a "Pull requests" section: a CodeRabbit rate-limit or "review skipped" message is neither a review nor an approval. Wait out the window, re-request with `@coderabbitai review`, address every comment, and merge only after CodeRabbit approves and CI is green.
- [ ] The owner turns on `main` branch protection (CI required, squash merge) and GitHub secret scanning with push protection, and the ticket records this.
