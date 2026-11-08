# 01: One dialog opening module for every async dialog

**Status:** ready-for-agent

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

- [ ] No async dialog applies a mutation or action result without going through the opening module (grep proof in the comments).
- [ ] The rename dialog's stale-result regression fails before the fix and passes after it.
- [ ] Existing delayed-response E2E and dialog E2E specs pass; `bun run check` passes.
- [ ] The verify-budge feature files that cite the changed dialogs still describe them correctly.

## Comments
