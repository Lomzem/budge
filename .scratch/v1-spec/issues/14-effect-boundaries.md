# Where does Effect go in Budge?

Type: grilling
Status: resolved
Blocked by: 13

## Question

Given the findings in ticket 13, where does Budge use Effect and where does it stop: budget math, Effect Schema as the source of truth for data shapes, Convex functions (wrapper library or hand-rolled), bank sync and file import, SvelteKit server code, and Svelte components? Which error, service, and layer conventions apply across the codebase?

## Answer

**Effect goes where there is IO, retries, typed failure, or external data; everything else stays plain.**

- **Convex functions:** plain `query`/`mutation`/`action` exports with `v.*` validators and the `requireOwner` guard; Confect waits ([ADR 0001](../../../docs/adr/0001-plain-convex-not-confect.md)). Queries and simple mutations run no Effect runtime. Actions, and any mutation running a domain workflow with typed failures, run Effect exactly once through one shared `runEffect(program, toPublicError)` helper that supplies that invocation's services and throws `ConvexError` on typed failure.
- **Budget math:** pure synchronous functions over plain values, no `Effect` in their signatures; built test-first with plain Vitest.
- **Schemas:** `v.*` owns tables and function `args`/`returns`; types come from validators or generated `Doc<>`/`Id<>`, never hand-written mirrors. Effect Schema decodes external data (Plaid responses, CSV/QFX rows) on the way in. Where the two overlap, a type-level assertion keeps them in step.
- **Bank sync and file import:** a `PlaidClient` service on `effect/http` `FetchHttpClient`, with tagged errors `PlaidTransport`, `PlaidTimeout`, `PlaidDecode`, `PlaidApi` (carrying `error_code`, `status`, `request_id`). In-action retries: at most three attempts, 10 seconds per attempt, 35 seconds total; durable retries use Convex's scheduler, never Effect fibers. Actions fetch and decode; one internal mutation applies the Transactions and the cursor together.
- **Errors:** domain and integration errors are `Schema.TaggedErrorClass` classes. The browser sees one fixed `ConvexError` payload, `{ code: "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "BANK_CONNECTION_NEEDS_LOGIN" | "BANK_UNAVAILABLE", message? }`, decoded on the client by a shared schema. Defects are not mapped; they throw and Convex redacts them. Mutations fail by throwing, never by returning an error object. `requireOwner` throws `ConvexError({ code: "FORBIDDEN" })`. Logs and error payloads never carry tokens, request bodies, or raw bank responses.
- **Services and layers:** each dependency is a `Context.Service` in its own module, beside its live layer and test layer (`PlaidClient`, `TokenCipher` for AES-GCM with its key from Convex env, `ConvexRunner` wrapping `runQuery`/`runMutation`). Layers are built per handler invocation from its `ctx`. No module-global `ManagedRuntime`; nothing outside an invocation holds `ctx`, identity, or database results.
- **SvelteKit server code:** plain, no Effect runtime in v1. A file-upload endpoint, if any, calls the shared Effect parser and converts failures to `error()` at the edge.
- **Svelte components:** runes and native Convex subscriptions only; no `effect-atom-svelte`, no `svelte-effect-runtime`, no Effect in `.svelte` files. Effect code lives in `.ts` modules that components call as plain async functions. Shared UI state lives in classes in `.svelte.ts` modules (for example `BudgetMonth` in `budget-month.svelte.ts`, holding the selected month, its query, and Ready to Assign), created by a layout or page and shared with `createContext`, instead of prop drilling. Never module-level `$state` singletons: they leak across server-rendered requests. Props still carry what a component directly displays.
- **Testing:** plain Vitest for pure math; `@effect/vitest` `it.effect` with test layers and TestClock for Effect workflows; `convex-test` for Convex behavior (owner guard, rollback, idempotent imports). All under Vitest 5 via `bun run test`, not `bun test`. Agents call the `test-audit` skill when writing, changing, or reviewing tests.
- **Versions:** `effect` and `@effect/vitest` pinned to the same exact version (4.0.6 today), lockfile committed, upgraded together as one change. Never install `@effect/platform` (Effect 3 only).
- **Tooling:** `@effect/language-service` in the editor (`@effect/tsgo` on TypeScript 7), with its diagnostics in the lefthook and CI typecheck; placement is left to [How is the repo set up?](10-repo-setup.md).
