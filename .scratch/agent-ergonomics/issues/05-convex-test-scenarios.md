# 05: Named budget scenarios for Convex tests

**Status:** ready-for-agent

**Spec:** [Agent ergonomics](../spec.md), scope 5

**Blocked by:** None

## Problem

`convex/test.helper.ts` (81 lines) shares only auth and errors: `newBackend`, the owner identity, and `publicError*`. Each suite rebuilds a usable budget its own way, and 21 suites call `setCutoverDate` themselves. New regressions copy the nearest suite's setup.

## What to build

- A few explicit scenario constructors in the Convex test helpers. For example: a signed-in owner with a cutover date; a cash budget with a Checking Account and a Category Group with Categories; a Card. Build each one only from public mutations, so no hidden Transactions or balances. Return the ids the test needs, with amounts visible at the call site.
- Migrate suites where it removes copied setup. Don't migrate a suite whose setup is the behavior under test.
- Test helpers are test-only. Production code gets no new exports for them.

## Acceptance

- [ ] The suites that copied cutover, Account, and Category setup use the scenarios; the net test LOC change is reported.
- [ ] No migrated test changes what it asserts (the per-suite test counts stay the same, or the comments explain any difference).
- [ ] `bun run check` passes.

## Comments
