# Effect's fit in Budge

Researched **2026-10-27**. Scope: a single-user, zero-based budget using SvelteKit **2**, Svelte **5** runes, Bun, TypeScript, Convex Cloud **1.48.x**, Clerk, Vercel, and Plaid. Recommendations below are research judgments, not an adopted ADR or an implementation change.

## Summary and recommendation

**Use Effect 4 heavily behind thin framework boundaries:** domain workflows, typed failures, validation of external data, Plaid HTTP orchestration, and tests. Start with ordinary Convex exports and `v.*` validators, ordinary SvelteKit handlers, and Svelte's own reactivity. Keep simple budgeting arithmetic as pure functions; use Effect where errors, dependencies, resource lifetime, or asynchronous coordination justify it. This preserves the owner's Effect preference without adding a second database, durable scheduler, or frontend state system.

Two facts make older advice unreliable. **Effect 4 is stable**, with `effect@4.0.6` current; the beta announcement's recommendation to remain on v3 is historical. **Confect is actively maintained as `@confect/*`**, currently 10.4.0, and its server peer ranges admit Convex 1.48.0 and Effect 4.0.6. The old `@rjdellecese/confect` package is a different, v3-era dependency choice. [Effect 4 announcement][effect-release], [Effect metadata][npm-effect], [current Confect metadata][npm-confect-server], [legacy metadata][npm-confect-old].

**Do not make Confect Budge's initial foundation.** It is a credible option if schema duplication and repeated adapters become substantial, but entails generated specs, implementations, clients, and integration behavior that Budge would then own through upgrades. In Svelte, its generic JS client is usable, but there is no documented Confect-specific Svelte package. Reconsider it through one deployed Bank Connection slice, including Clerk authentication and query-cache behavior, before broad adoption. [Confect model][confect-model], [packages][confect-packages], [JS subscriptions][confect-websocket].

## Version snapshot

These are direct registry observations on the research date, rather than versions inferred from search snippets. A matching peer range establishes **declared compatibility**, not proof of a deployed Budge integration.

| Package | Observed version / tag | Compatibility and consequence |
| --- | --- | --- |
| `convex` | `latest`: **1.48.0**, published Oct 22 | The requested 1.48.x baseline. [Metadata][npm-convex] |
| `effect` | `latest`: **4.0.6**, Oct 22; `prev`: **3.22.4**, Oct 22 | Prefer 4.0.6 for this new codebase. `beta` and `rc` remain historical tags. [Metadata][npm-effect] |
| `@effect/platform` | `latest`: **0.97.2**; `prev`: **0.97.3** | Both belong to Effect 3; 0.97.3 requires `effect ^3.22.4`. Do not combine this package with Effect 4. [Metadata][npm-platform] |
| `@effect/vitest` | `latest`: **4.0.6** | Peers: `effect ^4.0.6`, `vitest >=5.0.0 <6.0.0`. The v3 line is `prev: 0.30.1`, with Effect `^3.22.4` and Vitest 3/4 peers. [Metadata][npm-vitest] |
| `@rjdellecese/confect` | **0.0.35**, Feb 10 | Peers: Convex `^1.31.2`, Effect `^3.19.13`, platform `^0.94.0`. Its Convex range includes 1.48.0, but it does **not** support Effect 4. [Metadata][npm-confect-old] |
| `@confect/server` | **10.4.0**, Oct 27 | Peers: Convex `^1.45.0`, Effect `^4.0.4`, core `^10.4.0`; optional platform-node `^4.0.0`. Declares Node `>=24` for tooling/runtime environments that enforce engines. [Metadata][npm-confect-server] |
| `@confect/core` / `@confect/js` | **10.4.0**, Oct 27 | Both admit Effect `^4.0.0` and Convex `^1.32.0`; JS requires core `^10.4.0`. [Core metadata][npm-confect-core], [JS metadata][npm-confect-js] |
| `confect` without a scope | **1.0.0**, published **2015** | An unrelated package. Do not install it expecting the Convex integration. [Metadata][npm-unscoped-confect] |

For Effect 4, Schema is in `effect/Schema` or the core barrel. HTTP abstractions formerly in `@effect/platform` now live in **`effect/http`**. Early v4 examples using `effect/unstable/http` are also obsolete: stable v4 removed that path segment, without compatibility exports. APIs can still carry `@stability unstable` despite their shorter imports; HTTP is one such area. Exact pins plus a lockfile are sensible for a new integration. [Migration guide][effect-migration], [published HTTP implementation][effect-http-source].

Effect ecosystem packages that remain separate use coordinated v4 versions. Use platform-node or platform-bun only where that runtime's services are needed; using Bun to install packages does not make Convex functions run on Bun. [Migration guide][effect-migration], [Convex runtimes][convex-runtimes].

