# budge

budget

## Development

Needs [Bun](https://bun.com) and [gitleaks](https://github.com/gitleaks/gitleaks) (a system binary; the pre-commit hook runs it).

```sh
bun install          # also installs the git hooks
bun run dev:backend  # Convex backend; on first run, choose a local deployment (no cloud quota)
bun run dev          # the app
```

Signing in needs the Clerk development instance: put its keys in `.env.local`, then point the local backend at it and make your Clerk user the owner:

```sh
bunx convex env set CLERK_JWT_ISSUER_DOMAIN <Frontend API URL>
bunx convex env set BUDGE_OWNER_SUBJECT <your Clerk user ID>
```

Scripts for checks and tests are in `package.json`. Run the Playwright suite with `bun run test:e2e:local`. It uses its own disposable backend, never the one above; see [docs/agents/authentication.md](docs/agents/authentication.md#local-e2e). Variable names and where each one lives are in `.env.example`.

To fill an empty local backend with synthetic Accounts and about three months of Transactions:

```sh
bunx convex run seed:run
```

It refuses once any Account exists, and on a deployment where `BUDGE_PRODUCTION` is set.

## Deployments

Production is [budge.lomzem.dev](https://budge.lomzem.dev). Vercel deploys the
SvelteKit frontend and Node 24 SSR. Its build command deploys Convex and injects
the matching backend URL:

```sh
npx convex deploy --cmd 'bun run build' --cmd-url-env-var-name PUBLIC_CONVEX_URL --preview-run seed:run
```

The app embeds `PUBLIC_CONVEX_URL` during the build. CI uses an explicit localhost
value for type generation. Vercel supplies each build with its matching backend
URL through the deploy command.

Vercel Production uses a production Convex deploy key and Clerk production keys.
Preview uses a separate preview deploy key and Clerk development keys. New Convex
previews load synthetic Accounts and Transactions and expire after five days.
Vercel Authentication protects preview URLs. Keep `BUDGE_PRODUCTION` absent from
all non-production backends, including Preview defaults.

Activate Clerk's Convex integration separately on Production and Development.
The app uses the standard session token and requires its `aud: "convex"` claim.
Cloning an instance does not activate that integration on the new instance.

Check shared backend usage in the [Convex dashboard](https://dashboard.convex.dev/)
under the team's Usage page. Production, cloud dev, and previews share its limits.
Check hosting usage in the [Vercel dashboard](https://vercel.com/dashboard) under
the team's Usage page, filtered to Budge. Review a preview's measured database
I/O and storage against the current plan limits before completing ticket 04.
The cloud dev deployment pauses after 1000 function calls per UTC day.

The Vercel Ignored Build Step avoids full builds and Convex preview creation for
changes limited to `.scratch/**`, `docs/**`, and Markdown files. It builds if the
previous successful deployment's commit is unavailable. Canceled builds still
count toward Vercel's deployment quotas and concurrent build slots.

[Ticket 04](.scratch/v1/issues/04-production-and-preview-deployments.md) records
setup evidence and remaining manual checks. Credentials belong in the provider
dashboards and the password manager. Do not save them in the repository.
