# Payees and rename memory

Reuse the last Category for a Payee and remember an edited imported Payee for exactly the same Bank Text.

## Sub-features

- `payee-category`: prefill last Category, respect explicit override.
- `payee-memory`: exact Bank Text rename reused, differing text stays distinct.
- `payee-global-rename`: public API rename and search refresh, currently without a UI entry.

## How to get to it (user POV)

- Add/Edit Transaction → Payee and Category or Transfer.
- Import file → saved imported row → Edit Transaction → Payee.
- Global Payee rename has no visible menu or route in this checkout.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Category memory:** open Add Transaction on Checking; fill Payee `Sample Landlord`, expect selected `Category or Transfer` option Rent. Change Payee to `Sample Verification Florist`, expect Uncategorized. Return to Sample Landlord, explicitly select Groceries, change Payee away and back; require Groceries retained. Escape to cancel.
- **Rename memory:** import an invented row with Bank Text `SAMPLE MEMORY 9001`, edit its Payee to `Sample Verification Shop`, categorize Groceries and Save. Import a different-date/identity row with the exact same Bank Text; require the friendly Payee and Groceries after reload. Import text differing by one character and require no friendly rename. Open details to prove Bank Text stayed unchanged.
- **Global rename:** record no UI entry as blocked, not passed by editing one Transaction. When a UI is provided, require all historical rows and search to adopt the new name and duplicate-name refusal. Inspect `convex/payees.ts` for the current public contract; direct API mutation is API coverage only and not a substitute for this user journey.

## Gotchas

- `payees.rename` exists publicly but is not wired to UI. Record that missing entry point explicitly.
- Rename-memory rows are created through real imported-Transaction edits; do not seed them through internal setters.
- Sources: ticket 15–16; `e2e/transactions.test.ts`; public `payees.list/lastCategory/rename`.
