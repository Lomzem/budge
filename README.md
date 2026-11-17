# budge

A personal zero-based budget. Production runs at [budge.lomzem.dev](https://budge.lomzem.dev).

## Agent access

Agent access lets Claude Code and Codex read the production budget and apply Categorization Proposals you approve. Run setup after `bun install` and `bunx convex login`, from a checkout already linked to the Budge Convex project so that `--prod` reaches its production deployment.

```sh
bun run agent setup --prod
```

Setup writes a new Agent Key to `~/.config/budge/agent.json` by default and makes production accept only that key. It then registers the `budge` tools with the Claude Code and Codex CLIs you have installed. The registered tools run from this checkout, so keep it in place. Start a new Claude Code or Codex session, such as a new T3 Code thread, to pick them up. Then ask something like "What is my Ready to Assign this month?"

```sh
bun run agent rotate  # replace the Agent Key
bun run agent revoke  # turn agent access off and delete the local key
```

If production refuses the key, run `bun run agent setup --prod` again. Run `bun run agent` to list every option.

## Development

Needs [Bun](https://bun.com) and [gitleaks](https://github.com/gitleaks/gitleaks), which the pre-commit hook runs.

```sh
bun install          # also installs the git hooks
bun run dev:backend  # Convex backend. On first run, choose a local deployment.
bun run dev          # the app
```

To sign in locally, put the Clerk development keys in `.env.local` and activate that instance's [Convex integration](https://docs.convex.dev/auth/clerk). Then point the local backend at that Clerk instance and make your Clerk user the owner.

```sh
bunx convex env set CLERK_JWT_ISSUER_DOMAIN <Frontend API URL>
bunx convex env set BUDGE_OWNER_SUBJECT <your Clerk user ID>
```

`bunx convex run seed:run` fills an empty local backend with synthetic Accounts and Transactions.

`bun run check` runs the checks and unit tests. `bun run test:e2e:local` runs the Playwright suite on its own disposable backend, as [docs/agents/authentication.md](docs/agents/authentication.md#local-e2e) describes. `.env.example` lists every environment variable and where it lives.
