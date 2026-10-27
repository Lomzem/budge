# How does Effect fit with Convex and SvelteKit?

Type: research
Status: resolved
Blocked by: 

## Question

How does the Effect library (`effect`, Effect Schema, `@effect/platform`, `@effect/vitest`) fit a SvelteKit 2 + Svelte 5 + Convex + Clerk app today? Cover: Effect-based Convex wrappers (for example `confect` and successors) and their maturity, or patterns for running Effect inside plain Convex queries, mutations, and actions; Effect Schema versus Convex validators (`v.*`) and whether one can be generated from the other; calling an external HTTP API (Plaid) with retries, timeouts, and typed errors from a Convex action; Effect in SvelteKit load functions and Svelte 5 components (runes) and whether that is idiomatic or awkward; testing pure domain logic with `@effect/vitest`; tooling (`@effect/language-service`, ESLint rules); and bundle-size and runtime costs in Convex's default runtime and the browser.

## Answer

**Use Effect 4 heavily, but behind thin framework boundaries.**

- **Versions:** Effect 4 is stable (`effect@4.0.6`). Schema lives in `effect/Schema`, and HTTP in `effect/http`; `@effect/platform` 0.97 is Effect 3 only, so don't mix it with Effect 4. Use `@effect/vitest` 4.0.6 (Vitest 5). The v4 APIs changed (`Context.Service`, Context-based `Effect.run*With`), so v3 examples don't transplant directly. Pin exact versions.
- **Confect:** now `@confect/*` 10.4.0, actively maintained, and declares compatibility with Convex 1.48 and Effect 4. It's a community framework (Effect Schema → Convex validators, Effect services for database, auth and scheduling, typed errors over `ConvexError`) with no Svelte package. The old `@rjdellecese/confect` is Effect 3 only. **Recommendation: don't make Confect the initial foundation.** Reconsider it after one deployed Bank Connection slice if schema duplication becomes painful.
- **Recommended split:** native Convex exports with `v.*` validators and the `requireOwner` guard at the boundary; Effect for domain workflows, typed failures, decoding external data (Plaid, CSV/QFX), Plaid HTTP orchestration (retries, timeouts, schedules), and tests. Simple budget arithmetic stays as pure functions. SvelteKit handlers stay ordinary; Svelte components use runes, not Effect.

Findings: `docs/research/effect-fit.md` on branch `research/effect-fit` (commit `9ed4b7e`).
