# What is in v1 and what waits?

Type: grilling
Status: resolved
Blocked by: 

## Question

Which YNAB-style features are in v1 and which wait for later: split Transactions, Transfers, scheduled (recurring) Transactions, Targets and which kinds, reconciliation, reports, Payee rules, search and filters, editing past months, hiding Categories, and anything else? Draw the v1 line.

## Answer

**In v1**

- Split Transactions across several Categories.
- Transfers between Accounts.
- The full Credit Card Payment Category model for Credit Card Accounts.
- Targets of two kinds:
  - **Monthly**: "$X each month", with an optional due day (e.g. Rent $1,800 due on the 1st). This is how rent and subscriptions get budgeted.
  - **By date**: "$X Available by a date", with an optional repeat every N months that rolls the date forward once met (e.g. Amazon Prime $139 by March 3, every 12 months).
- An Upcoming list: every Target with a due day in the next 30 days, with amount, due date, and whether its Category is fully funded. Derived from Targets, not from placeholder Transactions.
- Reconciliation, kept simple: each Transaction is Cleared or uncleared; Reconcile takes the bank's real balance, compares it to the cleared balance, and either locks those Transactions or records one adjustment Transaction for the difference.
- Payee memory: suggest the last Category used for a Payee.
- Transaction list search and filters: Account, Category, Payee, date range, text search on Payee and memo.
- Editing any month, past or future: Assigned and Transactions are editable anywhere, Available recalculates forward.
- Category management: create, rename, reorder, hide, delete Categories and Category Groups; deleting moves Transactions and Available to a chosen Category.
- Move money between Categories as one action.
- Manually tracked Accounts are on-budget Cash Accounts and Credit Card Accounts with hand-entered Transactions.
- Full data export (CSV/JSON) as a backup and exit path from Convex.
- Memos on Transactions.

**Waits for later**

- Scheduled (placeholder) Transactions. Targets with due days cover budgeting for bills; placeholders would need matching against synced Transactions for no gain in correctness.
- Reports. A two-way door: reports are read-only views over Transactions that already carry date, Payee, amount, and Category, so nothing in v1 needs to change to add them.
- Full Payee rules (rename and categorize by pattern).
- Off-budget tracking Accounts (401(k), loans).
- Age of Money, flags and colors, Category notes, loan and mortgage Accounts, multiple budgets, undo history, bulk editing.

**Effects on other tickets**

- 06 must also cover due days, repeating By date Targets, the "still needed" math, and the reconciliation adjustment.
- 09 must also place the Upcoming list.
- 07 inherits Payee memory as the baseline for Category suggestions; it has no scheduled Transactions to match.
