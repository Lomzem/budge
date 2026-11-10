# 18 — Fixes from review round 11

Status: done; round 12 reviews next

Round 11 scored 9 (sol-b11), 8 (sol-a11) and 8 (opus11).

## Done

- Dialogs:
  - The pinned title of a scrolled dialog is measured each time a dialog opens, so it never shows the previous dialog's title.
  - The pinned title wraps to two lines instead of truncating, so `ending 9021` stays visible.
  - The body's scroll padding clears the taller pinned header.
- Held bank Account dialog: each notice is as tall as its text. The form's height is still reserved, so switching choices moves nothing.
- Bank card:
  - The freshness line (`Last successful sync …`) shares one slot with `Syncing…`, `Reconnecting…` and the result. It sits beside the buttons, or above them on phones, so the phone card has no empty band.
  - `Reconnect if the bank asks you to sign in again.` sits with the status, on a card that can reconnect.
  - Pressing a paused connection's `Sync now` says `Reconnect first. The bank paused syncing until you do.`
- Accounts page on phones: tighter gaps, and `Add Account` is icon-only below `sm`, keeping its accessible name.
- Register:
  - Below a 448 px toolbar the Search label is visually hidden. Below 480 px the placeholder reads `Search`, so it fits at 320 px.
  - A Payee wraps in full instead of clamping to two lines. It clamps to one line only in the wide layout.
  - On touch screens the Payee button's hit area grows by 10 px above and below.
- Import: when the Account is preset, the dialog opens on the File field.
- Reconcile:
  - `The bank shows the same` is full size.
  - On touch screens it takes initial focus, so no keyboard opens for the common case. With a mouse, the balance field keeps it.
- Export: after a download the status reads `Downloaded budge-<date>.json.`, or the CSV count and file pattern.
- Settings: Escape cancels a cutover-date change and returns focus to `Change`.
- Budget:
  - The invalid-Assigned hint sits inline under the field and pushes the rows below down, instead of floating over the next row.
  - The Needs-you chips snap to their start when scrolled.
- Import error: a long header lists six columns and `and N more`, without the `….` double punctuation.

## Kept as is

- Shell reflow (sol-a11, major): `main` moving from x=0 to x=256 on a first load could not be reproduced.
  - It did not appear after a cold dev start with Vite's dependency cache cleared, in the 1280 sweep.
  - It did not appear in 16 fresh-context first loads of `/bank` and `/settings` on the dev server.
  - It did not appear in the same sweep and 16 fresh loads on a production build (`vite build` + `vite preview`).
  - The reported entry had `hadRecentInput: true`, so it does not count toward CLS.
  - A pre-styled `main` at 192 px wide matches a dev-server first load before Vite injects the stylesheet. Production links the stylesheet in `<head>`.
- The Needs-you chips stay in one scrolling row on phones (opus11 #12). Wrapping would move the table each time a count appears. The row's fade edge shows there is more.
- Close stays last in the dialog's tab order (opus11 #13). That is the dialog library's order.
- A saved Transaction is not highlighted (opus11 #14), a nit deferred below a 9.

## Verification

- These pass: `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, `format:check` and `bun run test` (827 tests).
  - `src/lib/domain/bankFiles.test.ts` has a new table row for a header with eight columns. It fails on the previous message.
- Changed journeys:
  - `export/files`: the JSON status names the file.
  - `settings/cutover`: Escape cancels the change and focuses `Change`.
  - `plaid/reconnect`: pressing a paused `Sync now` reports why.
- Feature maps updated: plaid, budget, transactions, reconciliation, imports, export, settings.
- The first full journey run passed 38 of 39. `plaid/attention` caught that a mouse press on an `aria-disabled` button never reaches its handler, because the Button sets `pointer-events: none`. The `Sync now` wrapper now takes that press.
- Screenshots at 320 and 390 px showed:
  - the placeholder `Search payee or memo` cut off at 320 px, so it now reads `Search` there;
  - the Assigned hint not wrapping in its `nowrap` cell, so it now wraps.
- After those fixes, the affected journeys pass: plaid, budget, transactions, search and shell (13 of 13). With the 38 that passed before, all 39 journeys pass.
- The CLS sweep at 1280, 390 and 320 shows 0 shifts without input on every page and navigation.
