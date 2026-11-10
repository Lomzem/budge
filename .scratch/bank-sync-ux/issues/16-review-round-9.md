# 16 — Fixes from review round 9

Status: done; round 10 reviews next

Round 9 scored 9 (sol-a9), 9 (sol-b9) and 8 (opus9).

## Done

- Budget, inline Assigned:
  - Enter saves and moves to the next Category's Assigned field. On the last field it stays put and reselects.
  - The field keeps showing the amount it just sent until the save lands, so the old value never flashes back.
  - Invalid text shows a one-line hint beside the field (`Try 120.00, 100+20 or +5. Esc restores.`) instead of a bubble over the row above. The screen-reader alert keeps the full sentence.
- Budget on phones:
  - From 352 px (a new `xs` breakpoint) the table shows Assigned, so assigning is one tap and type, with no detour through the inspector. Below 352 px it hides again and the inspector edits it.
  - The inspector dialog's header and Close stay pinned while it scrolls.
  - Ready to Assign stays on one row at 320 px.
  - The `Needs you` chips use short text below `sm` (`N overspent`, `Bank: N to do`), so none is cut off.
- Splits:
  - Choosing Split keeps the Category and leaves line 1's amount empty, so the status shows the whole amount left to split.
  - `Add line` focuses the new line's Category and clears the last refusal.
  - With only two lines, an empty line asks `Pick its Category and amount.` instead of offering to remove a line that can't be removed.
- Bank changes:
  - A row with one flagged Bank Row offers its fix in the row: `Use the bank's <amount>` or `Delete it` (with the same confirmation as the editor), then `Keep mine`.
  - Resolving focuses the row, or the next row when it leaves the list.
  - The editor no longer repeats `The bank removed it.` under a heading that already says so.
- Reconcile: `The bank shows the same` is the primary button until a bank balance is typed. Then `Reconcile` becomes primary.
- Dialogs on phones: the footer no longer reserves an empty error band. An error appears only after the owner presses the submit button.
- Bank: the held and ignored bank Account notes talk about transactions, not rows (`Their transactions wait here until you choose where they go.`).

## Kept as is

- A row's height can change when another session edits its data (opus9 #7). Nothing the viewer did causes it, and pinning row heights would clip real content such as a two-line Payee or a new bank flag.
- `Approve all` stays `aria-disabled` at zero (recorded in round 8).
- opus9's nits are deferred as polish below a 9:
  - the underlined balance;
  - the wrapping `Cover … from Ready to Assign`;
  - the width of `Approve 1`.

## Verification

- These pass: `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, `format:check` and `bun run test` (824 tests).
  - `src/lib/transactionEditor.test.ts` covers the split start and the empty-line wording with two and three lines.
- Changed journeys:
  - `bank-changes/take-the-banks`: delete from the row.
  - `bank-changes/keep-mine`: keep mine from the row, and the removed banner without the repeated line.
  - `budget/assign`: Enter moves on.
  - `splits/*`: empty first line, Add line focus.
  - `plaid/*`: the desktop chip text.
  - `budget/needs-you`: reads the count from the chip instead of a fixed 6. The fixture's Uncategorized count depends on the date, so the fixed number failed once the date changed.
- Bank-change rows at 1280: the flag names the bank's amount (`Bank changed this to −$44.75`). Both buttons then fit on one line under the Payee's details.
- Full journeys: 39/39 pass. The CLS sweep at 1280, 390 and 320 shows 0 shifts without input on every page and navigation.
- The feature maps for budget, bank-changes, reconciliation, splits and plaid are updated.
