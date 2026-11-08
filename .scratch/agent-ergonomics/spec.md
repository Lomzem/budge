# Agent ergonomics: deeper modules for changing and verifying Budge

Status: in progress

Source: architecture review of `main @ 3915087` (candidates 1–5; candidate 6 stays speculative and out of scope).

## Goal

Make the next agent's change smaller and its proof cheaper. Each recurring mistake class gets one owner module whose interface makes the mistake hard to write, and verification reuses the E2E journeys instead of retyping them.

## Scope

1. **Dialog opening module** ([01](issues/01-dialog-opening-module.md)). `DialogSession` owns the pending operation and its result. Every async dialog uses it, and the per-dialog guards are deleted.
2. **Transaction write ownership** ([02](issues/02-transaction-write-ownership.md)). `convex/lib/transactions.ts` gets complete operations for attaching or detaching a Bank Row and moving a Category's history. Search text and monthly totals stay private behind them.
3. **Transaction editor** ([03](issues/03-transaction-editor.md)). A framework-free module holds the draft state and transitions behind `transaction-dialog.svelte`. An unresolved Category choice cannot be saved.
4. **Shared journeys** ([04](issues/04-shared-journeys.md)). E2E specs and verify-budge drive the same journey functions. verify-budge runs them against the running app with evidence capture.
5. **Named Convex test scenarios** ([05](issues/05-convex-test-scenarios.md)). A few scenario constructors over public mutations replace each suite's copied setup.

## Constraints

- User-visible behavior may change where it improves the product (user decision, 2026-11-07). Each change is named in its ticket's Comments and proven by a test or a verify-budge journey.
- ADR 0001 (plain Convex functions with `v.*` validators), ADR 0002 (the monthlyTotals rebuild-equivalence test stays), and ADR 0003 (capacity limits, publicError, the pure domain module, serial E2E) hold.
- Each ticket migrates its callers and deletes the legacy API in the same ticket.
- Each new or changed test passes the `test-audit` authoring gate.
- When a structural rule becomes enforceable, it gets a row in the AGENTS.md "Enforced rules" table. The coordinator writes those rows.
- Every subagent, whether implementer, reviewer, or scout, runs the principles skill (`~/.claude/skills/principles/SKILL.md`, which re-reads `~/.agents/principles/README.md` and every matching reference) before designing, before writing tests, and before declaring completion. It reports the principles that changed a choice. This is a user requirement from 2026-11-07.
- One integration branch, `refactor/agent-ergonomics`, and one PR into `main`. The user waived CodeRabbit for this PR; the merge gate is green CI.

## Done when

- `bun run check` and `bun run test:e2e:local` pass on the integration branch.
- verify-budge's maintenance pass (`/maintain-verification-skill`) covers every feature live, with evidence in `test-results/verify-budge/`.
- CI is green on the PR. The PR is merged, and the Vercel production deployment of the merge commit succeeds.

## Cleanup (after merge)

The user asked for this on 2026-11-07. Remove worktrees, branches, and scratch files that are no longer needed.

- A worktree or branch whose commits are all on `main` and that has no uncommitted changes can be removed.
- A worktree or branch with unmerged commits or uncommitted edits is listed for the user, not deleted.
- Untracked user files, such as `.scratch/v1/deployment-wizard.sh` and `docs/research/`, are listed for the user, not deleted.
