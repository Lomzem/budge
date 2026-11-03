# Search and filters

Find Transactions by Payee, memo, split memo or Bank Text, then narrow by Account, Category, Payee and date.

## Sub-features

- `search-text`, `search-empty`, `search-clear`: matches, no matches, reset.
- `search-filters`, `search-mobile`: combined filters and both list entry points at narrow widths.

## How to get to it (user POV)

- All Accounts via sidebar or phone View menu, or a specific Account’s list through either navigation.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Bank Text:** on `/accounts`, `await page.getByRole("searchbox", { name: "Search", exact: true }).fill("0042")`; poll row edit buttons (`getByRole("table").getByRole("button", { name: /edit Transaction on/ })`) until only Sample Coffee Shop remains. Open it and require read-only Bank Text containing 0042.
- **Split/memo/Payee:** fill Search with `birthday`, require Sample Warehouse Club. Open it to check the split memo. Search the displayed Payee name and an ordinary memo observed in the fixture separately; require their rows.
- **Filters:** clear Search, select label `Payee` (exact) = Sample Landlord; require only that Payee. Reset with `Clear search and filters`; select Category = Gifts, require Sample Warehouse Club’s split. On All Accounts select Account = Checking; fill From and To with an observed row’s date, require only rows in range. Combine filters and Search, inspect all pages via Show more if available.
- **Empty/reset:** Search `SampleNoSuchPayee9001`; require the loaded empty list. Click `Clear search and filters`; require blank controls and original rows. Repeat on a named Account (no Account filter) and at 320 px; all labels and results must remain usable without overflow.

## Gotchas

- Search/filter changes can return short pages; use Show more before asserting global absence.
- Bank Text matching after Unmatch is covered with imports; global Payee renaming has no UI (see Payees).
- Sources: ticket 16; `e2e/search.test.ts`; public `transactions.list`, `payees.list`, `categories.list`.
