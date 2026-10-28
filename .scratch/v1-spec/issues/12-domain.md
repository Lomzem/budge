# Which domain does Budge run on?

Type: grilling
Status: resolved
Blocked by: 

## Question

Clerk production instances require a domain you own (a `*.vercel.app` address is not accepted, per ticket 03). Which domain or subdomain does Budge use: an existing domain you own, or a new one (about $10–15 a year, outside the $25 sync budget)? Or does Budge run on a Clerk development instance instead, and what does that trade away? MFA and passkeys need a paid Clerk plan; is password plus email verification enough for a single-user finance app?

## Answer

**Clerk production at `budge.lomzem.dev`, GitHub and email verification codes for sign-in, Clerk's free 7-day session, and working preview deployments within the free tiers.**

- **Domain:** `budge.lomzem.dev`, a subdomain of `lomzem.dev`, which the owner already has at Cloudflare. No new domain cost. Clerk's production DNS records (Frontend API, Account Portal, email/DKIM) and Vercel's record for `budge.lomzem.dev` are added in Cloudflare as **DNS-only**, not proxied.
- **Clerk instances:** production runs on a Clerk **production** instance tied to `budge.lomzem.dev`. Local dev, tests, CI, and preview deployments use the Clerk **development** instance. A development instance in production was rejected because of its banner, its shared `*.accounts.dev` pages, its fragile URL-based session handshake in an iOS Home Screen app, its lower limits, and Clerk's own advice against it.
- **Sign-in:** GitHub and email verification codes for v1. Keep Email enabled in both Clerk instances. No password is required. Production uses the owner's own GitHub OAuth app, with its callback pointing at Clerk. The development instance uses Clerk's shared credentials. Invite-only stays on, and only the owner's verified email is invited. Keep 2FA or a passkey on the GitHub account for GitHub sign-in. Clerk's paid MFA and passkeys are not bought.
- **Reversible by design:** `requireOwner` checks the **Clerk** user ID (`subject`) and issuer, never a GitHub ID. Both sign-in methods use the owner's existing Clerk user. Adding passkeys later is a Clerk dashboard toggle on that user. Losing GitHub access is recovered through the Clerk dashboard. `BUDGE_OWNER_SUBJECT` and `CLERK_JWT_ISSUER_DOMAIN` differ per environment, because the development-instance user is a different Clerk user.
- **Session:** the free Hobby plan's fixed 7-day session lifetime. A custom lifetime, MFA, and passkeys all need Clerk Pro (about $25 a month), which is rejected. Signing in again is usually one tap on "Continue with GitHub". The iOS Home Screen app keeps its own storage apart from Safari, so it needs one GitHub sign-in of its own. Add "GitHub sign-in and weekly re-sign-in inside the Home Screen app" to the real-iPhone checks from [What can an iOS PWA do in 2026?](04-ios-pwa.md).
- **Preview deployments:** v1 has them, **as long as they stay within the free tiers**, and they can be turned off without app changes. Each pull request gets a Vercel preview with a Convex preview deployment (preview deploy key in Vercel's Preview environment, the same `npx convex deploy --cmd 'bun run build'` build, `--preview-run` to load the synthetic seed, deleted automatically after 5 days on the free plan). Previews use Clerk development keys and Plaid Sandbox only, never real Bank Connections, because Plaid Trial has 10 lifetime Items. Vercel Authentication protects preview URLs.
- **Free-tier check (October 2026):** Convex free allows 1M function calls a month, 0.5 GB of storage, 1 GB of database I/O a month, and 40 deployments, shared by every cloud deployment, and writes fail once a limit is hit. Vercel Hobby allows 100 deployments a day and 1 build at a time. Clerk Hobby is effectively unlimited for one user. Only **Convex database I/O** is realistically at risk. It is handed to [What does the data model look like in Convex?](11-data-model.md) as a constraint, with read-reducing options and a required estimate from the sample data.

Sources: [Clerk pricing](https://clerk.com/pricing), [Clerk session options](https://clerk.com/docs/guides/secure/session-options), [Convex preview deployments](https://docs.convex.dev/production/hosting/preview-deployments), [Convex limits](https://docs.convex.dev/production/state/limits), [Vercel limits](https://vercel.com/docs/limits).

## Comments

- Owner decision during Clerk setup: support email sign-in alongside GitHub. Keep Email enabled so the development instance can create the CI test user with an email address. This replaces the earlier GitHub-only decision.
- Updated `AGENTS.md`, `docs/agents/authentication.md`, the v1 spec and map, tickets 02, 04, and 23, and `.scratch/setup/wizard.sh`. The wizard enables Email before user creation, explains that the owner chooses the CI email, and accepts an owner without a GitHub connection.
- Verification: Bash syntax, embedded command syntax, setup order, CI secret names, documentation formatting, and `git diff --check` passed. The wizard library is unchanged. The owner subsequently confirmed local sign-in, and all five GitHub Actions secret names are present. The branch is unpublished and has no PR, so no CI run exists for it. The wizard now checks the current commit's e2e result automatically and reports a missing run as pending verification. Remaining work: push the branch, open its PR, and verify CI. Existing setup values do not need to be entered again.

- Cleanup follow-up: the pending branch/PR note above is historical. Ticket 02 shipped in [PR #1](https://github.com/Lomzem/budge/pull/1), with CodeRabbit approval and passing CI, including the post-merge run on `main`. Local setup does not need to be repeated. The setup wizard, authentication documentation, spec updates, and installed Convex agent guidance are retained in Git. The planning map now points to implementation ticket 03.
