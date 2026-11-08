# 12 — Fixes from review round 5

Status: done; round 6 reviews next

Round 5 scored 9 (sol-a5), 8 (sol-b5) and 8 (opus5).

## Done

- Bank cards: the icon sits beside the name only; feeds, problems, the sync line and the actions align under the name from `sm` and use the full width on phones, so a phone card has no blank gutter. A connection that needs a reconnect has Sync now `aria-disabled`, described by its reconnect line. `Connect a bank` is `aria-disabled` and described by the page notice instead of `disabled`, so it stays focusable and says why.
- The `bank-sync` seed adds Sample Community Bank, a healthy connection feeding Savings, so the late-sync and late-renew journeys exercise a card that can sync.
- Register sync line: the pill names the reason (`Reconnect needed`, `Last sync failed`, `Consent ends Nov 13`, `Missed its daily sync`) and links to that connection's card, which the Bank page scrolls to and focuses once loaded. The line wraps to two reserved lines on phones instead of truncating the connection name.
- Register: unfiltered lists head their rows `Unapproved` then `Approved`. The heading rows mirror the table's columns, since a `colspan` past the visible columns made the fixed table invent columns and shifted every header. `Approve all` leaves `Approved N Transactions. Undo` on the count line; Undo puts exactly those back (`transactions.unapprove`, which skips any since Reconciled or deleted). `approveAll` now returns the ids it approved.
- Transaction editor: a bank change shows the bank's amount and date above yours. Unlock asks first (`Unlock this Transaction?`), then says it's no longer Reconciled. Escape, the close button or a click outside on a changed form asks `Discard your changes?`. Enter in Payee moves to Amount instead of submitting. A validation error in the footer updates or clears as the form changes.
- Budget: ArrowDown/ArrowUp move between Assigned fields, saving first. The overspent chip steps through every overspent Category, scrolling each row into view. `Needs you` lists the Bank chip right after the money problems, red when a connection needs a reconnect or failed. Ready to Assign keeps its amount on one line, with the Uncategorized note on its own reserved line. The inspector's title is larger than its section headings.
- Held bank Account dialog: says how many transactions wait, marks Accounts already fed by a connection, and warns when the chosen Account's type differs from what the bank reports.
- Menus are at least 176 px wide and fit their longest item.

## Kept as is

- On a server without Plaid credentials, Reconnect and Sync now stay enabled on healthy cards. Production always has credentials; the page notice explains the local case, and the journeys need those clicks to prove each result lands on its own card.
- The slashed zero in amounts stays: it keeps 0 and 8 apart in dense money columns.
- The held dialog shows the waiting count, not the rows. The card already lists the count, and a row preview needs a new query; deferred until an owner asks for it.

## Verification

- `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, `format:check` and `bun run test` (807 tests, including the feature-map test) pass.
- All 37 journeys pass in one `bun run app verify` run (`round6-all`); the harness fails a journey on any layout shift.
- A layout-shift sweep at 1280, 390 and 320 px (hard loads of every Section, client navigation, month navigation) records no shift without user input.
