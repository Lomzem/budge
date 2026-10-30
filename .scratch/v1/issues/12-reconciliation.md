# 12: Reconciliation

**What to build:** I can Reconcile an Account by entering the bank's real balance. Budge compares it to the cleared balance. If they agree, it locks those Transactions as Reconciled. If they don't, it records one "Reconciliation Adjustment" Transaction for the difference, categorized to Ready to Assign by default and editable. Each Account shows when it was last reconciled.

**Blocked by:** 10 (Credit Card Accounts)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 107–110; Domain module (reconciliation adjustment)

- [x] `cleared` becomes three states (`uncleared` / `cleared` / `reconciled`), and Accounts gain `lastReconciledOn?`.
- [x] Reconcile takes the bank balance and the date. A matching balance marks every Cleared Transaction in the Account Reconciled. A difference creates the adjustment Transaction (Payee "Reconciliation Adjustment", dated that day, categorized to Ready to Assign) and then locks.
- [x] Reconciled Transactions refuse amount, date, and Account edits, and refuse deletion, with `INVALID_INPUT` until the owner explicitly unlocks one. Category, Payee, and memo stay editable.
- [x] On a Cash Account the adjustment changes Ready to Assign. On a Credit Card Account it follows the full-amount move.
- [x] `convex-test`: both outcomes on a Cash Account and on a Credit Card Account, plus the lock.
- [x] The Reconcile flow is keyboard reachable, and the last-reconciled date appears beside the Account.
