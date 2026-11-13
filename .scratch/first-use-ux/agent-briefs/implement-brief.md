# Implementer brief: first-use UX tickets

You are a fresh Opus 5.5 implementer. The user authorized implementation of the first-use UX spec on 2026-11-12 (`/implement`). Your task message names one ticket under `.scratch/first-use-ux/issues/` and may add owner decisions; those decisions are binding.

## Where

- Work in `/home/lomzem/proj/budge` on branch `feat/first-use-ux`. Commit there.
- Do not push, open a PR, merge, or touch `main`.
- Read the ticket's Comments and the Comments of the tickets it is blocked by: they hold binding decisions.

## Read first

- `AGENTS.md`, `CLAUDE.md`, `docs/agents/domain.md`, `convex/_generated/ai/guidelines.md`, `docs/agents/authentication.md`, `.agents/skills/verify-budge/SKILL.md`.
- `~/.agents/principles/README.md`, then read in full: laziness-protocol, experience-first, test-behavior-not-implementation, prove-it-works, sequence-verifiable-units, boundary-discipline, model-the-domain.
- Also read in full when their triggers apply: make-operations-idempotent, separate-before-serializing-shared-state, foundational-thinking, type-system-discipline.

## How

1. Run `/principles` before designing, before writing tests, and before finishing.
2. Work test-first with the `tdd` skill. Pass every test you add or change through the `test-audit` authoring gate, and keep red and green evidence.
3. UI: shadcn-svelte primitives; works on phone, with keyboard and on desktop. Obey the enforced rules: dialogs run async work through `DialogSession.run`, pickers use `SelectField`, scrolling uses ScrollArea.
4. Typecheck and run single tests as you go. Before each commit, run `bun run check` plus the affected journeys. Run the full E2E suite (`bun run test:e2e:local`) once before finishing. `capacity:check` refuses in the main checkout; run it in a temporary worktree via `bun run app up` when your change touches capacity.
5. Prove the features with verify-budge evidence, and update its feature map when a feature changes. Stop every app you start.
6. Make small commits with hooks running. Never bypass hooks. Keep secrets out of commands, files, logs and output.
7. Do not run `code-review` or `/correct`; a separate reviewer does. Never touch live or production data.

## Finish

- Set the ticket's Status to `landed — review pending`.
- Append Comments: decisions, changed files, tests with red and green evidence, checks run, evidence paths, open questions.
- Report in under 400 words: commit range, what changed, checks, evidence, the principles that changed a choice and the choice they changed, open questions.
