# 21 — Test audit and corrections

Status: done

GPT-6.1-Sol ran the test-audit gate and `/correct` (analysis only) on `2bfb78d`. Opus decided each item below.

## Test audit: fixed

- `convex/bankConnections.test.ts`, `keeps the exchanged token when Plaid refuses the webhook update`:
  - It now decrypts the saved token with `TokenCipher` and requires the original access token.
  - Saving the Item ID in its place fails the test (mutation run, then restored).
- `convex/heldAccounts.test.ts`: the ITEM_NOT_FOUND test is renamed to what it proves, `accepts ITEM_NOT_FOUND when removing the remote Item`.
- `budget/assign`: Enter and ArrowDown must focus `Assigned for Dining Out` itself, not any other Assigned field.
- `inspector/move-money`, phone step: it expects `Next Category: Dining Out`, that Category's focused Assigned field, and `Previous Category` returning to Groceries.
- `transactions/approve-all-undo`:
  - `Approve N shown` must leave a non-bookshop Unapproved row Unapproved, checked after clearing the search.
  - Undo is per view, so the step searches again before pressing it.
  - `Undo` after `Approve all` must restore the same rows, by accessible name.
- `src/lib/domain/money.test.ts`: the `parseCentsSum` rows moved into the `parseAssigned` tables. `parseCentsSum` is no longer exported; its only caller is `parseAssigned`.

## Test audit: deferred

- **A read budget for the bounded counts** (`bankChanges`, `reconciliation`). `convex-test` counts no reads except search candidates. Counting them would need a wrapper around `ctx.db` in tests, which is the test-only seam the gate rejects.
  - The bound is the `.take(LIMIT + 1)` read in each query.
  - The over-limit tests pin `complete: false`.

## /correct: accepted

1. **Phone geometry.**
   - `expectClearOf(subject, ...others)` in `e2e/journeys/journey.ts` requires the subject fully in the viewport, with no overlap with the given overlays.
   - `transactions/approve-phone` (320×640) checks:
     - the first Transaction sits above the tab bar without scrolling;
     - the dialog's Category and Save scroll clear of its pinned header.
   - `budget/assign` (390×844) checks the invalid-Assigned hint is clear of the next Category's row and of the tab bar.
   - The check found a real bug: the hint's last line (`Esc restores.`) sat under the tab bar. Two fixes:
     - Below `lg`, `html` has `scroll-padding-bottom` for the tab bar.
     - The hint scrolls itself into view (`nearest`) when it appears.
   - Without the fix, the step fails with `navigation "Sections" overlaps "Try 120.00, 100+20 or +5. Esc restores."`.
2. **Focus, where no journey checked it.**
   - `imports/approve`: `Import file` from an Account opens on the File field.
   - `categories/manage`: a menu opened by click focuses `Rename`, and Escape returns to its trigger.
   - Focus after a delete was already checked in `transfers`; split refusals were checked in `splits`; Escape in Settings was checked in `settings/cutover`.
3. **Plaid retry policy.**
   - `post` in `convex/lib/plaidClient.ts` now takes its `CallLimits` as a required argument, so every endpoint names `SAFE_TO_REPEAT`, `EXACTLY_ONCE` or `WITHIN_PLAIDS_WEBHOOK_DEADLINE`.
   - The exchange's single attempt keeps its test, and the decrypted-token test above covers the token kept after a webhook refusal.

## /correct: rejected

4. **A lint rule against unbounded query reads.** 40 reads in `convex/` walk a whole table or index on purpose, and the rule would have to exempt every one:
   - Budget, Accounts and Categories read every row of a one-owner budget;
   - the monthly-totals rebuild in ADR 0002;
   - migrations and the seed.

   A baseline that large teaches nothing. The two counts that can grow without bound are already capped and report `complete`.
5. **Separating receipts from state.**
   - The held-Account outcome now comes from current held state (issue 20).
   - The `stopSyncing` notice already takes its name before the `await` (issue 14).
   - Passing each dialog's title as a prop would repeat every `Dialog.Title` text at each call site. Instead, `dialog-content.svelte` reads the title each time the dialog opens and scrolls (issue 18).
6. **Moving recipes into journeys.** The two stale recipes were fixed in issue 20, and `featureMap.test.ts` already ties the map to the journeys that exist. What remains in the feature map is manual-drive detail, not runnable steps.

## AGENTS.md

Two new enforced-rule rows:

- Plaid endpoint retry policy.
- Phone content clear of the tab bar and the pinned dialog header.

## Verification

See the commit for the check results; the journeys are rerun in full because `scroll-padding-bottom` applies app-wide.
