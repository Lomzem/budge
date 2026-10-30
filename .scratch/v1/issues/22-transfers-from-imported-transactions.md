# 22: Transfers from imported Transactions

**What to build:** When I categorize an imported Transaction as a Transfer to another Account, Budge creates the other side as an uncleared Transaction, which that Account's import later Matches. If the other side has already been imported, Budge offers to link it instead of creating a duplicate.

**Blocked by:** 09 (Transfers), 14 (File import and the matcher)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 62–63; Bank sync (Transfers)

- [x] Choosing "Transfer to <Account>" as the Category of an imported Transaction creates the opposite side in that Account, uncleared and linked. A later Bank Row in that Account Matches it through the normal matcher.
- [x] If an unlinked imported Transaction already exists in the other Account with the opposite amount within 10 days, Budge offers to link it. Linking makes the pair without creating a third Transaction.
- [x] There is no automatic Transfer detection.
- [x] `convex-test`: create-then-import gives one linked pair with both sides Cleared. Link-existing gives one pair. The budget is unchanged for Cash-to-Cash, and the card payment rule applies for Cash-to-card.

## Comments

- Linking is an optional `transferTransactionId` on `transactions.create`/`update`, beside `transferAccountId`. The new `transactions.transferCandidates` query lists the offers: Transactions in the other Account that have a Bank Row, aren't a Transfer side yet, have the opposite amount, and are dated within the 10-day match window, nearest first.
- A linked import takes the categorized side's date and memo, loses its Payee, and is approved, so both paths end in the same shape: one pair with the same date, both Cleared. Linking in place of an already created side deletes that side.
- The dialog offers the link only when editing an imported Transaction, and preselects the nearest import so that saving doesn't make a duplicate. "Create a new uncleared side" is still offered.
