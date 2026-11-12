# 10 — Fixes from review round 3

Status: in progress (round 4 next)

Round 3 scores: Sol 8, Sol 8, Opus 7. The fixes below answer their findings.

## Done

- Bank changes are a queue, not a hunt. `transactions.list` takes `bankChanges: true` (index `imports.by_state_transactionId`) and the register's Status filter offers `Bank changes`; `transactions.bankChangeCount` feeds a Budget `Needs you` chip that opens that filter.
- Transaction dialog: a flagged Transaction opens focused on a banner at the top that says what the bank now says (`The bank now says −$44.75 on …` or `The bank removed it.`) with `Use the bank's version` / `Delete it` and `Keep mine`. Focusing an empty Split line fills in what is left. The form uses Budge's own validation messages (`novalidate`), and the dialog scroll padding keeps a focused field above the sticky footer. On desktop the dialog may grow to the viewport less 6rem.
- Register focus and announcements: after Save or Delete focus returns to the edited row, else the row now in its place, else `Add Transaction`; approving a row moves to the next waiting row; `Show more` focuses the first new row. A live region says what happened, and a fixed-height result line says how many rows show or why none do.
- Phone approve: below 672 px an Unapproved row has its own Approve button beside the amount.
- Filters live in the URL (`q`, `account`, `category`, `status`, `payee`, `from`, `to`) through shallow `replaceState`, so reload, Back and shared links keep them; malformed values are ignored.
- Bank cards list every problem rather than the first, read `Last successful sync …`, and a card without a bank login says it is a sample and blocks Sync now and Reconnect (`aria-disabled`, described by the problem list). Held bank Accounts count `transactions waiting` in plain words.
- Account page: the sync line ends `· needs you` when its connection needs the owner, at a fixed height.
- Add to Home Screen: the steps follow the device (iPhone/iPad Safari, Android Chrome, or Chrome/Edge install on a computer).
- Import dialog: the submit button says `Import N rows` once the preview is ready, in a fixed-width slot.
- Budget waits for the bank-change and bank counts before painting, so the `Needs you` chips never arrive one by one (measured: zero layout shifts on hard loads and client navigation at 390 and 1280 px).

## Deferred

- Remove a Bank Connection: needs Plaid `item/remove` plus an owned cascade over its Bank Rows through `convex/lib/transactions.ts`. A follow-up spec, not a UI change.
- Import duplicate review and per-row skip: the preview already skips exact duplicates and asks on ambiguous ones; a per-row override needs its own design.
- Settings cutover date typeface: inspected; the field already uses the body face with tabular figures, which is the app-wide numeral style. No change.

## Verification

- `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, and `bun run test` (801 tests) pass.
- Convex tests cover the Bank changes list and count (`convex/bankChanges.test.ts`); the URL filter round trip and malformed values are tabled in `src/lib/transactionFilters.test.ts`; Split remainder fill in `src/lib/transactionEditor.test.ts`.
- Journeys `bank-changes/*`, `plaid/status`, `plaid/late-sync`, `imports/*` updated for the new copy and controls.
