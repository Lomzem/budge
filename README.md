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

Scripts for checks and tests are in `package.json`. Variable names and where each one lives are in `.env.example`.

To fill an empty local backend with synthetic Accounts and about three months of Transactions:

```sh
bunx convex run seed:run
```

It refuses once any Account exists, and on a deployment where `BUDGE_PRODUCTION` is set.
