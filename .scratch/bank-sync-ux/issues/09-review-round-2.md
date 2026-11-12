# 09 — Fixes from review round 2

Status: done (round 3 scored Sol 8, Sol 8, Opus 7; see 10)

Round 2 scores: Sol 8, Sol 8, Opus 7. The fixes below answer their findings.

## Done

- Phone Budget: below `sm` the table shows Category and Available only; Assigned and Activity return from `sm`. Assigning on a phone happens in the inspector, whose `Assigned this month` row is now an Assigned field (`budget/budget-mobile`, `inspector/*`).
- Status lines: uncovered card debt reads as warning text under the Category; waiting and payment notes share one helper (`status.ts`).
- Needs you: one fixed-height scrolling strip, so chips appearing or leaving never move the table.
- Register: Payee wraps to two lines; the Cleared column shows from `lg`, and below it the Cleared checkbox sits under the amount. `Approve all` stays focusable and says why it can't run (`aria-disabled`) instead of vanishing from the tab order.
- Transaction dialog: Direction and Amount come before Category; Payee offers known payees; the split status sits beside its heading and never wraps.
- Dialog footers: every dialog error lives in a sticky footer with the buttons, so long forms keep Save visible and an error never pushes the buttons down. Twelve dialogs use `Dialog.Footer error`.
- Bank page: `bankConnections.list` returns `bankLogin`. Each card states its one problem first (no bank login, reconnect, last error, consent ending, overdue), then when it last synced, then the running or finished action on a fixed-height line. Cards keep their first-seen order, ranked by urgency, so a sync never reorders them. Sync now and Reconnect use `aria-disabled` while blocked. The connect result is a dismissible toast instead of a reserved paragraph.
- Inspector side panel: sticky and height-capped (`max-h-side-panel-height`), scrolls on its own, and selecting a Category focuses it without scrolling the page.
- Accounts page on phones: the `Your Accounts` disclosure remembers whether the owner left it open.
- Font: the body face is preloaded, so text no longer reflows when it arrives.
- Navigation landmark renamed `Sections and Accounts`; section badges no longer read a stray comma.
- Assigned errors open to the left of the field, so they never cover the next row.

## Verification

- `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, and `bun run test` pass.
- All 36 journeys pass with the layout-shift guard (verify run `r3-fixes3`).

## Notes

- A run against a long-lived dev server failed 26 journeys with a Svelte `get_first_child` crash inside lucide icons; it was stale HMR state. Restarting the app cleared it, and the fresh run is the evidence above.
- The first fresh run (`r3-fixes2`) found a 4 px sideways scroll in the 320 px register: table cells holding a checkbox dropped their right padding, so the checkbox's hit area ran past the table. Cells keep their padding now and the phone Cleared checkbox sits 4 px in. Two journeys were matching too loosely after the renames (`Sections` vs `Sections and Accounts`; the hidden wide-layout `Reconciled` label) and now match exactly.
