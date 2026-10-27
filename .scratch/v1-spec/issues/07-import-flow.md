# How do synced Transactions arrive?

Type: grilling
Status: resolved
Blocked by: 01, 02, 05

## Question

How do imported Transactions (from a Bank Connection or a file import) enter the budget: do they need approval, how are they matched against manually entered Transactions, how are pending and posted versions handled, how are Payee names cleaned and Categories suggested, and how are duplicates prevented across sync and file import?

Context from [What is in v1 and what waits?](05-v1-scope.md): v1 suggests the last Category used for a Payee; full Payee rules wait. There are no scheduled Transactions to match against.

## Answer

**Imported Transactions enter the budget the YNAB way: they count at once, arrive Unapproved, and one matcher links them to what is already there.**

**Arrival**

- Imported Transactions (sync or file) count in balances and the budget immediately but arrive **Unapproved**. Editing, categorizing, or "Approve all" approves them. The Transaction list shows Unapproved first; the budget screen shows how many are waiting, beside the Uncategorized count. This copies YNAB.
- Pending Transactions are ignored from every source; only cleared Transactions are imported. Capital One sends none anyway; Discover purchases appear a day or two later than in YNAB. This avoids Plaid's pending→posted ID swap and vanishing holds.
- Imported Transactions arrive Cleared. Hand-entered Transactions stay uncleared until matched or marked Cleared.
- Transactions dated before the cutover date are dropped. Each Account's starting balance is a Transaction dated on the cutover date; for a synced Account Budge suggests it (Plaid's current balance minus Transactions imported since cutover) and the owner confirms or corrects it. Manual Accounts enter it by hand.

**One matcher for every source**

1. **Import ID**: a Transaction remembers its source ID (Plaid `transaction_id` or QFX `FITID`), scoped to its Account. A row with a known ID is skipped.
2. **Match**: otherwise, a candidate is a Transaction in the same Account, same amount, dated within 10 days, uncleared or (for file rows) already imported by sync, and not yet linked to an import from the same source. Exactly one candidate matches automatically; two or more and the owner picks. A Match keeps the owner's Payee, Category, memo, and date, marks the Transaction Cleared, and leaves it Unapproved with an Unmatch action. The bank never overwrites what the owner entered.
3. **Identical rows** stay separate: two $5 coffees on one day are two Transactions; each existing Transaction absorbs at most one row.
4. **Preview**: a file import shows new, matched, and duplicate rows before saving. Sync applies without a preview; approval is its review.

**Payees and Categories**

- The Payee is Plaid's `merchant_name` when present, otherwise the raw description. Every imported Transaction keeps the raw description as read-only **Bank Text**, covered by search and shown in Transaction detail.
- Rename memory: renaming a Payee on an imported Transaction remembers the rename for that exact Bank Text, and later imports with the same Bank Text arrive with that Payee. Exact match only; pattern rules still wait.
- The Category is pre-filled from Payee memory (the Payee's last Category); with no memory the Transaction arrives Uncategorized. Plaid's `personal_finance_category` is ignored.

**Bank changes and removals**

- When Plaid sends `modified` or `removed` for a Transaction that is still Unapproved and unedited, apply it quietly. Otherwise keep the owner's version and flag the Transaction ("bank changed this" / "bank removed this") for the owner to resolve.

**Transfers**

- No automatic Transfer detection. Categorizing one side as a Transfer to another Account creates the other side as an uncleared Transaction, which the matcher pairs with that Account's import. If both sides are already imported, Budge offers to link the existing one instead of creating a duplicate.

**Effects on other tickets**

- [What does the data model look like in Convex?](11-data-model.md): Transactions need an approved flag, an import source and ID per Account, Bank Text, a matched/unmatched link, and a bank-changed/removed flag; store Payee rename memory (exact Bank Text → Payee) and Payee memory (Payee → last Category); store the Plaid sync cursor per Bank Connection.
- [What does the budget screen look like on desktop and phone?](09-budget-screen.md): show the Unapproved count beside the Uncategorized count; the Transaction list needs Unapproved-first ordering, Approve / Approve all, Unmatch, match picking when several candidates exist, bank-changed/removed flags, Bank Text in detail, and the file-import preview.
