# Payees and rename memory

Reuse a Payee's remembered Category, change it only when the owner checks Remember, and remember an edited imported Payee for exactly the same Bank Text.

## Sub-features

- `payee-category`: prefill the remembered Category, respect explicit override.
- `payee-remember`: a Category picked from a row or saved in the dialog is a one-off unless `Remember for <Payee>’s later imports` is checked; only a checked save changes the remembered Category that later imports and the dialog use.
- `payee-memory`: exact Bank Text rename reused, differing text stays distinct.
- `payee-global-rename`: public API rename and search refresh, currently without a UI entry.

## How to get to it (user POV)

- Add/Edit Transaction → Payee and Category or Transfer; with a Category and a Payee, the `Remember for <Payee>’s later imports` checkbox under it (its description says what is remembered now), or `<Category> is remembered for <Payee>’s later imports.` when the pick already is.
- A register row's Category picker → the same checkbox at the foot of the open list (not on splits, Transfers without a Payee, or a Starting Balance). While it is checked only Categories can be picked; picking the row's current Category again remembers it. The Accounts page or a named Account → Payee filter (`#transaction-filter-payee`, populated by `payees.list`).
- Import file → saved imported row → Edit Transaction → Payee.
- Global Payee rename has no visible menu or route in this checkout.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/payees.ts`, also run by `bun run test:e2e:local`):

- `payees/last-category`: the Category memory recipe up to keeping an explicitly picked Category.
- `payees/remember`: a one-off row pick leaves the remembered Rent; by keyboard (ArrowDown, Shift+Tab to Remember, Space, Tab, Enter) the same Category is remembered and announced; in the dialog a new Payee's unchecked save stays unremembered and a checked one is remembered; on a 320 px phone Remember is clear of the tab bar.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Category memory:** open Add Transaction on Checking; fill Payee `Sample Landlord`, expect the `Category or Transfer` combobox to read Rent. Change Payee to `Sample Verification Florist`, expect Uncategorized. Return to Sample Landlord, explicitly select Groceries, change Payee away and back; require Groceries retained. Escape to cancel.
- **Rename memory:** import an invented row with Bank Text `SAMPLE MEMORY 9001`, edit its Payee to `Sample Verification Shop`, categorize Groceries and Save. An imported Payee edit remembers every attached Bank Row’s exact Bank Text; manually repeat with multiple attached rows. Import a different-date/identity row with the exact same Bank Text; require the friendly Payee and Groceries after reload. Import text differing by one character and require no friendly rename. Open details to prove Bank Text stayed unchanged.
- **Global rename:** record no UI entry as blocked, not passed by editing one Transaction. When a UI is provided, require all historical rows and search to adopt the new name and duplicate-name refusal. Inspect `convex/payees.ts` for the current public contract; direct API mutation is API coverage only and not a substitute for this user journey.

## Gotchas

- Recall runs for a nonblank Payee only while Category is Uncategorized and no Category choice was made; editing an already categorized, split or Transfer Transaction keeps its selection.
- **Manual drive:** during recall require `Looking up the last Category…` and disabled Save; lookup failure shows `Budge couldn't look up this Payee's last Category. Pick one to save.` and requires an explicit Category choice. Category loading/failure also blocks unresolved recall; the latter says `Budge couldn't load the Categories. Pick Uncategorized or a Transfer to save.`
- **Manual drive:** select an observed Payee through the list filter and require only its Transactions; this filter is distinct from typing Payee in the dialog.

- `payees.rename` exists publicly but is not wired to UI. Record that missing entry point explicitly.
- Rename-memory rows are created through real imported-Transaction edits; do not seed them through internal setters.
- The server owns the policy: `saveTransaction` takes a required `rememberCategory`; `transactions.create/update` take `rememberCategory`, `transactions.categorize`'s Category choice takes `remember`. Taking the bank's version never remembers. The import outcomes of the policy are proved by `convex/payees.test.ts`, not by a journey.
- Sources: ticket 15–16, first-use UX ticket 06; public `payees.list/lastCategory/rename`.
