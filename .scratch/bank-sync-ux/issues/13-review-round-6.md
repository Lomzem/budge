# 13 — Fixes from review round 6

Status: done; round 7 reviews next

Round 6 scored 8 (sol-a6), 8 (sol-b6) and 8 (opus6).

## Done

- Register approve respects filters: while a search or filter is on, the button reads `Approve N shown` and approves only the shown Unapproved rows (at most 1,000) through the new `transactions.approveMany`, which skips missing and already approved Transactions and returns the ids it approved, so Undo puts back exactly those. `Approve shown` is `aria-disabled` when none is shown.
- Phone register: the Approve button moved to the right of the count line, so the toolbar is Add Transaction and Import on one row (`Import` below `sm`, still named `Import file`). Below a 448 px form, Filters and Clear are icon buttons beside Search, and the Filters count shows only when filters are on.
- Deleting a Transaction returns focus to the neighboring row's Payee button, or `Add Transaction` when the list is empty. Focus used to land on `<body>`: the closing confirm's focus trap took focus back, and the deleted row's button was still in the DOM when the editor returned focus.
- The payee button's accessible name no longer has a space before its comma (`SAMPLE BOOKSHOP 0193, Unapproved, edit …`).
- Account page: the Account name (h1) comes first, then its type, then the sync line.
- Budget: from `sm` the `Needs you` chips wrap instead of scrolling sideways. The inspector dialog on phones has `Previous Category` and `Next Category` buttons that switch to the neighbor and focus its Assigned field. Upcoming shows in the side panel only while no Category is open, so the inspector has the panel to itself. Assigned fields declare `aria-keyshortcuts="ArrowUp ArrowDown"`.
- Held bank Account dialog: a type mismatch now blocks `Import its transactions` (`aria-disabled`, described by the warning) instead of only warning. The new-Account fields, the mismatch warning, the matched-Account note and the Ignore note share one grid cell, so changing the choice never moves the footer. `Already fed by …` sits under its Account name.
- Dialogs: the frame holds a scrolling body, so the Close button stays in view when a long dialog scrolls.

## Kept as is

- Filtered lists don't head their rows `Unapproved` and `Approved`: the server returns them in date order with both kinds mixed, and an Unapproved row is bold and named `…, Unapproved, …`.
- Ready to Assign keeps its full-width row at 320 px; it is the Budget's one number to act on.

## Verification

- `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, `format:check` and `bun run test` (807 tests) pass. `convex/imports.test.ts` covers `approveMany`: duplicates and already approved ids are skipped, only the chosen row is approved, and more than the limit is refused.
- Journeys changed: `transactions/approve-all-undo` (filtered approve and Undo), `transfers/pair` (focus after delete), `inspector/move-money` (Next Category), `accounts/held-new-card` (mismatch blocks import), `accounts/held-map` (`Already fed by`), `targets/monthly` (Upcoming while no Category is open).
- All 37 journeys pass: 36 in the `round7-all2` run, and `transactions/approve-all-undo` in `round7-fix3` after `Approve N shown` got a label width that holds its longest count. The harness fails a journey on any layout shift.
- A layout-shift sweep at 1280, 390 and 320 px (hard loads of every Section, client navigation, month navigation) records no shift without user input.
