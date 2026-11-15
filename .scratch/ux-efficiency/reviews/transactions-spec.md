# Transactions Spec review

Revision: `c7d354b665c0925988af44229a925cf029c6ec20`. Scope: `git diff 96d902f...c7d354b`, spec items 13–20 only. Read-only review; no app/browser session or source edits.

No actionable findings: no missing/partial requirement, unasked scope expansion, or implemented-but-wrong behavior established.

Decisive source evidence:

- **13–15:** “Removable active filter chips remain visible outside the collapsed Filters panel”; searchable Category and exact-Payee filters (`.scratch/ux-efficiency/spec.md:28`). Chips sit outside the panel, remove individual filters, and restore focus (`transaction-filters.svelte:88`, `:117`, `:198`). Both pickers search; Payee choice values remain `_id`, distinct from `values.search` (`:54`, `:158`, `:239`). The table passes `payeeId` independently of search (`transaction-table.svelte:169`); backend equality/index selection preserves identity (`convex/transactions.ts:373`). Component paths are under `src/lib/components/transactions/`.
- **16:** “presets alongside custom From/To dates, using local dates” (`spec.md:31`). The UI uses `localToday()` and retains both custom inputs (`transaction-filters.svelte:264`); date arithmetic handles inclusive thirty-day ranges and month/year boundaries (`src/lib/transactionFilters.ts:120`).
- **17–19:** Compact Account context is restricted to new drafts with a named Account; Change reveals the picker. Memo visibility initializes from actual saved text, including split lines (`transaction-dialog.svelte:149`, `:164`, `:423`, `:588`, `:746`). Existing Account selection/editing remains available as required (`spec.md:32`).
- **20:** “retains Account/date and starts a clean draft without duplicating saves” (`spec.md:35`). Save guards pending work, captures Account/date, then opens a fresh draft/session (`transaction-dialog.svelte:280`); stale opening results never settle into callbacks (`src/lib/dialogSession.svelte.ts:42`). The journey asserts single persisted rows, preserved dates/balances, cleared amount/memo, and an untouched reopened draft (`e2e/journeys/transactions.ts:156`, `:187`, `:229`).

Checks: `bun run test src/lib/transactionFilters.test.ts` passed, **17 tests**. Inspected changed search/split/entry journeys; did not independently rerun browser proof. Full integration/UI review remains the parent's gate.

Principles affecting choices: **Prove It Works** required tracing actual identity and stale-response paths rather than trusting the ticket's claims; **Test Behavior, Not Implementation** prioritized persisted-row/balance assertions; **Experience First** included keyboard focus and preserved draft context; **Guard the Context Window** kept investigation scoped to this slice.
