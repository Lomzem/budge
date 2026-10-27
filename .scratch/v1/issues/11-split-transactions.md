# 11: Split Transactions

**What to build:** I can split one Transaction across several Categories, each line with its own amount and memo. Each line follows the budget rules on its own, including the full-amount move on a Credit Card Account.

**Blocked by:** 10 (Credit Card Accounts)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 53–54; Convex data model (splits)

- [ ] A `transactionSplits` table (`transactionId`, `categoryId`, `amount`, `memo?`, and the parent's `date` denormalized) with Category-by-date and by-Transaction indexes. The parent has `split: true` and no Category.
- [ ] Creating, editing, and un-splitting are validated: the lines must sum to the parent amount, or the mutation fails with `INVALID_INPUT`. Changing the parent's date updates the lines' date.
- [ ] Split lines add to their own Category buckets in `monthlyTotals`, and the rebuild handles them.
- [ ] Category deletion (ticket 06) also moves split lines. Its test is extended.
- [ ] The budget entry point applies each line on its own, including the card move. A split card purchase moves each line's amount.
- [ ] Transaction entry and detail let me add, edit, and remove lines, with a running remainder. The list shows "Split" in place of a Category.
- [ ] `convex-test`: a split card purchase gives the same budget result as separate Transactions of each line. The rebuild still equals the incrementally kept rows.
- [ ] The seed gains one split.
