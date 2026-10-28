# budge

budget

## Development

Needs [Bun](https://bun.com) and [gitleaks](https://github.com/gitleaks/gitleaks) (a system binary; the pre-commit hook runs it).

```sh
bun install          # also installs the git hooks
bun run dev:backend  # Convex backend; on first run, choose a local deployment (no cloud quota)
bun run dev          # the app
```

Scripts for checks and tests are in `package.json`. Variable names and where each one lives are in `.env.example`.
