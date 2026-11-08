# Search and filters

Find Transactions by Payee, memo, split memo or Bank Text, then narrow by Account, Category (including Uncategorized), status (Unapproved), Payee and date.

## Sub-features

- `search-text`, `search-empty`, `search-clear`: matches, no matches, reset.
- `search-filters`, `search-mobile`: combined filters and both list entry points at narrow widths.

## How to get to it (user POV)

- The Accounts page or a named Account's register, through the sidebar or the phone tab bar. Below the filter container's `3xl` width, the Category/Status/Payee/date filters fold behind a `Filters` toggle (`aria-expanded`), which counts the active ones; `Clear search and filters` is always present and disabled when nothing is set.
- A link from the Budget's `Needs you` chips: `/accounts?category=uncategorized` arrives with Category = `Uncategorized`, and `/accounts?status=unapproved` with Status = `Unapproved`. The Filters panel stays folded on arrival (so the first rows stay in view on a phone); the Filters toggle shows the count of active filters, and the count line above the table names the narrowing (`9 Uncategorized Transactions`, `3 Unapproved Transactions`).

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/search.ts`, also run by `bun run test:e2e:local`):

- `search/filters`: Bank Text, split memo, the Payee and Category filters and Clear (`search-text`, `search-filters`, `search-clear`).
- `search/phone`: labeled controls that fit 320 px (`search-mobile`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Bank Text:** on `/accounts`, `await page.getByRole("searchbox", { name: "Search", exact: true }).fill("0042")`; poll row edit buttons (`getByRole("table").getByRole("button", { name: /edit Transaction on/ })`) until only Sample Coffee Shop remains. Open it and require read-only Bank Text containing 0042.
- **Split/memo/Payee:** fill Search with `birthday`, require Sample Warehouse Club. Open it to check the split memo. Search the displayed Payee name separately. For an ordinary memo, first save an invented Memo through Edit Transaction, then search it and require that Transaction; the baseline fixture supplies split memos only.
- **Filters:** clear Search, select label `Payee` (exact) = Sample Landlord; require only that Payee. Reset with `Clear search and filters`; select Category = Gifts, require Sample Warehouse Club’s split. On the Accounts page select Account = Checking; fill From and To with an observed row’s date, require only rows in range. Combine filters and Search, inspect all pages via Show more if available. Category = `Uncategorized` shows only rows with no Category that are neither split nor a Transfer; label `Status` = `Unapproved` shows only Unapproved rows (bold). Open `/accounts?category=uncategorized` and `/accounts?status=unapproved` directly and require the panel open with that filter selected.
- **Empty/reset:** Search `SampleNoSuchPayee9001`; require the loaded empty list. Click `Clear search and filters`; require blank controls and original rows. Repeat on a named Account (no Account filter) and at 320 px; all labels and results must remain usable without overflow.

## Gotchas

- **Manual drive:** punctuation-only Search returns no rows; only the first 16 alphanumeric terms count. Category offers `Ready to Assign` when it exists; select it and verify the matching Transactions.
- **Manual drive:** distinguish the filter alert `Budge couldn't load every filter. Try reloading the page.` from the list alert `Budge couldn't load Transactions. Try reloading the page.`; neither is a successfully loaded empty result.

- Search/filter changes can return short pages; use Show more before asserting global absence.
- Bank Text matching after Unmatch is covered with imports; global Payee renaming has no UI (see Payees).
- Sources: ticket 16; public `transactions.list`, `payees.list`, `categories.list`.
