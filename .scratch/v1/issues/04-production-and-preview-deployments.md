# 04: Production and preview deployments

**What to build:** Budge is live at `budge.lomzem.dev`. It uses production Convex and a Clerk production instance where only I can sign in with GitHub. Every pull request gets a preview of its own on a Convex preview deployment, loaded with the synthetic seed and protected by Vercel Authentication. All of it stays within the free tiers. Most steps are dashboard, DNS, and OAuth work only the owner can do: the agent writes a `wizard` script for them, and the owner runs it.

**Blocked by:** 03 (Manual Accounts and Transactions)

**Status:** ready-for-human

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 2, 4, 130–131, 133, 135–136; Environments, deployment, and free-tier limits

- [ ] The Vercel project is linked to the repo, and its Git integration deploys previews and production. Production builds with `npx convex deploy --cmd 'bun run build'` and the production `CONVEX_DEPLOY_KEY`. SSR runs on the Node runtime.
- [ ] Clerk production instance on `budge.lomzem.dev`. Its DNS records (Frontend API, Account Portal, email/DKIM) and Vercel's record are added in Cloudflare as DNS-only. The owner's own GitHub OAuth app points its callback at Clerk. Invite-only, with only the owner's verified GitHub email invited.
- [ ] Production Convex env holds `BUDGE_OWNER_SUBJECT`, `CLERK_JWT_ISSUER_DOMAIN`, `BUDGE_TOKEN_KEY`, the production flag, and Plaid Trial credentials. Vercel Production env holds the production Convex URL and Clerk production keys.
- [ ] The Vercel Preview environment holds a Convex preview deploy key and Clerk development keys, and the build uses `--preview-run` to load `seed:run`. Convex default preview env vars are set for the Clerk dev instance, Plaid Sandbox, and a throwaway `BUDGE_TOKEN_KEY`. Vercel Authentication protects preview URLs.
- [ ] A Vercel Ignored Build Step skips the build (and so the Convex preview deployment) when a push changes only `.scratch/**`, `docs/**`, or Markdown files. One docs-only push proves it.
- [ ] The cloud dev deployment exists only for Plaid Sandbox webhooks and real-iPhone checks, and has a daily function-call usage limit that pauses it.
- [ ] The README notes where to check Convex team usage and Vercel usage. One preview's I/O and storage are checked against the free tier after it deploys.
- [ ] Production signs in as the owner with GitHub, and a second GitHub account is refused.
