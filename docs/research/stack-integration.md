# SvelteKit, Convex Cloud, Clerk, Bun, and Vercel for Budge

Researched **2026-10-27**. Scope: a single-user personal budgeting app in a public repository. This is a research snapshot, not an implemented or deployed integration. Recommendations below are inferences from the linked primary sources; package manifests and source links are pinned where practical.

## Summary

- **The stack fits.** SvelteKit serves the UI and optional SSR on Vercel; Convex Cloud owns database functions, live subscriptions, and bank-sync jobs; Clerk authenticates the browser and server requests. Convex's current Svelte client documents both authentication and SSR. [Convex Svelte](https://docs.convex.dev/client/svelte/overview), [Svelte SSR](https://docs.convex.dev/client/svelte/sveltekit-server-rendering).
- **The integration needs a small Svelte auth bridge.** Clerk's SvelteKit SDK is community maintained, and Convex has no dedicated Svelte–Clerk wrapper. New Clerk setups activate the Convex integration and use session tokens; the older `convex` JWT-template flow remains supported. [Clerk SDK directory](https://clerk.com/docs#build-with-community-maintained-sdks), [Svelte auth](https://docs.convex.dev/client/svelte/authentication), [Clerk integration](https://clerk.com/docs/guides/development/integrations/databases/convex).
- **Enforce one owner in Convex.** Restrict Clerk enrollment, then check the authenticated issuer and immutable user ID in every public data function. Scheduled work must use internal functions and explicit ownership invariants because caller authentication is not propagated. [Clerk access controls](https://clerk.com/docs/guides/secure/restricting-access), [Convex identities](https://docs.convex.dev/auth/functions-auth), [scheduled-function auth](https://docs.convex.dev/scheduling/scheduled-functions#auth).
- **Bank sync and token encryption are feasible in actions.** The default runtime supports `fetch` and Web Crypto; AES-GCM is implemented upstream. Use a deployment environment key and persist only ciphertext. This protects database copies, but does not remove trust in the running backend. [Runtimes](https://docs.convex.dev/functions/runtimes), [AES implementation](https://github.com/get-convex/convex-backend/blob/61b99472be1295aa9a06e2c810a2e09ca2ac274d/crates/webcrypto/src/aes.rs).
- **A free personal deployment is plausible, with qualifications.** Clerk's production identifier allowlist and MFA cost extra; production Clerk requires an owned domain. Vercel Hobby is restricted to personal, non-commercial use. Bun is supported locally and as a package manager; keeping Vercel SSR on Node reduces runtime variables. [Clerk pricing](https://clerk.com/pricing), [Clerk on Vercel](https://clerk.com/docs/guides/development/deployment/vercel), [Vercel terms §4](https://vercel.com/legal/terms), [Bun support](https://docs.convex.dev/client/javascript/bun).

## 1. Client maturity and SvelteKit rendering

`convex-svelte` remains the package name; no successor is required. The published version observed was **0.15.1** (2026-10-14); `convex` was **1.48.0** (2026-10-22). The Svelte client's manifest names Convex as author, includes unit and browser test commands, and declares peers `svelte ^5.19.0`, `convex ^1.30.0`, and SvelteKit `^2.12.0 || ^3.0.0`. It is an actively maintained pre-1.0 library, not evidence of a stable 1.0 API contract. [Pinned manifest](https://github.com/get-convex/convex-svelte/blob/775f32e53ca256c858a0b23edf880fbac1b222d1/package.json), [Svelte package metadata](https://registry.npmjs.org/convex-svelte), [Convex package metadata](https://registry.npmjs.org/convex).

Call `setupConvex(PUBLIC_CONVEX_URL)` in a parent layout. `useQuery()` subscribes to backend queries and exposes reactive data, loading, and error state; query arguments can be reactive getters. Mutations update the subscribed UI without building a separate polling or invalidation layer. There are APIs for paginated queries, mutations, and actions. This suits a budget that changes after manual edits or bank imports. [Queries, mutations, actions](https://docs.convex.dev/client/svelte/reactivity).

SSR is supported today. The documented `convexLoad`/`convexLoadPaginated` path uses universal transport hooks, `initConvex`, server hydration handling, and request-scoped authentication; results become live browser subscriptions after hydration. Alternatively, fetch through a fresh `ConvexHttpClient` in `+page.server.ts`, set that request's token, and seed `useQuery` with `initialData`. Never share an authenticated HTTP client between requests or give SSR a permanent owner/service token. The SSR docs specifically warn that the hydration endpoint can execute public queries with the supplied request token. [SSR setup and manual alternative](https://docs.convex.dev/client/svelte/sveltekit-server-rendering).

**Recommendation:** begin with authenticated client subscriptions if SSR complexity slows delivery; the private budget has no SEO requirement. If SSR is wanted immediately, the manual HTTP-client/`initialData` path has fewer integration pieces. Treat SSR output as private: no prerendering or shared CDN/ISR caching of budget data. These are application recommendations, not claims that SSR is unsupported.

## 2. Clerk SDK and Convex token handoff

Clerk lists Svelte under community SDKs. The current repository is **`clerk-community/svelte-clerk`**, formerly under `wobsoriano`; its README explicitly disclaims official affiliation. Observed version **1.2.0** was published 2026-09-14. Its manifest supports Svelte `^5.29.0` and SvelteKit `^2.20.0`; it does **not** advertise SvelteKit 3 support. **Use a pinned SvelteKit 2 combination initially**, or verify an updated adapter before choosing Kit 3. [Clerk directory](https://clerk.com/docs#build-with-community-maintained-sdks), [README](https://github.com/clerk-community/svelte-clerk), [pinned manifest](https://github.com/clerk-community/svelte-clerk/blob/dc6519cfdfb84df68b8a82a691e1b25d1c7e74a6/package.json), [published package metadata](https://registry.npmjs.org/svelte-clerk).

The SDK has real server integration: `withClerkHandler()` in `hooks.server.ts` verifies requests and supplies `locals.auth()`. Return `buildClerkProps(locals.auth())` from the root server load to initialize SSR, and put the app inside `<ClerkProvider>`. A server route guard improves navigation behavior but does not secure the separately reachable Convex API. Keep `CLERK_SECRET_KEY` private; only `PUBLIC_CLERK_PUBLISHABLE_KEY` is browser configuration. [SDK quickstart](https://svelte-clerk.netlify.app/kit/quickstart).

### Current setup versus JWT-template examples

For a new Clerk instance, activate **Convex integration** in Clerk's dashboard. It adds the `aud: "convex"` session-token claim and supplies the Frontend API issuer URL. Configure the corresponding Convex deployment and sync it:

```ts
// convex/auth.config.ts; use src/convex/ if configured there
import type { AuthConfig } from "convex/server";

export default {
  providers: [{
    domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
    applicationID: "convex",
  }],
} satisfies AuthConfig;
```

The environment variable name is an application choice: Clerk's guide uses `CLERK_FRONTEND_API_URL`; Convex's uses `CLERK_JWT_ISSUER_DOMAIN`. Set the chosen variable **in Convex**, not just the SvelteKit `.env`. Use separate development and production issuers. [Clerk setup](https://clerk.com/docs/guides/development/integrations/databases/convex), [Convex setup](https://docs.convex.dev/auth/clerk).

Older setups create a JWT template named **`convex`**, containing `aud: "convex"`, and request `getToken({ template: "convex" })`. This is still supported: Convex's current React integration explicitly chooses the session token when `sessionClaims.aud === "convex"`, otherwise the named template. Template JWTs and session tokens are different; do not request a nonexistent template after configuring only the new integration. [Pinned token-selection code](https://github.com/get-convex/convex-js/blob/c44c6fcae6c744d596efb393bb49247057f5b740/src/react-clerk/ConvexProviderWithClerk.tsx), [Clerk JWT templates](https://clerk.com/docs/guides/sessions/jwt-templates).

### Svelte bridge

There is no `ConvexProviderWithClerk` Svelte component. Use `setupAuth()` or the underlying `ConvexClient.setAuth()` token-fetch callback. In `svelte-clerk` 1.2.0, access the reactive Clerk context with **`useClerkContext()`**; avoid copying a React `useAuth()` import or destructuring the context into stale values. [Convex Svelte auth](https://docs.convex.dev/client/svelte/authentication), [Clerk client helpers](https://github.com/clerk-community/svelte-clerk/blob/dc6519cfdfb84df68b8a82a691e1b25d1c7e74a6/docs/svelte/helpers.md).

Illustrative bridge for the **new integration**, inside a component beneath `<ClerkProvider>` and a Convex setup ancestor:

```svelte
<script lang="ts">
  import { useClerkContext } from "svelte-clerk/client";
  import { setupAuth } from "convex-svelte";

  const clerk = useClerkContext();
  setupAuth(() => {
    const session = clerk.session;
    return {
      isLoading: !clerk.isLoaded,
      isAuthenticated: !!clerk.auth.userId,
      fetchAccessToken: async ({ forceRefreshToken }) =>
        session
          ? session.getToken({ skipCache: forceRefreshToken })
          : null,
    };
  });
</script>
```

For the legacy flow, add `template: "convex"` to those token options. Mapping `forceRefreshToken` to `skipCache` follows Convex's own Clerk implementation. On sign-out, the auth bridge must clear auth; gate private subscriptions on **Convex** `useAuth().isAuthenticated`, with `'skip'` while unavailable. Clerk's session readiness alone does not prove Convex accepted its JWT. [Token-refresh reference](https://github.com/get-convex/convex-js/blob/c44c6fcae6c744d596efb393bb49247057f5b740/src/react-clerk/ConvexProviderWithClerk.tsx), [subscription gating](https://docs.convex.dev/client/svelte/authentication).

For authenticated SSR, get the requesting user's token from `locals.auth().getToken()` (or the template variant), then set it on the request's HTTP client or use `withServerConvexToken`. Compose the Clerk handler before Convex's auth/hydration handlers. Seed `setupAuth`'s `initialState` from verified server state when using SSR. Do not serialize raw bearer tokens into page data just to make browser auth work. [Server helpers](https://svelte-clerk.netlify.app/kit/helpers), [Convex SSR](https://docs.convex.dev/client/svelte/sveltekit-server-rendering).

## 3. Exactly one authorized user

**Enrollment:** manually create/invite the owner, set Clerk access mode to **Invite-only** (`restricted` in the API), and leave no other invitations or enterprise enrollment paths. Existing users can still sign in. Hiding the sign-up UI alone is insufficient. An exact-email allowlist in Open mode is an alternative, but it requires a paid production plan; it controls sign-ups, and on new applications does not revoke existing accounts. Avoid a whole-domain allowlist for a one-user app. [Access-mode and allowlist rules](https://clerk.com/docs/guides/secure/restricting-access), [2025 sign-in behavior change](https://clerk.com/changelog/2025-08-08-allowlist-blocklist-on-sign-in).

**Authorization:** store the expected Clerk user ID in a private Convex variable such as `BUDGE_OWNER_SUBJECT`, independently in each deployment. Every public query, mutation, and action that reads or changes app data must call a shared guard before work. Check the verified `subject` and `issuer` (or a pinned `tokenIdentifier`), not an email or a caller-provided `userId`. Convex guarantees these identity fields. [Function identities](https://docs.convex.dev/auth/functions-auth).

Illustrative guard, to be invoked by every public data handler or enforced through custom function builders:

```ts
import type { QueryCtx } from "./_generated/server";

export async function requireOwner(ctx: Pick<QueryCtx, "auth">) {
  const owner = process.env.BUDGE_OWNER_SUBJECT;
  const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
  const identity = await ctx.auth.getUserIdentity();
  if (!owner || !issuer || !identity ||
      identity.subject !== owner || identity.issuer !== issuer) {
    throw new Error("Forbidden");
  }
  return identity;
}
```

**Internal jobs are the necessary distinction from “check identity in every function.”** Scheduling does not preserve `ctx.auth`; requiring a live Clerk identity in cron handlers would break background sync. Make token readers/writers and workers `internalQuery`, `internalMutation`, and `internalAction`, inaccessible to ordinary clients. A guarded public mutation can enqueue a connection/job ID; internal handlers must verify that the referenced connection belongs to the configured owner. A cron can select that owner's eligible connections directly. Never trust an owner argument accepted unchecked by a public function. [Internal functions](https://docs.convex.dev/functions/internal-functions), [scheduling authentication](https://docs.convex.dev/scheduling/scheduled-functions#auth).

For any future HTTP webhook, authenticate the bank provider's signature separately and resolve the stored connection/owner internally. A bank callback has no Clerk browser session. This is a recommendation; signature details depend on the bank-sync provider, which is outside this research question.

## 4. Bank-sync actions and scheduling

Put recurring jobs in the Convex functions directory's `crons.ts`, targeting internal workers. Convex supports interval schedules and UTC calendar/cron schedules. Run sync in Convex Cloud so closing the browser or finishing a Vercel request does not stop it. [Cron documentation](https://docs.convex.dev/scheduling/cron-jobs).

An action may call an external API using standard `fetch`; queries and mutations cannot make network requests. Actions read/write the database through `ctx.runQuery`/`ctx.runMutation`. The default Convex runtime is enough for an HTTP bank API. Choose a separate `"use node"` action module only when a required SDK needs Node APIs; Node modules cannot contain queries/mutations. Neither backend runtime is Bun. Current Cloud Node support is 22/24, with 24 the default. [Actions](https://docs.convex.dev/functions/actions), [runtime rules](https://docs.convex.dev/functions/runtimes).

Current execution ceilings are **30 minutes for default-runtime actions**, **10 minutes for Node actions**, and **1 second of user-code execution for queries/mutations**, excluding database operations. Do not repeat the older blanket “all actions have a ten-minute limit.” [Execution limits](https://docs.convex.dev/production/state/limits#execution-time-and-scheduling).

Scheduled mutations execute exactly once, with retries for internal Convex failures; scheduled actions execute at most once and are **not automatically retried**. Scheduling from a mutation is atomic with that mutation, while an action cannot roll back external side effects. [Scheduler guarantees](https://docs.convex.dev/scheduling/scheduled-functions).

**Recommended sync flow:** a mutation claims a connection/job and enqueues an internal action; the action decrypts its token, fetches bounded pages, and commits each page plus cursor through internal mutations. Use a job lease or equivalent to prevent overlapping cron/manual sync. Check non-success HTTP status explicitly, respect provider rate limits, retry transient failures with bounded exponential backoff/jitter, and stop on revoked credentials pending relinking. Schedule later attempts rather than sleeping for long periods. Use provider idempotency keys where offered and upsert imported transactions by provider identity; retrying an ambiguous network failure must not duplicate money movements or imports. These are application recommendations derived from the scheduler's side-effect guarantees.

Give each HTTP request a deadline shorter than the action budget. Node's `fetch` can use `AbortSignal.timeout`. For the default runtime, upstream source provides `AbortController`, request-signal propagation, and timers: use a controller plus `setTimeout(() => controller.abort(), deadlineMs)`, pass its signal to `fetch`, and clear the timer in `finally`. Do not assume the polyfilled `AbortSignal` has Node's static helpers. Validate cancellation against the deployed runtime; bound pages and retries as well. [Node abort API](https://nodejs.org/docs/latest-v24.x/api/globals.html#static-method-abortsignaltimeoutdelay), [Convex signal propagation](https://github.com/get-convex/convex-backend/blob/61b99472be1295aa9a06e2c810a2e09ca2ac274d/npm-packages/udf-runtime/src/23_request.ts), [timers](https://github.com/get-convex/convex-backend/blob/61b99472be1295aa9a06e2c810a2e09ca2ac274d/npm-packages/udf-runtime/src/02_timers.ts), [AbortSignal polyfill](https://github.com/get-convex/convex-backend/blob/61b99472be1295aa9a06e2c810a2e09ca2ac274d/npm-packages/udf-runtime/src/03_abort_signal.ts).

## 5. Encryption of bank access tokens

Convex already encrypts customer data at rest with AES-256 and encrypts traffic. Application encryption adds a separate boundary: database documents, exports, and backups hold ciphertext instead of reusable bank tokens. [Convex platform security](https://www.convex.dev/security).

**Feasible today:** import a random 32-byte encryption key from a Convex deployment variable, then use `crypto.subtle.importKey("raw", …, "AES-GCM", false, …)` and `encrypt`/`decrypt` inside actions. Convex documents Web Crypto, and its upstream AES implementation includes GCM encryption/decryption; Node 24 also exposes Web Crypto if the bank SDK requires that runtime. This establishes feasibility from documentation/source, not an executed Cloud proof. [Convex runtime](https://docs.convex.dev/functions/runtimes), [pinned AES-GCM implementation](https://github.com/get-convex/convex-backend/blob/61b99472be1295aa9a06e2c810a2e09ca2ac274d/crates/webcrypto/src/aes.rs), [Node 24 Web Crypto](https://nodejs.org/docs/latest-v24.x/api/webcrypto.html).

Suggested envelope: `{ version, keyId, iv, ciphertext }`, with binary fields encoded consistently. Use a fresh cryptographically random **12-byte IV** per encryption, a **128-bit authentication tag**, and authenticated additional data binding the value to its deployment/connection/purpose. Never reuse a key/IV pair. Web Crypto's AES-GCM result contains ciphertext plus tag. [W3C AES-GCM specification](https://w3c.github.io/webcrypto/#aes-gcm), [NIST SP 800-38D §§5.2, 8](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf).

Recommended handling and caveats:

- Set the encoded key in Convex deployment settings, with different keys for development and production. Read it inside the action and fail closed if absent or malformed. Convex variables are deployment scoped and available through `process.env`; they are separate from Vercel's variables. [Environment variables](https://docs.convex.dev/production/environment-variables).
- Exchange bank credentials and encrypt the resulting access token within the action **before** invoking a persistence mutation. Pass connection IDs to scheduled jobs; pass ciphertext to storage helpers. Keep plaintext out of function/scheduler arguments, return values, URLs, logs, and browser subscriptions. Store secrets separately from UI-readable connection metadata. This is the proposed data-handling boundary, not automatic platform redaction.
- Keep old keys by `keyId` during rotation, re-encrypt records with new IVs, then retire keys only after accounting for backups. Losing every copy of the key makes the stored tokens unrecoverable; restoring a database without its historical keys will not restore bank access.
- This is server-side encryption, **not end-to-end encryption**: running code must decrypt to sync while the owner is offline. A compromised deployment, privileged operator, or leaked deploy/admin credential may reach both environment key and plaintext. A non-extractable `CryptoKey` does not stop malicious code that can read the original environment variable. The Web Crypto specification explicitly leaves key-management/security design to the application. [Web Crypto security considerations](https://w3c.github.io/webcrypto/#security-considerations).

Only example variable names belong in this public repo. Keep real bank tokens, encryption keys, Clerk secrets, owner identifiers, personal transactions, and production exports outside Git; use synthetic fixtures for preview deployments.

## 6. Free tiers and practical costs

These are the public limits checked on 2026-10-27, not contractual promises of future pricing.

**Convex Cloud Free:** 0.5 GB database storage (including indexes), 1 GB/month database I/O, 1 million function calls/month, 20 GB-hours/month action compute, 1 GB file storage, and 1 GB/month file egress. Most allowances apply per team, rather than granting a fresh pool for every deployment. Subscription updates and scheduled executions count toward function usage. Free has hard caps; Starter permits metered overage. [Current resource limits](https://docs.convex.dev/production/state/limits), [pricing](https://www.convex.dev/pricing).

For one user, the likely pressure points are broad queries that reread transaction history, extra indexes, frequent subscriptions, and wasteful bank polling, rather than the number of logins. Action compute uses 64 MiB in the default runtime versus 512 MiB in Node. **Inference:** indexed, paginated budget queries and modest sync cadence should fit comfortably initially, but measure actual usage before making a cost guarantee. [Metering and memory sizes](https://docs.convex.dev/production/state/limits#functions).

**Clerk Hobby:** 50,000 monthly retained users per app, up to three dashboard seats, three social connections, fixed seven-day sessions, one-day application-log retention, and Clerk branding. Production MFA, passkeys, and SMS authentication require an upgrade; an identifier allowlist is also paid in production. One user is far below the usage allowance, but security-feature gating can drive cost. [Pricing and feature comparison](https://clerk.com/pricing), [allowlist entitlement](https://clerk.com/docs/guides/secure/restricting-access#allowlist).

Clerk production on Vercel requires a domain you own and DNS configuration; `*.vercel.app` is insufficient. Budget separately for domain registration. Development instances can be used for previews, with separate configuration and synthetic data. [Clerk Vercel deployment](https://clerk.com/docs/guides/development/deployment/vercel), [environments](https://clerk.com/docs/guides/development/managing-environments).

**Vercel Hobby:** 100 GB fast data transfer, 10 GB fast origin transfer, 1 million CDN requests, 1 million function invocations, four active CPU-hours, and 360 GB-hours of provisioned memory in the published included usage. It permits 100 deployments/day; exceeding allowances generally means waiting for reset or upgrading. Browser-to-Convex live traffic is served by Convex, while SSR consumes Vercel functions. [Hobby allowances](https://vercel.com/docs/plans/hobby).

With Fluid Compute, Hobby functions default to and max out at **300 seconds**. Adapter documentation can retain older duration defaults, so use Vercel's current runtime limits and verify the generated configuration. Bank sync in Convex avoids tying its execution to a Vercel request's duration. [Current duration limits](https://vercel.com/docs/functions/configuring-functions/duration#duration-limits).

**Non-commercial restriction:** Vercel's terms §4 limit Hobby to personal or non-commercial use, and the Hobby documentation describes it as non-commercial, personal use only. **Inference:** Budge used solely for the owner's personal budget fits; a public source repository alone does not make it commercial. Recheck eligibility before selling hosting, charging subscriptions, or using the deployment for a business. [Terms §4](https://vercel.com/legal/terms), [Hobby policy](https://vercel.com/docs/plans/hobby#hobby-billing-cycle).

## 7. Bun and deployment friction

- **Convex CLI:** Bun is supported, and the official quickstart uses `bunx convex dev`. However, `bunx` respects a Node shebang and may still launch Node; `bunx --bun convex dev` forces Bun. Keep Node available for the package's declared tooling requirements (`convex` 1.48.0 declares Node >=20), and do not confuse Bun-driven CLI execution with a Bun Cloud backend. [Convex Bun quickstart](https://docs.convex.dev/quickstart/bun), [Bun shebang behavior](https://bun.com/docs/pm/bunx), [Convex package metadata](https://registry.npmjs.org/convex).
- **Vite dev runtime:** `bun run dev` alone need not mean Vite runs under Bun. Use `bun --bun run dev` when that is the intent; preserve SvelteKit's Vite build pipeline. [Bun Vite guide](https://bun.com/guides/ecosystem/vite).
- **Dependency/build detection:** commit the Bun lockfile and keep local/build versions aligned. Vercel detects `bun.lock` or `bun.lockb` for installation; without a lockfile it defaults to npm. Package-manager selection and deployed function runtime are separate decisions. [Vercel package managers](https://vercel.com/docs/package-managers).
- **Adapter choice:** deploy SvelteKit through `@sveltejs/adapter-vercel` (or auto-detection initially), even when local dev uses Bun. A Bun server adapter targets a standalone Bun server. Current Vercel adapter docs support explicit Node 22/24 or `bun1.x` runtime selection, so the older claim “Vercel cannot run Bun” is obsolete. **Recommendation:** explicitly select Node for initial SSR and test with the chosen SvelteKit 2 adapter release. [Vercel adapter](https://svelte.dev/docs/kit/adapter-vercel), [Bun server adapter](https://svelte.dev/docs/kit/adapter-bun).
- **Optional production Bun:** Vercel's Bun runtime is currently Beta on all plans and is configured separately through `bunVersion`. It is viable to investigate, but unnecessary for meeting the stated local Bun requirement. Confirm the selected adapter's emitted runtime and Clerk server behavior before opting in. [Vercel Bun runtime](https://vercel.com/docs/functions/runtimes/bun).

An illustrative Bun build command, adapted from Convex's official Vercel flow, is:

```sh
bunx convex deploy --cmd-url-env-var-name PUBLIC_CONVEX_URL --cmd 'bun run build'
```

Keep a production `CONVEX_DEPLOY_KEY` only in Vercel's Production environment. Preview deployments need their own preview credentials/configuration and separate Convex data; do not populate previews with personal transactions or real bank credentials. The command coordinates code generation/build/deployment and ensures the frontend targets the intended Convex URL. [Convex Vercel deployment](https://docs.convex.dev/production/hosting/vercel).

## Verification still required before implementation is considered ready

Research establishes documented support, not a deployed end-to-end test. With pinned versions, verify owner sign-in, token refresh, sign-out, authenticated SSR/hydration, and direct rejection of unauthenticated or second-user Convex calls. Exercise a fake bank's timeout/retry/cursor flow and AES-GCM round-trip, tamper rejection, and rotation in a disposable Convex deployment. Confirm current Clerk production access-mode entitlements and generated Vercel runtime settings. Use synthetic identities/data and disposable test keys throughout; no live accounts were accessed during this research.
