# Budge

A personal, single-user zero-based budget. Every dollar on hand gets a job, and spending is tracked against those jobs.

## Money on hand

**Account**:
A real-world place money lives or is owed, such as a checking account or a credit card.
_Avoid_: Wallet, source

**Cash Account**:
An Account whose positive balance is money available to budget, such as checking or savings.
_Avoid_: Budget account, debit account

**Credit Card Account**:
An Account whose balance is money owed to a card issuer.
_Avoid_: Liability account, credit line

**Transaction**:
One movement of money in or out of an Account, with a date, Payee, amount, and Category.
_Avoid_: Entry, charge, record

**Transfer**:
A Transaction pair that moves money between two Accounts without changing the total budgeted.
_Avoid_: Move, internal payment

**Cleared**:
A Transaction the bank has confirmed. Cleared Transactions make up the balance the bank would show.
_Avoid_: Posted, settled

**Reconciliation**:
Checking an Account's cleared balance against the bank's real balance, then locking those Transactions or recording the difference as one adjustment Transaction.
_Avoid_: Balancing, sync check

**Payee**:
The party on the other side of a Transaction.
_Avoid_: Merchant, vendor, counterparty

## Budgeting

**Ready to Assign**:
Money on hand that has not yet been given a job in any Category.
_Avoid_: Unbudgeted, To be budgeted, free cash

**Category**:
A job for money, such as Groceries or Rent, holding a running Available balance.
_Avoid_: Envelope, bucket, line item

**Category Group**:
A named set of Categories, shown together.
_Avoid_: Section, master category

**Assigned**:
The amount given to a Category in one month.
_Avoid_: Budgeted, allocated

**Activity**:
The sum of Transactions in a Category in one month.
_Avoid_: Spent, outflow

**Available**:
A Category's balance: prior Available plus Assigned plus Activity. It rolls over to the next month.
_Avoid_: Remaining, left over

**Overspending**:
A Category whose Available is below zero. The negative carries into later months until it is covered.
_Avoid_: Over budget, deficit

**Cover**:
To assign or move money into an overspent Category until its Available is back to zero.
_Avoid_: Fix, top up

**Uncategorized**:
A Transaction not yet given a Category. It counts against Ready to Assign until it gets one.
_Avoid_: Unassigned, pending

**Credit Card Payment Category**:
A Category per Credit Card Account that holds the money set aside to pay that card.
_Avoid_: Card reserve, payoff bucket

**Target**:
A goal attached to a Category that states how much it needs and by when.
_Avoid_: Goal, budget limit

**Monthly Target**:
A Target for an amount each month, with an optional due day. It either refills the Category up to the amount or sets aside the amount on top of what is left over.
_Avoid_: Recurring goal, spending target

**By date Target**:
A Target for an amount Available by a date, optionally repeating every N months.
_Avoid_: Savings goal, sinking fund

## Sync

**Bank Connection**:
A link to a financial institution that imports Transactions into one or more Accounts.
_Avoid_: Integration, link, feed

**Unapproved**:
An imported Transaction you have not yet reviewed. It already counts in balances and the budget; approving it only marks it reviewed.
_Avoid_: Pending, new, inbox

**Match**:
Linking an imported Transaction to one you entered by hand, so the two become a single Cleared Transaction that keeps what you entered.
_Avoid_: Merge, reconcile, dedupe

**Bank Text**:
The raw description a bank sends for a Transaction, kept read-only alongside its Payee.
_Avoid_: Memo, raw payee, statement name
