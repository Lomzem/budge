# What is the current state of SvelteKit with Convex, Clerk, and Vercel?

Type: research
Status: resolved
Blocked by: 

## Question

How do SvelteKit (on Bun, deployed to Vercel), Convex, and Clerk fit together today? Cover: the Convex Svelte client and its maturity, Clerk's SvelteKit SDK and the Convex–Clerk auth integration, how to lock the app to exactly one user (disable sign-ups, allowlist, server-side identity check in every Convex function), Convex scheduled functions/cron and actions for calling an external sync API, encrypting secrets at rest in Convex (key in an environment variable, Web Crypto in actions), free-tier limits for Convex, Clerk, and Vercel, and any known friction with Bun.

## Answer

**The stack fits, with a small Svelte auth bridge and two cost caveats.**

- `convex-svelte` (0.15.x, Convex-maintained, pre-1.0) supports live `useQuery` subscriptions, mutations, actions, and SSR. Recommendation: start with authenticated client subscriptions; never prerender or CDN-cache budget data.
- Clerk's SvelteKit SDK is community-maintained (`svelte-clerk` 1.2.0, `clerk-community/svelte-clerk`), and supports SvelteKit 2 only, so **pin SvelteKit 2**. There is no `ConvexProviderWithClerk` for Svelte: bridge with `setupAuth()` from `convex-svelte` and `useClerkContext()`. Use Clerk's dashboard "Convex integration" (session token with `aud: "convex"`) plus `convex/auth.config.ts`.
- **Single user:** set Clerk to Invite-only (`restricted`) and invite only the owner (free; the email allowlist is paid in production). Every public Convex function calls a shared `requireOwner` guard that checks the verified `subject` and `issuer` against a `BUDGE_OWNER_SUBJECT` env var. Scheduled jobs use internal functions only.
- **Sync jobs:** Convex crons and actions in the default runtime support `fetch` and Web Crypto; sync runs in Convex, not on Vercel.
- **Encryption:** AES-GCM in actions with a key in a Convex env var; store only ciphertext. Protects database copies and exports, not a compromised running backend.
- **Free tiers:** fine for one user. Clerk production **requires an owned domain** (`*.vercel.app` won't do); MFA and passkeys need a paid Clerk plan. Vercel Hobby is personal/non-commercial, which fits.
- **Bun:** fine locally and as the package manager (`bunx --bun convex dev`); keep Node available and leave Vercel SSR on the Node runtime.

Findings: `docs/research/stack-integration.md` on branch `research/stack-integration` (commit `983b4ab`).
