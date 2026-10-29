# 06: Category management

**What to build:** I can create, rename, reorder, hide, and delete Categories and Category Groups. Deleting a Category moves its Transactions and Assigned amounts to a Category I choose, so every month's Available stays exact. Deleting a group first moves its Categories to a group I choose. Budge manages the system Categories (Ready to Assign, Credit Card Payment Categories), so I can't break them.

**Blocked by:** 05 (Budget screen)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 111–114; Convex data model (Category management)

- [x] Create, rename, reorder (integer `position` rewritten per sibling list), and hide or unhide Categories and Category Groups. Hidden Categories leave the budget table but still count in every total.
- [x] Deleting a Category requires a destination Category. Its Transactions (and later its split lines) and Assigned rows move there, with Assigned summing into existing rows. The affected `monthlyTotals` are rebuilt, then the Category is hard-deleted.
- [x] Deleting a Category Group requires a destination group for its Categories.
- [x] System Categories and system groups can't be renamed, deleted, or moved by the owner. Attempts return `INVALID_INPUT`.
- [x] `convex-test`: after deleting a Category with history across several months, every month's Available for the destination and Ready to Assign equals what it would have been had the Transactions and Assigned amounts been there all along. The `monthlyTotals` rebuild still equals the incrementally kept rows.
- [x] The management UI is keyboard reachable, has visible labels, and works down to 320 px.

## Comments

- Implemented on branch `06-category-management`.
- Decisions:
  - Hidden is an optional `hidden` flag on `categories` and `categoryGroups`. A hidden Category, or every Category in a hidden group, leaves the budget table for a "Hidden Categories" list under it. It still counts in Ready to Assign, the overspent list, and its group's Assigned, Activity, and Available, per "still count in every total". The Transaction picker still offers hidden Categories, since the ticket only takes them out of the budget table.
  - Deleting a Category moves its Transactions (via `by_category_date`) and Assigned rows (via a new `by_category_month` index, short-style name like the rest). Assigned sums into the destination's row for the month; a sum of zero deletes the row. Then `rebuildTotals` rebuilds, from the Transactions, both Categories' `monthlyTotals` for each (month, Account) the moved Transactions touched, rather than trusting the cached rows (ADR 0002).
  - Ready to Assign can't be a delete destination: every system Category or group is refused with `INVALID_INPUT` for rename, move, hide, delete, and as a destination. Credit Card Payment Categories reuse the same `kind !== 'normal'` guard when ticket 10 adds them; split lines move when ticket 11 adds them.
  - A Category Group with no Categories deletes without a destination. A group's Categories append, in order, to the end of the destination group.
  - Delete runs as one mutation, so it stays atomic. A personal budget's Category history stays well under Convex's per-mutation limits; batching across scheduled continuations would expose a half-moved state.
  - The management screen is `/categories`, linked from the nav and the budget screen. Each group and Category has an actions menu (Rename, Move up, Move down, Move to group, Hide or Show, Delete…), reachable by Tab and Enter. Its trigger is a plain button, so long names truncate at 320 px.
- Verification: `bun run typecheck`, `lint`, `lint:ui`, `format:check`, and `bun run test` pass. Playwright (4 tests, including the new `e2e/categories.test.ts` at 320 px) passed against a throwaway anonymous local backend seeded with `seed:run`.
- Review (GPT-6.1-Sol, standards and spec): fixed group totals that left out hidden Categories, the delete reusing cached totals instead of rebuilding them, the Transaction picker hiding Categories (unasked scope), and the three dialogs acting on a save that finished after another item took the dialog over. Kept: the short index name, and unbatched delete and reorder (see above).
- Shipped in https://github.com/Lomzem/budge/pull/5, squash-merged to `main` as 48841c1. CodeRabbit approved head 2afb809 with no comments (after one rate-limit wait), and all six checks passed.
