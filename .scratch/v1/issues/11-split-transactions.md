# 11: Split Transactions

**What to build:** I can split one Transaction across several Categories, each line with its own amount and memo. Each line follows the budget rules on its own, including the full-amount move on a Credit Card Account.

**Blocked by:** 10 (Credit Card Accounts)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 53–54; Convex data model (splits)

- [x] A `transactionSplits` table (`transactionId`, `categoryId`, `amount`, `memo?`, and the parent's `date` denormalized) with Category-by-date and by-Transaction indexes. The parent has `split: true` and no Category.
- [x] Creating, editing, and un-splitting are validated: the lines must sum to the parent amount, or the mutation fails with `INVALID_INPUT`. Changing the parent's date updates the lines' date.
- [x] Split lines add to their own Category buckets in `monthlyTotals`, and the rebuild handles them.
- [x] Category deletion (ticket 06) also moves split lines. Its test is extended.
- [x] The budget entry point applies each line on its own, including the card move. A split card purchase moves each line's amount.
- [x] Transaction entry and detail let me add, edit, and remove lines, with a running remainder. The list shows "Split" in place of a Category.
- [x] `convex-test`: a split card purchase gives the same budget result as separate Transactions of each line. The rebuild still equals the incrementally kept rows.
- [x] The seed gains one split.

## Comments

- Decided while building: a split takes 2 to 50 lines; one line is refused as `INVALID_INPUT` (a Category does the same job). A line may take any Category its Transaction could, Ready to Assign included, so a paycheck can be split; a Ready to Assign line dated after today waits for its date like any inflow. A split is never Uncategorized and can't be a Transfer.
- Each save rewrites the lines with the parent's date, which is how a date change reaches them. Each line counts as one Transaction in its Category's `monthlyTotals` row.
- In the entry dialog, line amounts follow the Direction, and a minus sign turns a line the other way. The dialog now scrolls when the lines make it taller than the screen.
