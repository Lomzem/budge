# Search and filters

Find Transactions by Payee, memo, split memo or Bank Text, then narrow by Account, Category (including Uncategorized), status (Unapproved), Payee and date.

## Sub-features

- `search-text`, `search-empty`, `search-clear`: matches, no matches, reset.
- `search-filters`, `search-mobile`: combined filters and both list entry points at narrow widths.

## How to get to it (user POV)

- The Transactions page or a named Account's register, through the sidebar or the phone tab bar. Below the filter container's `3xl` width, the Category/Status/Payee/date filters fold behind a `Filters` toggle (`aria-expanded`), which counts the active filters (From and To together count as one Dates filter). While the panel is folded, a list `Active filters` shows one chip per active filter (`Remove Payee: Sample Landlord`, `Remove Dates: This year`); removing a chip clears that filter and focuses the next chip, or the Filters toggle after the last. Category and Payee are searchable pickers (`Search Categories`, `Search Payees`); the Payee filter matches the chosen Payee's identity, apart from the free-text Search. `Dates` offers `Any dates`, `This month`, `Last month`, `Last 30 days` and `This year`, worked out on local dates, which fill From and To; editing From or To reads `Custom dates`; `Clear search and filters` is always present and disabled when nothing is set.
- A link from the Budget's `Needs you` chips: `/transactions?category=uncategorized` arrives with Category = `Uncategorized`, and `/transactions?status=unapproved` with Status = `Unapproved`. The Filters panel stays folded on arrival (so the first rows stay in view on a phone); the Filters toggle shows the count of active filters, and the count line above the table names the narrowing (`9 Uncategorized Transactions`, `3 Unapproved Transactions`).

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/search.ts`, also run by `bun run test:e2e:local`):

- `search/filters`: Bank Text, split memo, the Payee and Category filters and Clear (`search-text`, `search-filters`, `search-clear`). Typing `land` in the Payee picker leaves only Sample Landlord, Enter picks it, and the URL holds `payee` but no `q` (the Search box stays empty); `gif` in the Category picker finds Gifts and the Warehouse split; `Last 30 days` fills From and To with today − 29 and today and lists only those dates, editing From reads `Custom dates`, and `Any dates` brings the original list back. A Payee chosen after a reload is the one Back restores from another Section (the filters replace the history entry through `keepInUrl`).
- `search/phone`: labeled controls, `Dates` among them, that fit 320 px (`search-mobile`). With Payee Sample Landlord and Dates This year, the folded panel shows the two chips, the toggle counts 2, and nothing passes the right edge; removing the first chip focuses the next and drops `payee` from the URL, and Enter on the last focuses the toggle, drops the dates, and disables Clear.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Bank Text:** on `/transactions`, `await page.getByRole("searchbox", { name: "Search", exact: true }).fill("0042")`; poll row edit buttons (`getByRole("table").getByRole("button", { name: /edit Transaction on/ })`) until only Sample Coffee Shop remains. Open it and require read-only Bank Text containing 0042.
- **Split/memo/Payee:** fill Search with `birthday`, require Sample Warehouse Club. Open it to check the split memo. Search the displayed Payee name separately. For an ordinary memo, first save an invented Memo through Edit Transaction, then search it and require that Transaction; the baseline fixture supplies split memos only.
- **Filters:** clear Search, select label `Payee` (exact) = Sample Landlord; require only that Payee. Reset with `Clear search and filters`; select Category = Gifts, require Sample Warehouse Club’s split. On the Transactions page select Account = Checking; fill From and To with an observed row’s date, require only rows in range. Combine filters and Search, inspect all pages via Show more if available. Category = `Uncategorized` shows only rows with no Category that are neither split nor a Transfer; label `Status` = `Unapproved` shows only Unapproved rows (bold). Open `/transactions?category=uncategorized` and `/transactions?status=unapproved` directly at a width below the container's `3xl`; require the Filters panel folded, the toggle counting 1 active filter, and, once opened, that filter selected.
- **Empty/reset:** Search `SampleNoSuchPayee9001`; require the loaded empty list. Click `Clear search and filters`; require blank controls and original rows. Repeat on a named Account (no Account filter) and at 320 px; all labels and results must remain usable without overflow.

## Gotchas

- **Manual drive:** punctuation-only Search returns no rows; only the first 16 alphanumeric terms count. Category offers `Ready to Assign` when it exists; select it and verify the matching Transactions.
- **Manual drive:** the list alert `Budge couldn't load Transactions. Try reloading the page.` is not a successfully loaded empty result. If the Categories or Payees fail to load, the app shell shows the failure instead of any Section (see [shell](shell.md)).

- Search/filter changes can return short pages; use Show more before asserting global absence.
- Bank Text matching after Unmatch is covered with imports; global Payee renaming has no UI (see Payees).
- Sources: ticket 16; public `transactions.list`, `payees.list`, `categories.list`.
