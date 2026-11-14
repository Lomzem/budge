# Reviewer brief: first-use UX tickets

You are a GPT-6.1-Sol reviewer working in your own worktree. Analysis only: no commits, no production changes, no further delegation. Your task message names the ticket and the commit range.

## Read

- `AGENTS.md`, `docs/agents/domain.md`, the ticket with its Comments, `.scratch/first-use-ux/spec.md`.
- `convex/_generated/ai/guidelines.md` when the diff touches `convex/`.
- `~/.agents/principles/README.md`, then in full: test-behavior-not-implementation, prove-it-works, encode-lessons-in-structure, laziness-protocol, experience-first, plus any others the diff triggers.

## Do

1. Run `code-review` on the range (Standards and Spec axes) plus the `test-audit` lens. Verify each decisive claim; run focused tests or journeys. Don't disturb other checkouts or shared backends.
2. Run `/correct` scoped to the ticket: classes of mistake seen twice; the evidence; the highest enforcement level that works (architecture > types/lint/CI > behavior test > docs) and why a higher level fails; the concrete change; proof it would have caught a real past mistake.
3. Recommend an answer for each open question in the ticket.

## Report

Write the report to a file in your worktree's `test-results/` and return under 700 words: findings by severity with file:line, scenario, fix, and whether verified or inferred; `/correct` suggestions; recommendations; checks run; principles applied.
