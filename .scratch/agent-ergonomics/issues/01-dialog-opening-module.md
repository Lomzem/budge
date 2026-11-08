# 01: One dialog opening module for every async dialog

**Status:** done

**Spec:** [Agent ergonomics](../spec.md), scope 1

**Blocked by:** None

## Problem

`src/lib/dialogSession.svelte.ts` (`DialogSession`) is the documented guard: an async result lands only in the opening that started it. Only 4 dialogs use it: the Starting Balance on `src/routes/(app)/accounts/[accountId]/+page.svelte`, `shell/bank-connections.svelte`, `shell/held-accounts.svelte`, and `transactions/transaction-dialog.svelte`. About 10 async dialogs have no guard: account-dialog, reconcile-dialog, rename-account-dialog, add-category-dialog, target-dialog, delete-group-dialog, delete-category-dialog, export-dialog, and starting-balance-step. Two more roll their own:

- `categories/rename-dialog.svelte` guards by target id (`openFor() !== item.id`) and clears `saving` before the check. If you dismiss and reopen the same item, the old result lands. This is a live bug.
- `transactions/import-dialog.svelte` uses `let session = 0` counters.

The mistake has been corrected at least 5 times.

## What to build

- Deepen `DialogSession` so the opening also owns its pending operation: start it, track pending state, and deliver its result or publicError only to the opening that started it. A dialog must not be able to write a late result into a newer opening.
- Migrate every async dialog to it, then delete the hand-rolled counters, the id checks, and any old interface member nothing uses.
- Fix the rename-dialog bug through the migration, and prove it with a delayed-response E2E (`e2e/heldResponse.ts`). The proof must fail before the fix.
- Update the AGENTS.md rule wording in the ticket comments (the coordinator edits AGENTS.md).

## Acceptance

- [x] No async dialog applies a mutation or action result without going through the opening module (grep proof in the comments).
- [x] The rename dialog's stale-result regression fails before the fix and passes after it.
- [x] Existing delayed-response E2E and dialog E2E specs pass; `bun run check` passes.
- [x] The verify-budge feature files that cite the changed dialogs still describe them correctly.

## Comments

Implemented in `b9de9c4` on `ergo/a-dialogs-editor`.

**Decisions**

- `DialogSession<Opening, Operation>` owns each opening's pending work. `open(opening)` starts an opening, `pending(operation)` reports the current opening's pending state, and `run(operation, work)` returns the `Attempt` only to the latest run of that operation in the opening that started it. Any other run never settles, so the code after `await` (close, goto, error text) cannot touch a newer opening. `current`, `close` and `dismiss` keep their meaning.
- Each run is counted per operation, not per opening, because the import dialog can read a second file while the first is still being read. The last file chosen wins, as the old `session` counter did. Every other dialog disables its control while the run is pending.
- Migrated: account, reconcile, rename-account, starting-balance-step (`suggest`, `confirm`), add-category, target, delete-category, delete-group, rename-category, export (`export`), import (`read`, `save`), held-accounts, bank-connections (`sync`), and transaction (`write`). Deleted: rename-dialog's `openFor()` id check, import-dialog's `session`/read counters, the `TookTheDialogOver` guards, and add-category's `bind:saving` (pages call the exported `saving()`).
- account-dialog navigates to the new Account only after a landed result. A `goto` rejection is no longer turned into an Add error. Flagged below.
- The remaining direct `attempt` callers are not dialogs: account reorder on the Account page, Category moves on the Categories page, Bank Connection reconnect (routed by connection), cutover date, the transaction table's Cleared/Approve, the Category inspector, and the Assigned input.

**Grep proof** (every `.svelte` file with a `Dialog.Root`/`AlertDialog.Root`/`DialogSession` and a mutation or action):

```
bank-connections run=1 attempt=0     held-accounts run=1 attempt=0
export-dialog run=1 attempt=0        rename-account-dialog run=1 attempt=0
account-dialog run=1 attempt=0       starting-balance-step run=2 attempt=0
reconcile-dialog run=1 attempt=0     add-category-dialog run=1 attempt=0
import-dialog run=2 attempt=0        transaction-dialog run=1 attempt=0
delete-group-dialog run=1 attempt=0  delete-category-dialog run=1 attempt=0
rename-dialog run=1 attempt=0
```

`target-dialog` saves through `budget.setTarget` inside `dialog.run('save', …)`. `grep -rnE "openFor|TookTheDialogOver|bind:saving|let session = 0" src` finds nothing.

**Proposed AGENTS.md row** (replaces the current DialogSession row): "An async dialog result lands only in the latest run of its operation in the opening that started it, and its pending state belongs to that opening." | `DialogSession.run`/`pending` in `src/lib/dialogSession.svelte.ts`; no dialog calls `attempt` directly; the delayed-response E2E in `e2e/categories.test.ts` and the others built on `e2e/heldResponse.ts`.

**Test-audit gate:** `e2e/categories.test.ts` › "a rename that finishes after its dialog closed leaves the reopened dialog alone"

1. The protected behavior: a rename result that arrives after Escape does not close, error or disable the reopened Rename dialog for the same Category.
2. The regression it catches: rename-dialog's old id check (`openFor() !== item.id`) passes when the same Category is reopened, so the late result closed the new opening.
3. Existing proofs miss it because the other delayed-response tests cover the transaction, starting-balance and import dialogs, and none covers rename's same-target reopen. DialogSession can't be unit-tested: the `lib` vitest project has no Svelte plugin to compile runes. The browser is the only boundary that exercises it.
4. No test-only seam: it holds the real `categories:rename` mutation response through the existing `e2e/heldResponse.ts`.

**Checks**

- Fail before the fix (new test on the unfixed dialog): `timeout 590 bun run test:e2e:local e2e/categories.test.ts` gave 1 failed and 1 passed. The new test failed at `toHaveAttribute('data-state', 'open')` and received `"closed"`.
- Pass after: the same command gave 2 passed (24.9s).
- `bun run check` with the app up: exit 0, 50 files and 687 tests, capacity ok.
- Full suite, `timeout 1700 bun run test:e2e:local`: 33 passed (4.0m). The Clerk "FAPI request failed … Test ended" lines are teardown noise.
- After the import last-file-wins fix: lint and typecheck ok. `bun run test:e2e:local` on categories, import, export, bank-connections, starting-balance and held-accounts gave 12 passed (1.8m).
- verify-budge (`budget-with-accounts`): Add Category from Budget persisted after a reload. The held `categories:rename` with Escape and a reopen left the reopened dialog open with the old Name, Save enabled and no alert, and the rename applied. A second-opening save persisted. Evidence: `test-results/verify-budge/ergo-01-dialogs-20261107-192743-retry/` (assertions.txt reads `RESULT pass`). The first attempt's driver picked the Credit Card Payments group, and that evidence is kept beside the retry.
- verify-budge feature map: `categories.md` gained the late-rename journey and the Add Category group gotcha. The other feature files that cite the migrated dialogs (accounts, reconciliation, targets, import, export, bank-connections, starting-balance) describe unchanged user journeys.
- Review: the `code-review` skill was not run because it spawns sub-agents, which this run's brief forbids. An inline self-review of the diff found the lost import last-file-wins behavior, fixed by per-operation run counts.

**Open**

- `bun run app doctor` reports `FAIL convex/_generated is fresh: stale api.d.ts`. This predates the branch: it shows on a clean tree at `62830be`.
- account-dialog: a rejected `goto` after a successful add is now unhandled rather than shown as an Add error.

