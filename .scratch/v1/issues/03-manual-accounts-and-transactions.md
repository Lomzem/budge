# 03: Manual Accounts and Transactions

**What to build:** I set my cutover date, create Cash Accounts and Credit Card Accounts with their starting balances, and enter, edit, and delete Transactions by hand, with Payee, amount, date, memo, and Cleared. The sidebar shows each Account's balance, grouped as Cash and Credit. Each Account, and All Accounts, has a paginated Transaction list. A fresh local backend can be filled with a synthetic budget.

**Blocked by:** 02 (Signed-in owner shell)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 9–11, 16–17, 49–52, 64–65, 70, 128, 137–138; Convex data model; ADR 0002

- [x] Tables `settings`, `accounts`, `payees`, `transactions`, and `monthlyTotals` with the fields and indexes from the data model (no `users` table, no owner column). Amounts are whole cents as safe integers, and dates are `YYYY-MM-DD`.
- [x] Set the cutover date. Create, rename, and reorder Accounts. A starting balance is an ordinary Transaction dated on the cutover date.
- [x] Create, edit, and delete a Transaction. Hand-entered Transactions start uncleared and can be toggled Cleared. A Payee is created by name on first use.
- [x] Every Transaction write updates `monthlyTotals` in the same mutation. An internal rebuild recreates `monthlyTotals` from Transactions. A `convex-test` test proves that after any sequence of creates, edits (including date and Account changes), and deletes, the rebuilt rows equal the incrementally kept rows.
- [x] Account balances come from `monthlyTotals`, never by reading the full Transaction history.
- [x] The Transaction list is paginated through the Account-by-date and by-date indexes, with Date, Account (All Accounts only), Payee, Memo, Amount, and Cleared columns. Columns drop as the width shrinks, down to 320 px.
- [x] Internal `seed:run` writes a small synthetic budget (3 Accounts, about 3 months of made-up Transactions) and ends by calling the rebuild. It refuses to run if any Account exists or if the production env flag is set. The seed contains no real data.
- [x] A Playwright smoke test adds a Transaction on the seeded local backend and sees the Account balance change.

## Comments

- Implemented on branch `03-manual-accounts-and-transactions`, not yet opened as a PR. The status stays `ready-for-agent` until the PR merges; then it becomes `done`.
- Decisions:
  - Fields arrive with the tickets that use them. Category, split, approved, search text, transfer link, and last reconciled date are not in the schema yet.
  - A Transaction can't be dated before the cutover date, and the cutover date can't move later than the earliest Transaction.
  - A starting balance is a Cleared Transaction with the Payee "Starting Balance". A card's amount owed is stored as a negative balance.
  - `accounts.reorder` takes the full ordered list. The UI moves an Account up or down within its group (Cash or Credit).
  - `seed:run` writes rows directly and then calls the rebuild. `BUDGE_PRODUCTION` is the production flag (`convex.config.ts`, `.env.example`).
  - `monthlyTotals.bucket` is always `uncategorized` until ticket 05.
  - Table columns hide through container-query variants on `TableHead` and `TableCell` (`src/lib/components/ui/table/table-variants.ts`). The shadcn lint forbids restyling cells directly.
- Verification: format, lint, UI lint, both typechecks, and `bun run test` (74 tests) pass. Playwright (both smoke tests, including a 320 px no-overflow check) passed locally against the seeded local backend, with the e2e user made owner only for the run and the owner restored afterwards. CI now runs `seed:run` before Playwright.
- Code review (GPT-6.1-Sol, standards and spec):
  - Fixed: `seed:run` now also refuses once a cutover date is set (it used to add a second settings row). Amounts are capped at $10 billion, so monthly totals stay exact. Live Account updates no longer reset an open Transaction form. The mobile View menu gained Add Account. The Cash/Credit grouping moved into `Accounts.groups`.
  - Deferred: `accountBalances` reads every `monthlyTotals` row, and `monthlyTotals:rebuild` runs as one mutation. Both are sized by Accounts × months (ADR 0002) and fit v1. If history outgrows one transaction, batch the rebuild with scheduled continuations.
- Remaining: PR, CodeRabbit, and CI under the merge rule.
