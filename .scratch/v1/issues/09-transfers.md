# 09: Transfers

**What to build:** I can record a Transfer between two Accounts as one action. Both sides appear in their Accounts and stay linked: editing or deleting one side changes the other. A Transfer between two Cash Accounts has no Category and doesn't touch the budget.

**Blocked by:** 05 (Budget screen)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 59–61; Convex data model (Transfers)

- [x] Transactions gain `transferTransactionId`. A Transfer is two Transactions pointing at each other, with opposite amounts and no Category. There is no Transfer table.
- [x] Creating, editing (amount, date, either Account), and deleting one side updates the other in the same mutation.
- [x] A Transfer side counts in the `"transfer"` bucket of `monthlyTotals`, never as Uncategorized.
- [x] The budget entry point leaves Ready to Assign and every Category unchanged for a Transfer between Cash Accounts. The cash invariant still holds.
- [x] The Transaction list shows the other Account in place of a Category for a Transfer.
- [x] `convex-test`: editing either side keeps the pair consistent, deleting one side deletes both, and the rebuild still equals the incrementally kept rows.
- [x] The seed gains one Transfer.
