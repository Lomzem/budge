# 05: Named budget scenarios for Convex tests

**Status:** done

**Spec:** [Agent ergonomics](../spec.md), scope 5

**Blocked by:** None

## Problem

`convex/test.helper.ts` (81 lines) shares only auth and errors: `newBackend`, the owner identity, and `publicError*`. Each suite rebuilds a usable budget its own way, and 21 suites call `setCutoverDate` themselves. New regressions copy the nearest suite's setup.

## What to build

- A few explicit scenario constructors in the Convex test helpers. For example: a signed-in owner with a cutover date; a cash budget with a Checking Account and a Category Group with Categories; a Card. Build each one only from public mutations, so no hidden Transactions or balances. Return the ids the test needs, with amounts visible at the call site.
- Migrate suites where it removes copied setup. Don't migrate a suite whose setup is the behavior under test.
- Test helpers are test-only. Production code gets no new exports for them.

## Acceptance

- [x] The suites that copied cutover, Account, and Category setup use the scenarios; the net test LOC change is reported.
- [x] No migrated test changes what it asserts (the per-suite test counts stay the same, or the comments explain any difference).
- [x] `bun run check` passes.

## Comments

**2026-11-07, implementation (334c3b4, branch `ergo/b-convex`):**

- **Decision:** one constructor, `startBudget({ cutoverDate = '2026-08-01', accounts, groups })` in `convex/test.helper.ts`, built only from public mutations (`settings.setCutoverDate`, `accounts.create`, `categories.createGroup`/`create`). Accounts are written `{ Checking: ['cash', 100_000] }`, so type and starting balance show at the call site. It returns the backend plus `accounts`, `groups` and `categories` keyed by name, and `readyToAssignId`. One parameterised constructor replaced the three sketched in "What to build", because the suites differ only in which Accounts and Categories they name.
- **Migrated:** 18 suites (accounts, bankChanges, bankConnections, budget, categories, creditCards, heldAccounts, importedTransfers, imports, migrations, monthlyTotals, payees, plaidWebhook, reconciliation, search, splits, transactions, transfers).
- **Not migrated:** `setCutoverDate` stays where the cutover date is the behavior under test: owner (auth), seed, settings, the "moving the cutover date" test in transactions, and one accounts test.
- **Counts:** 390 Convex tests before and after. Per-suite counts are identical, and no assertion changed.
- **LOC:** 19 files, +190/−296, so test LOC is down 106 net. That figure includes the +38 in `test.helper.ts`.
- **Test-audit gate:** no tests were added. The constructor is test-only, so production gained no exports or seams. Every migrated suite still asserts through public functions.
- **Check:** `bun run check` passed. format:check, lint, lint:ui, typecheck (app and Convex), test and capacity:check were all green; capacity:check ran with the worktree app up.

