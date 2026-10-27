# 03: Manual Accounts and Transactions

**What to build:** I set my cutover date, create Cash Accounts and Credit Card Accounts with their starting balances, and enter, edit, and delete Transactions by hand, with Payee, amount, date, memo, and Cleared. The sidebar shows each Account's balance, grouped as Cash and Credit. Each Account, and All Accounts, has a paginated Transaction list. A fresh local backend can be filled with a synthetic budget.

**Blocked by:** 02 (Signed-in owner shell)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 9–11, 16–17, 49–52, 64–65, 70, 128, 137–138; Convex data model; ADR 0002

- [ ] Tables `settings`, `accounts`, `payees`, `transactions`, and `monthlyTotals` with the fields and indexes from the data model (no `users` table, no owner column). Amounts are whole cents as safe integers, and dates are `YYYY-MM-DD`.
- [ ] Set the cutover date. Create, rename, and reorder Accounts. A starting balance is an ordinary Transaction dated on the cutover date.
- [ ] Create, edit, and delete a Transaction. Hand-entered Transactions start uncleared and can be toggled Cleared. A Payee is created by name on first use.
- [ ] Every Transaction write updates `monthlyTotals` in the same mutation. An internal rebuild recreates `monthlyTotals` from Transactions. A `convex-test` test proves that after any sequence of creates, edits (including date and Account changes), and deletes, the rebuilt rows equal the incrementally kept rows.
- [ ] Account balances come from `monthlyTotals`, never by reading the full Transaction history.
- [ ] The Transaction list is paginated through the Account-by-date and by-date indexes, with Date, Account (All Accounts only), Payee, Memo, Amount, and Cleared columns. Columns drop as the width shrinks, down to 320 px.
- [ ] Internal `seed:run` writes a small synthetic budget (3 Accounts, about 3 months of made-up Transactions) and ends by calling the rebuild. It refuses to run if any Account exists or if the production env flag is set. The seed contains no real data.
- [ ] A Playwright smoke test adds a Transaction on the seeded local backend and sees the Account balance change.
