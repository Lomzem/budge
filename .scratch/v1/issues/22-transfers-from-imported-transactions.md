# 22: Transfers from imported Transactions

**What to build:** When I categorize an imported Transaction as a Transfer to another Account, Budge creates the other side as an uncleared Transaction, which that Account's import later Matches. If the other side has already been imported, Budge offers to link it instead of creating a duplicate.

**Blocked by:** 09 (Transfers), 14 (File import and the matcher)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 62–63; Bank sync (Transfers)

- [ ] Choosing "Transfer to <Account>" as the Category of an imported Transaction creates the opposite side in that Account, uncleared and linked. A later Bank Row in that Account Matches it through the normal matcher.
- [ ] If an unlinked imported Transaction already exists in the other Account with the opposite amount within 10 days, Budge offers to link it. Linking makes the pair without creating a third Transaction.
- [ ] There is no automatic Transfer detection.
- [ ] `convex-test`: create-then-import gives one linked pair with both sides Cleared. Link-existing gives one pair. The budget is unchanged for Cash-to-Cash, and the card payment rule applies for Cash-to-card.