The upgrade also changes APIs: service definitions use `Context.Service` in place of v3's `Context.Tag`, and the old `Runtime<R>` value is replaced by Context-based `Effect.run*With` functions. `ManagedRuntime` remains available. The examples here use v4's Result and Schema APIs; do not mechanically transplant v3 code after changing package versions. [Service migration][effect-service-migration], [runtime migration][effect-runtime-migration].

## Convex wrappers: what exists and what it buys

### Confect's current line

The successor is the **same author's repository**, split into `@confect/core`, `server`, `cli`, `js`, `react`, `foldkit`, and `test`. It is a community framework, not an official Convex or Effect adapter. Its current capabilities include:

- Effect schemas for tables and function contracts, compiled to Convex validators.
- Decode/encode at database and function boundaries, allowing richer in-memory types with Convex-compatible encoded representations.
- Effect services for database access, authentication, storage, scheduling, function calls, and metadata.
- Function/group middleware and declared schema-based errors, transported through native `ConvexError.data` and decoded by Confect clients.
- Effect HTTP API integration and generic HTTP/WebSocket clients; reactive queries can become Effect Streams.
- `@confect/test`, which adapts `convex-test` to Effect-based tests. [Repository README][confect-readme], [services][confect-services], [error handling][confect-errors], [testing][confect-testing].

This is materially more mature than an abandoned 0.0.x experiment: it has current stable releases, a migration changelog, and repository scripts for mock-backend and local-backend tests. It is also a substantial abstraction with recent major changes. Version 10 migrated to Effect 4 and changed arguments, HTTP routers, runner calls, and generated test setup; the changelog explicitly requires regeneration. Active maintenance is a positive signal, but it is not an upstream support guarantee or evidence that all combinations have been exercised. [10.x changelog][confect-changelog], [server package and test scripts][confect-server-package].

Confect's spec/implementation split puts shared contracts outside backend implementations, then generates the Convex modules and references. This helps prevent server implementations entering browser imports, but creates another code-generation step. In a Svelte application, using `@confect/js` Streams requires a lifecycle-aware bridge into runes or stores; installing `@confect/react` provides no Svelte integration. [Spec/implementation model][confect-model], [package catalog][confect-packages], [WebSocket client][confect-websocket].

### Alternatives and official work

