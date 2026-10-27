# 06: Category management

**What to build:** I can create, rename, reorder, hide, and delete Categories and Category Groups. Deleting a Category moves its Transactions and Assigned amounts to a Category I choose, so every month's Available stays exact. Deleting a group first moves its Categories to a group I choose. Budge manages the system Categories (Ready to Assign, Credit Card Payment Categories), so I can't break them.

**Blocked by:** 05 (Budget screen)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 111–114; Convex data model (Category management)

- [ ] Create, rename, reorder (integer `position` rewritten per sibling list), and hide or unhide Categories and Category Groups. Hidden Categories leave the budget table but still count in every total.
- [ ] Deleting a Category requires a destination Category. Its Transactions (and later its split lines) and Assigned rows move there, with Assigned summing into existing rows. The affected `monthlyTotals` are rebuilt, then the Category is hard-deleted.
- [ ] Deleting a Category Group requires a destination group for its Categories.
- [ ] System Categories and system groups can't be renamed, deleted, or moved by the owner. Attempts return `INVALID_INPUT`.
- [ ] `convex-test`: after deleting a Category with history across several months, every month's Available for the destination and Ready to Assign equals what it would have been had the Transactions and Assigned amounts been there all along. The `monthlyTotals` rebuild still equals the incrementally kept rows.
- [ ] The management UI is keyboard reachable, has visible labels, and works down to 320 px.
