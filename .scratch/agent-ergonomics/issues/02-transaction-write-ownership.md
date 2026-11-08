# 02: The Transaction write module owns attaching, detaching and re-homing

**Status:** ready-for-agent

**Spec:** [Agent ergonomics](../spec.md), scope 2

**Blocked by:** 05 (new tests use its scenarios)

## Problem

Callers sequence derived writes by hand:

- Unmatch (`convex/imports.ts` ~119-122) calls `insertImported`, patches the Bank Row, calls `refreshSearchText` twice, and sets the Transaction to uncleared when no Bank Rows remain.
- Category delete (`convex/categories.ts` ~203-222) patches transactions and transactionSplits, gathers months, and calls `rebuildTotals`.
- `convex/lib/imports.ts` (~174, 189) calls `insertImported` and then `refreshSearchText`.
- `convex/lib/bankChanges.ts` has 9 raw writes.

Raw writes to the transactions, transactionSplits, imports, and monthlyTotals tables, by file: bankConnections 3, categories 2, heldAccounts 2, imports 2, lib/bankChanges 9, lib/imports 4, lib/monthlyTotals 7, lib/transactions 10, migrations 1, reconciliation 1, seed 7, test.helper 2, transactions 4.

## What to build

- Add complete operations to `convex/lib/transactions.ts`: attach a Bank Row to a Transaction, detach it (Unmatch), and move a Category's history to another Category. Each operation keeps search text, Cleared state, and monthly totals correct. Callers no longer call `refreshSearchText`, `rebuildTotals`, or the totals updaters.
- Migrate the callers above. Make the search-text and totals helpers module-private where no other legitimate writer remains (the ADR 0002 rebuild stays).
- If it holds after migration, enforce it: raw `ctx.db.insert/patch/replace/delete` on those tables is allowed only in the owner modules, the migrations, and the seed, through a lint rule or a module-private boundary. Prove the check fails on a reintroduced raw write. Report the rule row for AGENTS.md.
- Behavior tests observe outcomes through public functions (search, list rows, the budget month), not helper calls.

## Acceptance

- [ ] Unmatch, Category delete, file import, and bank changes call only Transaction-module operations for those tables.
- [ ] Tests prove that after each operation, search finds or misses the Bank Text and the budget month totals match a rebuild.
- [ ] `bun run check` passes, including the ADR 0002 rebuild-equivalence test.

## Comments
