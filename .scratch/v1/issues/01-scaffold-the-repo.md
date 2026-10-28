# 01: Scaffold the repo

**What to build:** An empty Budge app that runs locally with `bun run dev`, plus every guardrail that later tickets rely on. The scaffold is committed straight to `main`, and its push is CI's first run. This is the prefactor ticket: it builds no budget behavior, but it makes every later slice a matter of adding code.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): Architecture; Repo and workflow; Environments, deployment, and free-tier limits

- [x] One Bun package with SvelteKit 2 (held at 2.x), Svelte 5, and a Convex backend directory. A pure domain module is imported by both, and an ESLint rule blocks Convex, SvelteKit, Svelte, and browser imports in it.
- [x] Exact version pins with a committed lockfile. The Bun version is in `packageManager` and Node LTS is in `engines.node`. `effect` and `@effect/vitest` are on the same exact 4.x version, and `@effect/platform` is not installed.
- [x] Strict TypeScript 6.0 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`) with `@effect/language-service`. Typecheck runs `svelte-check` plus a Convex typecheck (`effect-tsgo tsc` on its pinned TypeScript 7 build) that enforces the Effect diagnostics.
- [x] ESLint flat config: `strictTypeChecked` and `stylisticTypeChecked`, Svelte recommended, the Convex plugin recommended, no floating promises, no `any`, and `eslint-config-prettier` last. Prettier uses the Svelte and Tailwind plugins. shadcn-svelte is initialized, and `bun run lint:ui` runs `@shadcn/lint`.
- [x] Vitest 5 runs through `bun run test` as two projects: `domain` (node, `@effect/vitest`) and `convex` (`convex-test`, edge runtime). Each has one trivial passing test. Playwright is configured with an empty smoke suite.
- [x] lefthook. Pre-commit runs these on staged files in parallel: Prettier `--write` (re-staged), ESLint `--fix`, `@shadcn/lint` on `.svelte`, and `gitleaks git --staged`. Pre-push runs the full typecheck and `bun run test`. No hook runs Playwright. This replaces the untracked example `lefthook.yml`.
- [x] `.gitleaks.toml` extends the defaults with rules for Plaid `access-` tokens, Plaid Item IDs, and Clerk `sk_` keys. The gitignore covers every `.env*` except `.env.example`, `.convex/`, `*.csv`, `*.qfx`, `*.ofx`, `*.qif`, and any `captures/`, with an exception for synthetic fixture directories.
- [x] A names-only `.env.example` lists every variable and the store it lives in (Convex env, Vercel env, or `.env.local`).
- [x] One GitHub Actions workflow, on every PR and every push to `main`, runs the format check, ESLint, shadcn-lint, typecheck, Vitest, the gitleaks Action, and Playwright. Playwright runs against an anonymous local Convex backend, never a cloud deployment.
- [x] `.coderabbit.yaml` uses the `assertive` profile with `request_changes_workflow: true`. Its `path_instructions` point at `AGENTS.md`, `GLOSSARY.md`, and the UI rules, and flag real-looking financial data. It excludes the lockfile and generated Convex code, and reviews `.scratch/**` lightly. It skips Renovate's PRs.
- [x] Renovate runs weekly with grouped updates (Effect and Convex in separate groups) and never auto-merges.
- [x] `AGENTS.md` gains a "Pull requests" section. Every ticket from 02 onward is a PR reviewed by CodeRabbit; docs, `.scratch/`, ticket 01, and small fixes outside a ticket go straight to `main`; when unsure, open a PR. A CodeRabbit rate-limit or "review skipped" message is neither a review nor an approval. Wait out the window, re-request with `@coderabbitai review`, address every comment, and merge only after CodeRabbit approves and CI is green.
- [ ] The owner turns on GitHub secret scanning with push protection and installs the Renovate GitHub App, and the ticket records this. `main` has no branch protection.

## Comments

- Scaffold landed on `main`. Implementation notes:
  - TypeScript is 6.0.x: `typescript-eslint`, `svelte-check`, and SvelteKit 2 don't support TypeScript 7. `typecheck:convex` runs `effect-tsgo tsc@7.0.2` over `convex/` and `src/lib/domain/`, and warnings fail it. `floatingEffect` is an error everywhere; `unstableApiUsage` is off in test files, because `@effect/vitest`'s `it` is marked unstable.
  - `@sveltejs/adapter-vercel` is held at 6.x (7 needs SvelteKit 3), with the `nodejs24.x` runtime. Renovate holds SvelteKit `<3`, the adapter `<7`, and TypeScript `<6.1`.
  - `@shadcn/lint` 0.2.3 is an ESLint plugin, not a standalone CLI. `lint:ui` runs ESLint with `eslint.ui.config.js`, which enables all six `shadcn/*` rules on `.svelte` files outside `src/lib/components/ui/`.
  - shadcn-svelte was initialized with its default preset (`nova`, neutral, Lucide, Inter). Ticket 02 may pick another.
  - CodeRabbit's `request_changes_workflow` is deprecated; `.coderabbit.yaml` uses its replacement, `reviews.auto_approvals.enabled`, with `allow_author_approval: false`.
  - `convex/health.ts` holds one internal query, `health.ping`. It proves Convex bundles the domain module and gives the `convex` Vitest project its test. Ticket 02 can replace it with `whoami`.
  - `.env.example` leaves out the production flag that `seed:run` checks, because the spec doesn't name it. The ticket that adds `seed:run` adds it.
  - Pre-commit runs Prettier then ESLint `--fix` (both rewrite and re-stage files, so in parallel they would race), alongside `@shadcn/lint`; `gitleaks git --staged` runs last, so it scans the index after the fixers re-stage.
  - Prettier skips `.scratch/`: it would pad wide Markdown tables and renumber lists across the tracker.
  - Checked by hand: gitleaks rules against invented tokens, Item IDs, and Clerk keys, plus near-miss placeholders; the gitignore against sample paths; the domain-purity rule and the shadcn rules against planted violations; the Effect typecheck against a planted floating Effect.
- Owner steps still open: turn on GitHub secret scanning with push protection, install the Renovate GitHub App on `Lomzem/budge`, and install gitleaks locally (`pacman -S gitleaks`).
