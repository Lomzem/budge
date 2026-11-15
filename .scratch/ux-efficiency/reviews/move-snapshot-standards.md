# Move snapshot — Standards and test-audit recheck

**P2 S1 resolved; no remaining finding.** Pinned `git diff d41e5eb...2ff1448` (four files; sole commit `2ff1448`).

`category-inspector.svelte:143–155` captures submitted From/To, cents and Amount text before awaiting. Both `budget.moveMoney` and the success status consume `sent`; swapping cannot reverse the announcement. Success clears only unchanged Amount text, retaining a newer `7.00` draft. Cover captures its Category name before awaiting (`:162–171`). This satisfies ticket 06’s S1 disposition and `docs/quality/ui-review/rubric.md`’s truthful-feedback requirement.

Test-audit passes: `e2e/journeys/inspector.ts:73–105` extends the existing owner journey with a distinct pending-operation lifecycle risk. `pausableSync` forwards real requests and queues real server frames; it fabricates neither the mutation result nor expected balances. The journey swaps/retypes while pending, asserts the exact submitted-direction status and preserved draft, independently expects −1,000/+1,000 cents before and after reload, then reverses the move. This catches the reported regression without a production test seam or internal-call assertions.

Inspected historical `summary.json` files under `/home/lomzem/.t3/worktrees/budge/t3-0957aeec-d0baf4154befc730/test-results/verify-budge/`: `red-move-snapshot` fails on the reversed status; `green-move-snapshot` passes; `green-move-snapshot-2` passes both inspector journeys. All identify dirty `420daed` checkouts, not exact-commit verification. The Cover rename-during-pending case is source-reviewed, not independently exercised here.

All twelve baseline smells considered as judgment calls; none actionable. Repo overrides respected; tooling-enforced rules excluded. Feature-map prose matches added coverage. Fresh `git diff --check d41e5eb...2ff1448` passes.

Principles: Model the Domain favored one submitted-command snapshot; Experience First required truthful feedback and draft retention; Test Behavior, Not Implementation retained real transport/reload proof; Prove It Works separated historical evidence from fresh verification; Laziness Protocol rejected extra abstraction; Guard the Context Window kept this recheck bounded.

No source edits, app/browser/full-suite runs, commits or delegation. No rendered-UI approval claimed; parent owns integration checks and UI judging.
