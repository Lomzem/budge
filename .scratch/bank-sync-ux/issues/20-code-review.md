# 20 — Local code review of the branch

Status: done; test audit and corrections next

The `code-review` skill reviewed `feat/bank-sync-ux` against its merge-base with `main`, on two axes: Spec (issues 01–19) and Standards.
Each axis found 4 findings, and all 8 are fixed.

## Spec

1. **A negative Assigned changed when the field was only focused and left.**
   - Focusing the field showed the amount as typed, and leaving it saved that text back.
   - `assigned-input.svelte` now saves only after an edit. Escape restores the shown amount.
   - Proof: `budget/assign` has a new final step. It failed before the fix (`−80.00`) and passes now.
2. **Connect a bank opened Plaid at the 20 Bank Connection limit.**
   - `connect` now refuses before it creates a link token.
   - When a save is refused because the limit filled meanwhile, the exchanged Plaid Item is removed.
   - Proof: two tests in `convex/plaidWebhook.test.ts`, both failing before the fix.
3. **Bank changes were counted without a bound.**
   - `bankChanged` reads at most 500, through `BANK_CHANGE_LIMIT` in `src/lib/domain/bankChanges.ts`, and reports `complete`.
   - The Budget chip reads `500+ bank changes`.
   - The register says `Resolve them to see the rest.` when the list is cut.
   - An Account-scoped index was rejected, because a bank-linked Transaction can move Accounts.
   - Proof: a test in `convex/bankChanges.test.ts`. Before the fix it fails only on the old number shape.
4. **Malformed filter IDs reached Convex.**
   - A URL like `?account=abc` or `?account=<a Payee id>` reached the query and failed its `v.id` validator. The register then said it couldn't load.
   - The filters module moved to `src/lib/transactionFilters.ts`. `offeredFilters` keeps an `account`, `category` or `payee` only if the filter menus offer it, and drops it from the URL otherwise.
   - The register's queries wait until those lists load.
   - Proof:
     - a new table in `src/lib/transactionFilters.test.ts`;
     - a new `search/filters` step, which failed on the old table and passes now.

## Standards

1. **Hard: an unbounded count in `reconciliation.clearedBalance`.**
   - It read every Cleared Transaction on each rerun.
   - It now reads at most 1,000 Unapproved Transactions of the Account (`by_account_approved_date`) and returns `{ count, complete }`.
   - Past the limit, the dialog says `More than 1,000 Transactions here are still Unapproved…`.
   - Proof: a test in `convex/reconciliation.test.ts`. Before the fix it fails on the shape.
2. **Judgement: a stale `Ignored` outcome hid `Set up` after Bring back on the same page.**
   - An outcome now counts only while that bank Account is no longer held, so held state is authoritative.
   - Proof: a new `accounts/held-ignore` step, which failed before the fix (`Set up` not focused) and passes now.
3. **Judgement: `plaid/late-sync` could not tell which card got which result.**
   - `holdResponseTo` gained `releaseEarliest()`, which releases one held response and says which call it answered.
   - The journey requires that card to show the result while the other still reads `Syncing…`.
   - Mutation check: clearing every connection's syncing state on one finish fails the journey. The real code passes 3 of 3 runs.
4. **Hard: stale verify-budge recipes.**
   - The 320 px `View …` menu became the `Sections` tab bar, in `features/README.md` and `SKILL.md`.
   - The phone inspector is now a dialog, in `features/inspector.md`.

## Verification

- These pass: `bun run lint`, `lint:ui`, `typecheck`, `format:check`, `codegen:check` and `bun run test` (837 tests).
- Full journeys: 39 of 39 pass.
- Feature maps updated: bank-changes, budget, transactions, accounts, plaid, reconciliation, inspector, README, SKILL.