`@maple/convex-effect` is a thinner community wrapper: `createServerApi` supplies Effect-returning function constructors and context operations while retaining `v.*`; nullable lookups can become typed failures, with `OrNull` variants available. Its published JSR version is **2.0.1**, dating to 2024, and its examples use older Effect APIs. I did not establish support for Effect 4 or Convex 1.48; do not treat it as a current drop-in alternative without porting and validation. [Author's repository][maple-repo], [published JSR package][maple-jsr].

I found **no shipped first-party Effect execution adapter** in the reviewed Convex docs/package surface. The official `convex-helpers` repository has an open proposal for JSON Schema / Standard Schema conversion specifically mentioning Effect Schema; that is evidence of interest, not a released universal converter. Confect's current packages are the concrete maintained option established here. [Convex validation docs][convex-validation], [upstream conversion proposal][convex-schema-proposal].

## Effect inside ordinary Convex functions

### Boundary and layer setup

Convex handlers accept normal values or Promises. Construct an Effect from the handler's arguments and context, provide its services, and **run it once at that handler boundary**. The Effect runtime runs inside the current Convex invocation; it does not require a daemon. `Effect.provide` with a composed Layer is enough for request-scoped services. `ManagedRuntime` is useful for a longer-lived host integration, but should not be a module-global holder of Convex `ctx`, user identity, or mutable database state. Dispose request-owned runtimes and scopes. [Effect runtime guide][effect-runtime], [layer lifetime/memoization][effect-layers].

Use separate capabilities for queries, mutations, and actions rather than one service containing every Convex API:

| Handler | Suggested adapter | Execution rule |
| --- | --- | --- |
| Query | Read-only repository built from `ctx.db` and verified identity | Await database Effects; return serializable data; preserve query caching. |
| Mutation | Writer repository built from **this invocation's** `ctx.db` | Keep all related writes in this transaction. Throw if the domain workflow fails. |
| Action | Plaid service plus adapters for `ctx.runQuery` / `ctx.runMutation` | Perform external IO here; publish results with an internal mutation. |

This capability split is a recommendation. It follows Convex's actual boundary: actions have no direct database transaction and read/write through queries and mutations. A Layer does not turn several `runMutation` calls into one transaction. [Action context API][convex-action-context].

Lift external Promise failures into typed errors with `Effect.tryPromise`. For database operations whose rejection represents an unexpected/platform failure, `Effect.promise(() => ctx.db.get(...))` can leave rejection as a defect; handle a successful `null` separately as a domain outcome. Do not turn every database exception into a business error, success value, or user-visible stack trace. [Effect constructors and error channels][effect-source].

### Map expected errors deliberately

`Effect.runPromise` rejects on failure; blindly using it does not establish a public typed error protocol. A small wrapper can first capture **typed failures** as a Result, then throw a native `ConvexError` with an explicitly safe payload:

```ts
import { Effect, Result } from "effect";
import { ConvexError, type Value } from "convex/values";

async function runConvex<A, E>(
  program: Effect.Effect<A, E>, // provide all requirements before this point
  publicError: (error: E) => Value,
): Promise<A> {
  const outcome = await Effect.runPromise(Effect.result(program));
  if (Result.isFailure(outcome)) {
    throw new ConvexError(publicError(outcome.failure));
  }
  return outcome.success;
}
```

For example, map a domain `Forbidden` to `{ code: "FORBIDDEN" }`, rather than serializing its entire cause. Defects and interruption still reject through Effect's failure path; they are not passed to this serializer. `runPromiseExit` is the alternative when the boundary must inspect the full Cause, including defects and interruption. Convex redacts unexpected production errors; `ConvexError.data` is intentionally delivered to the caller. [Effect execution APIs][effect-source], [Convex application errors][convex-errors].

**Mutation rule:** perform this conversion before the handler returns, and let it throw. Returning `{ error: ... }` after writes is a successful Convex return and can commit those writes. Throwing aborts the mutation. Plain Convex generated types also do not encode a thrown-error union; use a shared public-error decoder on the client, or a validated discriminated return union for operations where returning failure is transactionally appropriate. [Mutation transactions][convex-mutations], [error transport][convex-errors].

### Determinism, timers, and the less obvious cache problem

Queries and mutations must be deterministic; external HTTP belongs in actions. Convex supplies invocation-frozen time and seeded randomness, so it is inaccurate to say that **all** uses of `Date.now()` or `Math.random()` are forbidden. Nevertheless, do not introduce sleeping retries, timer timeouts, random UUID generation through arbitrary host APIs, background fibers, or external telemetry exporters into a database transaction. Convex controls transaction retries; an Effect Schedule should not retry a failed transaction body in place. [Runtime restrictions][convex-runtimes].

There is a separate issue even for deterministic code: reading current time can reduce **query cache reuse**, and time passing does not itself refresh a live query. Effect logging and timing machinery can read its Clock indirectly. A query adapter should provide a constant Clock for internal timing, avoid real-time tracing/export work, and accept any business timestamp as an explicit coarse argument. Prefer plain synchronous domain functions for simple reads. [Convex caching guidance][convex-best-practices], [Effect Clock][effect-clock-source].

Confect 10.4.0 handles internal clock reads and uses `Scheduler.MixedScheduler("sync")` for query execution. **Documentation discrepancy:** its determinism guide says raw `Date.now()` is replaced with zero, but both the published 10.4.0 source and current repository implementation instead leave raw `Date.now()` observable and override Effect's unsafe Clock accessors. Effectful Clock access also observes real time; timing metrics using the substituted accessors become zero. Follow the source for this release, and test caching before depending on it. [Guide][confect-determinism], [implementation][confect-query-source], [published package][npm-confect-server].

For a plain Effect query adapter, the analogous constant Clock and microtask-based sync scheduler are reasonable starting points, but are **not a verified Convex deployment recipe from this research**. The scheduler does not make timers or arbitrary asynchronous effects deterministic. Avoid global clock monkey patches and module-global caches of database results; use Convex's dependency-tracked query cache. [Scheduler behavior][effect-scheduler-source], [Convex cache guidance][convex-best-practices].

## Effect Schema and `v.*`: ownership and conversion

Convex validators define the database/wire representation and produce generated model/API types. Effect Schema additionally expresses semantic checks, branded values, codecs, and richer decoded types. Neither `v.number()` nor a TypeScript brand alone establishes that a money amount is a safe integer in minor units. Budge should use an explicit semantic schema such as Effect 4's `Schema.Int` plus any currency/range rules, while storing ordinary supported values. [Convex validation][convex-validation], [Effect schema implementation][effect-schema-source].

**Effect Schema → Convex:** Confect's `SchemaToValidator` compiles the **encoded** schema AST. The encoded side must fit Convex values; database shapes and IDs need appropriate schemas, and codecs requiring services are not generally accepted. Semantic checks still execute in Effect decoding/encoding; the generated validator cannot enforce an arbitrary refinement. The compiler can fall back to `v.any()` for recursion/suspended schemas, so conversion is not necessarily equivalent validation. [Compiler source][confect-schema-source], [schema restrictions][confect-schema-restrictions].

**Convex → Effect Schema:** structural conversion of the supported validator subset is possible, but cannot recover refinements, brands, transformations, or domain intent absent from `v.*`. No maintained, first-party, lossless round-trip converter was established. Effect's Standard Schema support supplies a validation interoperability interface; it does not automatically supply Convex table/index/ID semantics or make `defineTable` accept any Standard Schema. [Convex validator types][convex-validator-source], [Effect Standard Schema][effect-standard-schema], [upstream proposal][convex-schema-proposal].

Recommended ownership for the plain-Convex approach:

- **Persistence and public Convex contracts:** `v.*`, shared across table/args/returns validators where appropriate. Infer types from validators/generated code rather than declaring parallel interfaces.
- **Domain invariants and external payloads:** Effect Schema, decoding at entry to the domain and encoding rich values before crossing back to Convex. Keep transport models small; assert structural type compatibility where shapes intentionally overlap.
- **If adopting Confect:** switch that covered surface to Effect Schema as the authored source, generate Convex validators, and use the required encode/decode paths consistently. Do not hand-maintain two competing sources or assume direct writes enforce the richer refinements.

Convex values include `null`, numbers, signed 64-bit bigint, strings, booleans, bytes, arrays, and supported objects—not arbitrary Date, Map, Effect, or class instances. Encode these explicitly, and distinguish optional/absent fields from persisted `null`. This constraint survives every wrapper. [Convex data types][convex-types].

## Plaid calls from a Convex action

### HTTP transport and typed failures

For Effect-heavy action code, prefer **`FetchHttpClient.layer` from `effect/http`**. It uses the host's standard fetch and gives a replaceable `HttpClient` service, request combinators, response decoding, cancellation, and typed transport errors. This avoids requiring platform-node or platform-bun inside Convex's default runtime. It is a strong architectural fit, although a real Convex deployment remains a required integration check. [Fetch transport source][effect-fetch-source], [official client example][effect-http-example].

Plain fetch remains reasonable for a small adapter: use `Effect.tryPromise({ try: signal => fetch(url, { ...options, signal }), catch: ... })`, explicitly inspect status, decode JSON through Schema, and map transport/parse/API failures separately. Forwarding the AbortSignal matters: timing out an Effect does not cancel an unrelated Promise that ignores interruption. HTTP failure status is also not inherently a rejected fetch. [Effect Promise constructor][effect-source], [HttpClient status filtering][effect-http-source].

Use error tags for **transport**, **timeout**, **decode**, and **Plaid API** failures. Preserve Plaid's stable `error_code`, HTTP status, and `request_id` for classification and safe diagnostics; display text is not a stable programmatic discriminator. Inspect the non-2xx JSON body before flattening everything through `filterStatusOk`, or map its status failure back to a decoded Plaid error. [Plaid error contract][plaid-errors].

### Retry policy and durable work

An action-local policy can be as explicit as the following Effect **4.0.6** fragment, applied to an already typed, retry-safe `requestPage` Effect:

```ts
requestPage.pipe(
  Effect.timeout("10 seconds"), // one attempt, including body decoding
  Effect.retry({
    times: 2, // at most three attempts total
    schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered),
    while: (error) =>
      error._tag === "PlaidTransport" ||
      error._tag === "TimeoutError" ||
      (error._tag === "PlaidApi" &&
        (error.status === 429 || error.status >= 500)),
  }),
  Effect.timeout("35 seconds"), // total budget including backoff
  Effect.provide(FetchHttpClient.layer),
);
```

This is a **proposed Budge policy**, not a Plaid-prescribed timing value. Honor an applicable server retry delay, bound concurrency, and narrow status-based retry rules using Plaid's error codes. For example, `ITEM_LOGIN_REQUIRED` requires a Bank Connection reauthentication path; malformed input and decode failures should not spin. A broad `HttpClient.retryTransient` policy is convenient, but explicit classification gives control over Plaid behavior. [Effect retry semantics][effect-retry], [timeouts][effect-timeout], [Plaid common errors][plaid-errors].

Endpoint semantics take priority over generic retries. Plaid recommends idempotency keys where supported for uncertain API failures; do not invent one for endpoints that do not support it. For `/transactions/sync`, preserve the initial cursor of a paginated update: `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` requires restarting the **whole pagination loop**, not retrying only the failed page. [Plaid API-error guidance][plaid-api-errors], [Transactions Sync contract][plaid-transactions].

Fetch/decode outside the transaction, then atomically apply imported Transaction changes and the accepted cursor through an internal mutation. Make writes idempotent using Plaid identifiers and protect against stale concurrent Bank Connection sync attempts. This is a Budge design recommendation derived from Plaid pagination semantics and Convex's non-atomic actions; it requires implementation-level testing. [Transactions Sync][plaid-transactions], [actions][convex-actions].

Effect Schedules and fibers are **in-memory**, not durable jobs. Convex does not automatically retry failed actions. For retries lasting minutes or surviving a restart, persist progress and schedule another internal action, or use Convex's Workflow/Workpool facilities. Scheduling from a mutation is atomic with that mutation. Do not fork work that outlives the action's returned Promise. [Action reliability and dangling Promises][convex-actions], [durable scheduling][convex-scheduling], [Workflow component][convex-workflow].

Keep Plaid credentials in Convex environment configuration, and Bank Connection tokens in server-only storage with access controls. Pass only safe identifiers to logs and public error payloads: an HttpClient error/cause can contain its request, so dumping it may expose the request body. Never commit credentials, real token fixtures, or raw bank responses to this public repository. [Convex environment variables][convex-env], [HTTP error structure][effect-http-error-source].

## SvelteKit 2 server code and Svelte 5 runes

### Server loads and hooks: a good boundary fit

SvelteKit `+page.server.ts` / `+layout.server.ts` loads and `hooks.server.ts` can await an Effect program and return ordinary framework data/Responses. Keep reusable services in server-only modules, build request-specific identity/configuration layers from `event.locals`, and provide them at the boundary. Convert typed domain failures to Kit's `error`, `redirect`, or action-failure representation **outside** the Effect program, rather than catching Kit's control-flow exceptions as generic failures. Keep loads read-oriented and serialize the result, not an Effect or runtime. [Load contract][svelte-load], [hooks][svelte-hooks], [server state guidance][svelte-state].

If an Effect HTTP service makes requests on behalf of a load, inject **`event.fetch`** through `FetchHttpClient.Fetch`, rather than silently using global fetch. Kit's fetch adds credentials, relative URLs, direct internal dispatch, and SSR/hydration handling. Provide the fetch override outside the FetchHttpClient layer so layer construction inherits the correct context. [Kit fetch behavior][svelte-load], [Fetch reference implementation][effect-fetch-source].

A process-wide `ManagedRuntime` may own immutable configuration or truly shared stateless services; it must not own the current Clerk user, RequestEvent, or a mutable authenticated Convex client. Prefer explicit verified identity passed into Effects, and recheck authorization in Convex with `ctx.auth`. Request scopes must finish before response completion; Vercel process lifetime is not a durable worker. Select platform services for the actual adapter runtime: Vercel supports Node and Bun configurations, but installing with Bun alone is not a runtime decision. [Shared-server-state warning][svelte-state], [Convex function authentication][convex-auth], [Vercel adapter configuration][svelte-vercel].

For Clerk specifically, do not copy old Effect 3 integrations indiscriminately: a March 2026 advisory describes cross-request AsyncLocalStorage contamination in Effect versions through 3.19.15, patched in 3.20.0. The reported stack used Next.js/Clerk, so it is not proof of the same bug in `svelte-clerk`; it supports using patched versions and explicit request identity instead of ambient assumptions. [Effect security advisory][effect-clerk-advisory].

### Components: use a small bridge, not two reactive models

Svelte's **`$effect` rune and the Effect library are different systems**. Keep `$state`, `$derived`, events, and the existing Convex Svelte subscription APIs for UI state. Use Effect selectively for a complex command or imported domain calculation. Starting an Effect does not make its later reads of runes reactive: `$effect` tracks only synchronous reads. Capture inputs synchronously, run cancellable work, and interrupt it in the rune's synchronous cleanup; handle typed failures and discard stale completion. `$effect` does not run during SSR. [Svelte lifecycle/dependency rules][svelte-effect], [Convex Svelte client][convex-svelte].

Community integrations now exist, but need version checks:

| Integration | What it provides | Fit for Budge's pins |
| --- | --- | --- |
| `effect-atom-svelte` **0.4.1** | Reactive atom hooks, async boundaries, per-request SSR registry/hydration, forms, RPC/HttpApi bridges. Explicitly a community project. | Peers: Effect `~4.0.0`, Svelte `^5.57.2`, Kit `^2.0.0 || ^3.0.0`. Kit 2 is admitted; an older Svelte 5 pin might not be. Async features require Svelte async mode. [Repository][atom-svelte-repo], [metadata][npm-atom-svelte] |
| `svelte-effect-runtime` **5.0.1** | A Vite/compiler integration allowing Effect execution in scripts/markup and server integrations. | Peers include Effect `^4.0.0`, Svelte `^5.44.0`, **Kit `^2.69.0 || ^3.0.0`**, and Vite 7/8. This can conflict with an earlier Kit 2 pin. It adds a compiler integration to maintain. [Author docs][ser-docs], [metadata][npm-ser] |
| First-party `@effect/atom-svelte` | An upstream proposal exists. | Registry lookup returned **404** on the research date; the issue remained open. Do not assume this package ships alongside atom-react/atom-vue. [Proposal][atom-svelte-proposal], [registry][npm-official-atom-svelte] |

Recommendation: do not add atoms or a compiler plugin initially. Convex already owns server-data reactivity, and runes already own local UI state. Keep complex Effect code in ordinary `.ts` modules with small Svelte-facing commands; this also gives the Effect tooling a simpler surface to analyze.

## Testing domain behavior with `@effect/vitest`

`@effect/vitest@4.0.6` provides `it.effect` with a fresh Scope, TestClock, and TestConsole; `it.live` uses live services, and shared/per-test Layers and property testing are available. Install the **Vitest 5** peer, not an old Vitest version from an Effect 3 tutorial. Bun can install the tools; `bun test` is not the `@effect/vitest` runner. Run Vitest explicitly, for example `bun run test` with a script invoking `vitest run`. [Official package guide][effect-vitest-guide], [published peer metadata][npm-vitest].

Test pure budgeting functions directly with ordinary assertions. For domain functions that return Effects, return that Effect from `it.effect`; do not return a lazy Effect from normal `it` and assume it ran. For example, given an Effect-returning `calculateAvailable`:

```ts
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect("spending reduces a Category's Available", () =>
  Effect.gen(function* () {
    const result = yield* calculateAvailable(10_000, 30_000, -12_500);
    expect(result).toBe(27_500);
  }),
);
```

Use integer minor-unit fixtures and independent invariants: Available = prior Available + Assigned + Activity; a Transfer conserves the relevant total across its two Accounts; changing Assigned moves the same amount out of Ready to Assign. Test failure tags and invariants, not the arrangement of Effect combinators. TestClock can advance retry/timeout tests without real delays, and a test Plaid Layer isolates the domain from network access. These are proposed test responsibilities based on Budge's glossary, not implemented product tests. [Effect test examples][effect-test-example], [local domain vocabulary](../../GLOSSARY.md).

Separately test actual Convex behavior—authorization, rollback, serialization, and idempotent imports—with `convex-test` or a real backend. Pure Effect tests cannot prove those contracts. If Confect is chosen, `@confect/test` offers an Effect-native adapter, but still does not establish production query caching or runtime support. [Convex testing][convex-testing], [Confect test adapter][confect-testing].

## Tooling

`@effect/language-service` **0.87.5** remains available and supports Effect 3/4 diagnostics and refactors. Configure the TypeScript plugin and workspace TS; putting it in `tsconfig` alone does not add its diagnostics to an ordinary unpatched `tsc` invocation. Its documented compiler patch or diagnostics command is needed for CI enforcement. Its Svelte gotcha calls for the local `typescript-svelte-plugin` first and the Effect plugin last. Keep Effect-heavy logic in `.ts` modules and retain `svelte-check`. [Language-service guide][effect-lsp], [metadata][npm-lsp].

For **TypeScript 7+**, upstream now directs users to **`@effect/tsgo`**, currently **0.62.0**, with supported compiler builds including TS 7.0.2. It supplies Effect-aware compiler/LSP diagnostics and Oxlint integration. Use this instead of installing the legacy plugin merely from habit, but do not upgrade Budge's TypeScript/Svelte toolchain solely to obtain it. Verify the supported compiler versions and Svelte integration for the chosen pins. [TSGo guide][effect-tsgo], [legacy redirect][effect-lsp], [metadata][npm-tsgo].

Prioritize correctness diagnostics for floating Effects, missing requirements, unknown error channels, duplicated Effect versions, and outdated v4 APIs. Keep TypeScript strictness and normal Svelte/TypeScript ESLint rules. The official **`@effect/eslint-plugin` 0.3.2** is much narrower than a semantic Effect checker: its exported rules are `dprint` and `no-import-from-barrel-package`. It does not replace the Effect language service. `no-floating-promises` catches Promise mistakes, not all unexecuted Effect values. [Current LSP diagnostics][effect-tsgo], [ESLint rule exports][effect-eslint-source], [plugin metadata][npm-eslint].

## Bundle size and runtime cost

Effect 4's core has no runtime dependencies and supports tree shaking. Upstream reports a **7.1 kB minified/gzipped minimal Effect program**; this is a benchmark fixture, not the cost of Budge's Schema, HTTP client, Streams, or atom integrations. Browser cost depends on what the client actually imports. Keep Plaid, server configuration, and most workflows in server-only modules; import shared runtime schemas in the browser only when their validation is needed. Type-only imports are erased. [Effect 4 benchmark and dependency claim][effect-release], [Svelte server-only modules][svelte-server-only].

Convex uses esbuild and bundles reachable dependencies. Its current deployment code limit is **230 MB**; this is not a browser download budget. Current execution limits include **1 second of user-code CPU for a query/mutation**, **64 MiB** for default-runtime actions, **30 minutes** for those actions, and **10 minutes** for Node actions. Fibers, layers, schema decoding, and large buffered bank responses still consume resources inside those limits. Keep pagination bounded, avoid unbounded `Effect.all`, and avoid repeatedly constructing expensive layers or decoding the same internal data at every helper call. [Bundling][convex-bundling], [current limits][convex-limits].

The default Convex runtime avoids the Node-action environment's cold-start tradeoff and supports browser-style libraries. Core Effect and fetch-backed HTTP are therefore plausible fits; Node/Bun-specific platform services are not implied to work there. A successful browser-target bundle does not prove deployment analysis, scheduler APIs, cache behavior, or execution limits. [Runtime support][convex-runtimes], [FetchHttpClient implementation][effect-fetch-source].

Measure the actual server and Vite browser bundles before expanding client usage. Convex documents `convex dev --once --debug-bundle-path /tmp/myBundle` for generating debug bundles without pushing code, followed by source-map inspection. A wrapper can also add deployment-analysis work: Confect 10.3.0 specifically reduced that overhead. This research establishes no Budge-specific latency or bundle-size number. [Bundle inspection][convex-bundling], [Confect changelog][confect-changelog].

## Validation and limits of this research

- Queried npm registry metadata directly and inspected published package sources, including Confect 10.4.0's clock adapter and schema compiler. Search-index versions were sometimes older than registry versions.
- In an isolated `/tmp` directory, installed Effect **4.0.6**, Convex **1.48.0**, `@effect/vitest` **4.0.6**, Vitest **5.0.3**, and TypeScript **7.0.2**. Strict typechecking passed for the error boundary and a fetch-backed Plaid action core, including the retry/timeout fragment above.
- **Five checks passed:** an Available calculation example; safe typed-error serialization; defects bypassing the public serializer; a fixture Plaid response decoded through FetchHttpClient; and a login-required response making only one attempt. These validate package APIs and selected example behavior, not Budge's future business implementation.
- No real Plaid credentials, deployed Convex functions, Clerk sessions, production browser bundle, or query-cache experiment were used. Full retry/cancellation behavior, exact Kit/Svelte pins, and end-to-end Confect compatibility remain integration checks. Only this research document belongs in the branch; no `.scratch/` files or application dependencies were changed.

## Concrete adoption boundary for Budge

1. **Adopt Effect 4.0.6 and its Schema now** for domain services, explicit failure unions, Plaid response decoding, bounded action orchestration, and testable dependency injection. Pin compatible test packages and the lockfile. Keep arithmetic and deterministic transformations as plain pure functions when no Effect capability is needed.
2. **Keep Convex native at the boundary:** ordinary query/mutation/action exports, `v.*` persistence/wire validators, internal mutations for atomic import application, and Convex scheduling for durable retries. Run Effects once per handler; provide invocation-specific services. Use an explicit public-error mapper and address query clocks before running nontrivial Effect runtimes in reads.
3. **Use Effect selectively in Kit server code**, returning normal load data and Responses. Keep Clerk identity request-scoped, inject Kit's fetch when appropriate, and let Convex remain the authority for persisted budget rules.
4. **Keep Svelte components idiomatic:** runes, event handlers, and native Convex subscriptions. Add a small cancellable command bridge only where useful. Do not introduce atom bindings, Effect RPC, a custom component compiler, a second query cache, or Effect Workflow as initial requirements.
5. **Reserve Confect 10.x for a deliberate later choice.** If adopted, use its current scoped packages and Effect Schema as the source for its generated Convex contracts; first prove a deployed slice with the actual SvelteKit 2/Svelte 5 pins. Do not use the legacy package, the unrelated unscoped package, or Effect 3's `@effect/platform` in the Effect 4 dependency set.

<!-- Primary sources, checked 2026-10-27. Registry endpoints preserve published package/version metadata. -->

[effect-release]: https://effect.website/blog/releases/effect/40
[npm-effect]: https://registry.npmjs.org/effect
[npm-convex]: https://registry.npmjs.org/convex/1.48.0
[npm-platform]: https://registry.npmjs.org/@effect/platform
[npm-vitest]: https://registry.npmjs.org/@effect/vitest
[npm-confect-old]: https://registry.npmjs.org/@rjdellecese/confect/0.0.35
[npm-confect-server]: https://registry.npmjs.org/@confect/server/10.4.0
[npm-confect-core]: https://registry.npmjs.org/@confect/core/10.4.0
[npm-confect-js]: https://registry.npmjs.org/@confect/js/10.4.0
[npm-unscoped-confect]: https://registry.npmjs.org/confect/1.0.0
[effect-migration]: https://github.com/Effect-TS/effect/blob/main/MIGRATION.md
[effect-service-migration]: https://github.com/Effect-TS/effect/blob/main/migration/services.md
[effect-runtime-migration]: https://github.com/Effect-TS/effect/blob/main/migration/runtime.md
[effect-http-source]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/http/HttpClient.ts
[confect-model]: https://confect.dev/concepts/spec-impl-model
[confect-packages]: https://confect.dev/concepts/packages
[confect-websocket]: https://confect.dev/clients/js/websocket
[confect-readme]: https://github.com/rjdellecese/confect
[confect-services]: https://confect.dev/concepts/services
[confect-errors]: https://confect.dev/server/error-handling
[confect-testing]: https://confect.dev/guides/testing
[confect-changelog]: https://github.com/rjdellecese/confect/blob/main/packages/server/CHANGELOG.md
[confect-server-package]: https://github.com/rjdellecese/confect/blob/main/packages/server/package.json
[maple-repo]: https://github.com/itsMapleLeaf/convex-effect
[maple-jsr]: https://jsr.io/@maple/convex-effect
[convex-schema-proposal]: https://github.com/get-convex/convex-helpers/issues/604
[effect-runtime]: https://effect.website/docs/v4/runtime
[effect-layers]: https://github.com/Effect-TS/effect/blob/main/migration/layer-memoization.md
[effect-source]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
[convex-actions]: https://docs.convex.dev/functions/actions
[convex-action-context]: https://docs.convex.dev/api/interfaces/server.GenericActionCtx
[convex-mutations]: https://docs.convex.dev/functions/mutation-functions
[convex-auth]: https://docs.convex.dev/auth/functions-auth
[convex-errors]: https://docs.convex.dev/functions/error-handling/application-errors
[convex-runtimes]: https://docs.convex.dev/functions/runtimes
[convex-best-practices]: https://docs.convex.dev/understanding/best-practices#dont-use-datenow-in-queries
[effect-clock-source]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Clock.ts
[effect-scheduler-source]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Scheduler.ts
[confect-determinism]: https://confect.dev/server/database/determinism
[confect-query-source]: https://github.com/rjdellecese/confect/blob/main/packages/server/src/RegisteredConvexFunction.ts
[confect-schema-source]: https://github.com/rjdellecese/confect/blob/main/packages/core/src/SchemaToValidator.ts
[confect-schema-restrictions]: https://confect.dev/concepts/schema-restrictions
[convex-validator-source]: https://github.com/convex/convex-backend/blob/main/npm-packages/convex/src/values/validators.ts
[convex-validation]: https://docs.convex.dev/functions/validation
[convex-types]: https://docs.convex.dev/database/types
[effect-schema-source]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Schema.ts
[effect-standard-schema]: https://effect.website/docs/v4/schema/standard-schema
[effect-fetch-source]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/http/FetchHttpClient.ts
[effect-http-example]: https://github.com/Effect-TS/effect/blob/main/ai-docs/src/50_http-client/10_basics.ts
[effect-http-error-source]: https://github.com/Effect-TS/effect/blob/main/packages/effect/src/http/HttpClientError.ts
[effect-retry]: https://effect.website/docs/v4/error-management/retrying
[effect-timeout]: https://effect.website/docs/v4/error-management/timing-out
[plaid-errors]: https://plaid.com/docs/errors/
[plaid-api-errors]: https://plaid.com/docs/errors/api/
[plaid-transactions]: https://plaid.com/docs/api/products/transactions/#transactionssync
[convex-scheduling]: https://docs.convex.dev/scheduling/scheduled-functions
[convex-workflow]: https://www.convex.dev/components/workflow
[convex-env]: https://docs.convex.dev/production/environment-variables
[svelte-load]: https://svelte.dev/docs/kit/load
[svelte-hooks]: https://svelte.dev/docs/kit/hooks
[svelte-state]: https://svelte.dev/docs/kit/state-management
[svelte-vercel]: https://svelte.dev/docs/kit/adapter-vercel
[effect-clerk-advisory]: https://github.com/Effect-TS/effect/security/advisories/GHSA-38f7-945m-qr2g
[svelte-effect]: https://svelte.dev/docs/svelte/$effect
[convex-svelte]: https://docs.convex.dev/client/svelte/overview
[atom-svelte-repo]: https://github.com/jarrednorrisdev/effect-atom-svelte
[npm-atom-svelte]: https://registry.npmjs.org/effect-atom-svelte/0.4.1
[ser-docs]: https://barekey.dev/docs/ser/introduction
[npm-ser]: https://registry.npmjs.org/svelte-effect-runtime/5.0.1
[atom-svelte-proposal]: https://github.com/Effect-TS/effect/issues/6486
[npm-official-atom-svelte]: https://registry.npmjs.org/@effect/atom-svelte
[effect-vitest-guide]: https://github.com/Effect-TS/effect/blob/main/packages/vitest/README.md
[effect-test-example]: https://github.com/Effect-TS/effect/blob/main/ai-docs/src/09_testing/10_effect-tests.ts
[convex-testing]: https://docs.convex.dev/testing/convex-test
[effect-lsp]: https://github.com/Effect-TS/language-service
[npm-lsp]: https://registry.npmjs.org/@effect/language-service/0.87.5
[effect-tsgo]: https://github.com/Effect-TS/tsgo
[npm-tsgo]: https://registry.npmjs.org/@effect/tsgo/0.62.0
[effect-eslint-source]: https://github.com/Effect-TS/eslint-plugin/blob/main/src/plugin.ts
[npm-eslint]: https://registry.npmjs.org/@effect/eslint-plugin/0.3.2
[svelte-server-only]: https://svelte.dev/docs/kit/server-only-modules
[convex-bundling]: https://docs.convex.dev/functions/bundling
[convex-limits]: https://docs.convex.dev/production/state/limits
