# 02 — Simplify Transaction review and entry

Status: ready-for-agent

Implement spec items 13–20. Fresh Opus implementor. Update this file with decisions, item coverage, changed files, checks, evidence, and remaining work. Avoid Budget/Categories files and items 21–26. Feature verification, local review, corrections, and three-judge gate are required before done; parent coordinates review.

## Implementation record (Opus implementor, branch `t3/transactions-efficiency-slice`)

Not done: waiting on the parent's local code review, `/correct`, and the three-judge UI gate.

Worktree: `/home/lomzem/.t3/worktrees/budge/t3-31b947c5-5d3de6743af1f7ef`. No Convex or backend change.

### Item coverage

| Item | Disposition | Where | Proof |
| ---- | ----------- | ----- | ----- |
| 13 Active-filter chips while Filters is folded | Done | `transaction-filters.svelte`: an `Active filters` list, one removable chip per filter (From and To together make one Dates chip); the toggle count equals the chip count; chips hide while the panel shows | `search/phone` (two chips, count 2, removal moves focus to the next chip and then the toggle, URL params dropped, nothing past the right edge at 320 px) |
| 14 Searchable Category filter | Done | Category filter uses the existing `CategoryPicker` (Popover + Command) | `search/filters` (`gif` finds Gifts and the Warehouse split) |
| 15 Searchable exact-Payee filter | Done | Payee filter uses `CategoryPicker` with `Search Payees`, and its values are Payee ids | `search/filters` (`land` leaves only Sample Landlord; URL has `payee`, no `q`; the Search box stays empty) |
| 16 Date presets | Done | `dateRanges`, `dateRangeOf`, `withDateRange` in `src/lib/transactionFilters.ts` (local `today`); `Dates` select fills From and To; reads `Custom dates` when edited | Unit tables in `transactionFilters.test.ts` (month end, year rollover, leap year, custom, keeps other filters); `search/filters` (Last 30 days range, Custom, Any dates) |
| 17 Account line with Change | Done | `transaction-dialog.svelte`: a new Transaction from a named Account shows `Account <name>` and `Change` (named `Change Account`); All Accounts and edit keep the picker; an Account error expands the picker | `transactions/add-another` steps 1, 4, 7 |
| 18 Memo behind Add memo | Done | Empty memo hidden behind `Add memo` (shows and focuses it); a saved memo shows | `transactions/add-another` steps 1, 4, 6; `splits/restart` final step; `transfers/*` |
| 19 Split-line memos on request | Done | `Add memo to line N`; saved line memos show; a restarted split or added line starts hidden | `splits/lines`, `splits/restart` |
| 20 Save and add another | Done | Footer button for new Transactions only. It keeps Account and Date, then clean draft (no amount, memo, Payee, or Category), Payee focused, `Transaction added` status. A save in flight refuses more submits (guard plus disabled buttons). A late result for a closed opening never touches the new draft (`DialogSession`). The clean draft is pristine. | `transactions/add-another` steps 2–6 (forced double click and Enter while held → one row; close then reopen and release → new draft untouched; amounts and memo not kept; balances and dates persisted) |

### Design decisions

- Chips are raw `<button>`s. `shadcn/no-restyle` forbids classes on `Button`, and the chips need a pill shape and truncation. The chip name is `Remove <Filter>: <value>`.
- The Dates preset is not stored in the URL. It is worked out from From and To, so links and existing params keep working and a custom range reads `Custom dates`.
- The Payee filter reuses `CategoryPicker`, the established searchable picker. No new primitive was added.
- Save and add another keeps only Account and Date, as the spec asks. Direction and Category reset with the fresh draft. Category then follows the new Payee's remembered Category.
- Journeys check the exact `Save` button (`exact: true`) because `Save and add another` now shares its prefix (transactions, splits, transfers, payees journeys). The phone toggle is matched by `/^Filters\b/` since its name carries the count (`Filters 2`, as before).

### Changed files

- `src/lib/transactionFilters.ts`, `src/lib/transactionFilters.test.ts`
- `src/lib/components/transactions/transaction-filters.svelte`, `src/lib/components/transactions/transaction-dialog.svelte`
- `e2e/journeys/{transactions,search,splits,transfers,payees}.ts` (new journey `transactions/add-another`)
- `.agents/skills/verify-budge/features/{transactions,search,splits}.md`

### Checks (all run with the app down)

- `bun run test scripts/app/featureMap.test.ts src/lib/transactionFilters.test.ts`: 2 files, 20 tests passed. The new preset tests were red before the implementation.
- `prettier --check` on changed files, `bun run lint`, `bun run lint:ui`: clean.
- `bun run typecheck` (app + convex): 0 errors, 0 warnings.
- Whole `bun run check` / full E2E suite not run; parent runs it at integration.

### Real-app verification (verify-budge, checkout-local)

`.local-app/running.json` absent before start. `up`, `doctor` (all ok), `login`, then `verify` (reseeds each journey's fixture):

- Run 1 `/home/lomzem/.t3/worktrees/budge/t3-31b947c5-5d3de6743af1f7ef/test-results/verify-budge/ux-transactions-1`: add-another, search/filters, splits/restart, transfers/import-link passed. The others failed on journey locators: `Save` became ambiguous, and the phone toggle is named `Filters 2`.
- Run 2 `/home/lomzem/.t3/worktrees/budge/t3-31b947c5-5d3de6743af1f7ef/test-results/verify-budge/ux-transactions-2`: 18 of 19 passed. Those were transactions/{create,late-save,add-another,categorize,categorize-late,approve-phone,approve-all-undo,select-categorize,payee-groups}, search/filters, splits/{lines,restart}, transfers/{pair,import-link}, payees/{last-category,remember}, accounts/start-edit, and budget/needs-you. search/phone failed because `toHaveText` read the chips' text content, so the journey now checks their accessible names, which were already correct in the ARIA snapshot.
- Run 3 `/home/lomzem/.t3/worktrees/budge/t3-31b947c5-5d3de6743af1f7ef/test-results/verify-budge/ux-transactions-3`: search/phone passed.
- Screenshots checked: 320 px chips (`ux-transactions-3/search/phone/03-*.png`), 1280 px clean draft in Savings (`ux-transactions-2/transactions/add-another/04-*.png`).

Ownership cleanup: `bun run app down` → `app: down.`, `running.json` gone, ports 5173 and 3210 free, and evidence directories kept.

### Principles that changed a choice

- subtract-before-you-add: reused `CategoryPicker` for Payee search, and worked out the preset from From/To instead of adding a URL param.
- boundary-discipline / type-system-discipline: preset math stays in the pure domain module with a `DateRange` union. The preset setter looks the value up instead of casting.
- separate-before-serializing-shared-state: Save and add another clears the draft by starting a new dialog opening (`fill`), so a late result is dropped by `DialogSession` and needs no extra flags.
- prove-it-works / test-behavior-not-implementation: the held-response journey forces a double submit and a late completion through the UI, and checks the persisted rows and balances rather than internal state.
- experience-first: focus moves to Payee after add-another, to the revealed memo, to the next chip, and to Change's picker.

### Remaining integration risks

- Other E2E code outside these journeys that matches the Add/Edit Transaction `Save` button without `exact` would now be ambiguous. `grep "name: 'Save' }"` in `e2e/` finds only dialogs without that button: categories, settings, targets, and the Edit Transaction dialog in `accounts.ts` (`accounts/start-edit` passed).
- Spec items 21–26 (Budget/Category) may touch the shared filter or dialog footer layout. Re-run `search/phone` and `transactions/add-another` after merging them.
- No full `bun run check` or full E2E suite in this worktree.
