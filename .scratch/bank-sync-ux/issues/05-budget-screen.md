# 05: Budget screen around the ledger total

**Status:** done

**Spec:** [Bank sync and UI/UX](../spec.md)

**Blocked by:** 02, 03

## What to build

See the spec scope item.

## Comments

- Landed: the Budget header shows the month nav (fixed-width label) and the Ready to Assign ledger total with a double rule. A reserved line under it notes Uncategorized money.
- A fixed-height `Needs you` strip collects over-assignment, overspending, Transactions needing a Category, Unapproved, and Bank items. Each links to where it gets fixed, or says nothing needs you.
- Changing month keeps the last month on screen, inert and dimmed, until the new month arrives, instead of swapping in a Loading line.
- The cutover card shows only while the cutover date is unset. An Assigned save error floats over the table instead of growing its row.
- On phone, Category names and their status wrap instead of truncating.
