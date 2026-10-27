# How is the repo set up?

Type: grilling
Status: open
Blocked by: 03, 13

## Question

How is the repo set up: Bun workspace layout for SvelteKit plus Convex, ESLint with shadcn-lint, Prettier, lefthook pre-commit checks (lint, format, typecheck, tests), CodeRabbit configuration, and keeping secrets and personal data out of a public repo (env files, gitignore, secret scanning)?

## Comments

- From [Where does Effect go in Budge?](14-effect-boundaries.md): the typecheck step must run `@effect/language-service` diagnostics (`@effect/tsgo` on TypeScript 7), not just plain `tsc`; tests run under Vitest 5 via `bun run test`; pin `effect` and `@effect/vitest` to the same exact version and never install `@effect/platform`.
