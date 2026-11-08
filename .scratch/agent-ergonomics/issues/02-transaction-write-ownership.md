# 02: The Transaction write module owns attaching, detaching and re-homing

**Status:** done

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

- [x] Unmatch, Category delete, file import, and bank changes call only Transaction-module operations for those tables.
- [x] Tests prove that after each operation, search finds or misses the Bank Text and the budget month totals match a rebuild.
- [x] `bun run check` passes, including the ADR 0002 rebuild-equivalence test.

## Comments

**2026-11-07, implementation (24a5e51, branch `ergo/b-convex`):**

- **Operations in `convex/lib/transactions.ts`.** Each one is named for a domain event and decides Cleared state itself, so callers no longer sequence derived writes:
  - `addImportedTransaction` inserts a Transaction as cleared and unapproved, then attaches its Bank Row.
  - `matchBankRow` attaches a Bank Row to an existing Transaction and makes it cleared and unapproved. A reconciled Transaction stays reconciled.
  - `unmatchBankRow` runs the lock check, creates a counted Transaction from the Bank Row, refreshes the search text of both Transactions, and sets the Transaction it left back to uncleared when no Bank Row backs it.
  - `keepAfterBankRemoval` and `updateBankRow` handle bank changes. `updateBankRow` refreshes search text when the Bank Text changes.
  - `holdBankRow` and `dropHeldBankRow` handle held Bank Rows.
  - `markCleared` and `markApproved`.
  - `moveCategoryHistory` re-homes Transactions and split lines, then rebuilds the affected months.
  - `refreshPayeeSearchText` and `PAYEE_RENAME_BATCH` moved here from `lib/search.ts`, which is deleted.
- **Subtracted:**
  - the `deferSearchText` option of `insertTransaction`
  - `insertImported`, which `importedFields` replaces; it returns the fields and writes nothing
  - `lib/search.ts`
- **Callers migrated:** imports.unmatch, categories.remove, lib/imports.applyBankRows, lib/bankChanges, bankConnections, heldAccounts, transactions (setCleared, unlock, approve, approveAll) and reconciliation.
- **Helpers still exported:**
  - `refreshSearchText`, because migrations and seed write raw and must repair search text.
  - `countTransaction` and `rebuildTotals` in `lib/monthlyTotals.ts`, because the ADR 0002 rebuild and the Transaction module use them.
  - A module-private boundary was impossible for these, so an import restriction does the job (below).
- **Enforcement, part 1:** the `local/owned-writes` rule (`eslint/rules/owned-writes.js`) applies to `convex/**/*.ts`. It refuses `*.db.insert|patch|replace|delete` on transactions, transactionSplits, imports and monthlyTotals. It also refuses any such call whose table argument is not a string literal.
  - Exempt files: `lib/transactions.ts`, `lib/monthlyTotals.ts`, `migrations.ts`, `seed.ts`, `*.test.ts` and `test.helper.ts`.
  - Tests are exempt because they forge stored states that no public function produces, such as legacy rows and a drifted cache.
- **Enforcement, part 2:** `no-restricted-imports` keeps `refreshSearchText`, `countTransaction` and `rebuildTotals` out of the same files.
- **Rule tests:** `eslint/rules/owned-writes.test.js` covers the rule logic. `eslint/rules/owned-writes-config.test.js` runs the real config: raw writes are refused in callers and allowed in owners, and the import restriction holds.
- **Fail-on-violation evidence.** I reintroduced a raw `transactions` patch in `convex/imports.ts` and a `rebuildTotals` import in `convex/categories.ts`, then reverted both. eslint reported:
  ```
  convex/categories.ts 16:10 error 'rebuildTotals' import from './lib/monthlyTotals' is restricted from being used by a pattern. Call an operation in convex/lib/transactions.ts; it keeps the monthly totals whole  no-restricted-imports
  convex/imports.ts 117:9 error Write `transactions` through an operation in convex/lib/transactions.ts, which keeps search text, Cleared state, and monthly totals correct  local/owned-writes
  ✖ 2 problems (2 errors, 0 warnings)
  ```
- **Raw writes to the four tables, per production file:**

  | File | Before | After |
  | --- | --- | --- |
  | bankConnections | 3 | 0 |
  | categories | 2 | 0 |
  | heldAccounts | 2 | 0 |
  | imports | 2 | 0 |
  | lib/bankChanges | 9 | 0 |
  | lib/imports | 4 | 0 |
  | lib/monthlyTotals | 7 | 7 |
  | lib/transactions | 11 | 25 |
  | migrations | 1 | 1 |
  | reconciliation | 1 | 0 |
  | seed | 7 | 7 |
  | test.helper | 2 | 2 |
  | transactions | 4 | 0 |

  The "10" for lib/transactions in Problem missed a multi-line `replace`. Test-file counts are unchanged.
- **Tests added (3).** Each was run against a deliberately broken implementation and failed, then passed on the real one:
  1. `imports.test.ts`: "a file import counts a new row in its Payee's Category and a Match once, as a rebuild would".
     - Protects: `budget.month` after an import equals the month after `monthlyTotals.rebuild`, with each row in its Category.
     - Regression it catches: an uncounted imported insert.
     - Gap it fills: earlier import tests checked balances, not budget-month totals.
     - Seam: none.
  2. `imports.test.ts`: "Unmatch counts the new Transaction without moving the one it leaves, as a rebuild would".
     - Protects: totals after Unmatch.
     - Regression it catches: `unmatchBankRow` inserting without counting.
     - Gap it fills: existing Unmatch tests checked balances and search only.
     - Seam: none.
  3. `bankChanges.test.ts`: "the owner's version is no longer found by the removed row's Bank Text".
     - Protects: search after keep-mine on a removed Bank Row.
     - Regression it catches: detaching without refreshing search text.
     - Gap it fills: only Bank Text changes had search coverage.
     - Seam: none.
- **Existing coverage referenced, not duplicated:**
  - search after a Match and after Unmatch, and imported Bank Text (`search.test.ts`)
  - search after a Bank Text change and `expectTotalsRebuild` across bank changes (`bankChanges.test.ts`)
  - Category delete totals equal a rebuild (`categories.test.ts`)
  - the ADR 0002 rebuild-equivalence tests (`monthlyTotals.test.ts`)
- **Test counts:** Convex went from 390 to 393. The full run has 711 tests in 52 files, including 90 eslint-rule tests. All 390 earlier Convex tests passed unchanged after the migration, before the new tests were added.
- **Check:** `bun run check` passed. format:check, lint, lint:ui, typecheck, test and capacity:check were all green. capacity:check reported `passed: true`, maxFileRows 250, and 69.4s.
- **verify-budge:** no feature-file source citation moved. The public Convex functions are unchanged.

