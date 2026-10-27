# 02: Signed-in owner shell

**What to build:** I open Budge locally, sign in with GitHub through the Clerk development instance, and land in an empty app shell. The shell has the Account sidebar on desktop and the View menu on a phone, and works in dark and light themes. Anyone who isn't me gets `FORBIDDEN` from every backend function. Budge can be added to the iPhone Home Screen.

**Blocked by:** 01 (Scaffold the repo)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 1–4, 7, 117–119, 122–127; Convex function surface (owner guard, public errors); UI; Environments

- [ ] Clerk development instance, GitHub-only sign-in, Invite-only. `svelte-clerk` is bridged to `convex-svelte` through `setupAuth()`. Convex auth config is set for Clerk's `aud: "convex"` token.
- [ ] A shared `requireOwner` guard checks the verified Clerk `subject` and issuer against `BUDGE_OWNER_SUBJECT` and `CLERK_JWT_ISSUER_DOMAIN`, and throws `ConvexError({ code: "FORBIDDEN" })` otherwise. One owner-only "whoami" query proves it.
- [ ] The fixed public error payload (`FORBIDDEN`, `NOT_FOUND`, `INVALID_INPUT`, `BANK_CONNECTION_NEEDS_LOGIN`, `BANK_UNAVAILABLE`) has a shared client-side decoder. The `runEffect(program, toPublicError)` helper exists for later actions.
- [ ] The app shell has dark and light themes on theme tokens. The sidebar is shown at 1024 px and wider, and the View menu below that. It works down to 320 px and meets WCAG 2.2 AA with keyboard paths. There are no badges or taglines.
- [ ] A `.svelte.ts` context-class pattern for shared UI state is in place. There are no module-level `$state` singletons.
- [ ] The PWA manifest (`id`, `name`, `start_url`, `scope`, `display: standalone`, colors), 192/512 icons, and a 180×180 `apple-touch-icon`. `viewport-fit=cover` with safe-area insets, and brief in-app Add to Home Screen instructions. No service worker, and no prerendering or caching of app data.
- [ ] `convex-test`: an anonymous caller and a non-owner identity both get `FORBIDDEN`, and the owner succeeds.
- [ ] A Playwright smoke test signs in with `@clerk/testing` as the one hand-made Clerk dev test user (never creating users) and sees the shell. It runs in CI against the local backend.
