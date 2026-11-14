# 01: Fix the deferred round-2 UI review findings

**Status:** needs-triage

**Source:** the first-use-ux ticket 11 round-2 UI review. All three judges approved commit `1d463b6` at 9/10, and these findings were deferred so the approved commit would stay unchanged. The reports and reasons are in `.scratch/first-use-ux/reviews/11/round-2/` and in the disposition section of `.scratch/first-use-ux/issues/11-ui-review-round-2.md` on `feat/first-use-ux`, which reach `main` when that branch merges.

**Blocked by:** the first-use-ux integration PR merging into `main`.

## Findings

1. **r2-opus-1 (minor):** in the register, approve one row while other rows are checked. The visible "Approved … / Undo" line is replaced by the selection bar, so there's no visible result and no Undo until Clear selection. The result and its Undo should stay reachable while rows are checked.
2. **r2-opus-2 (minor):** a keyboard user needs about 31 Shift+Tab presses to get from checked rows back to the bulk Categorize button, because the bar comes before the table in reading order. Make it a short, predictable trip, through reading order, a skip control or a shortcut, and pin it in a journey.
3. **r2-opus-3 (minor):** at 320 px, the pinned Starting-balance confirmation (114 px tall, at least 15 s) covers the last Bank card's Reconnect and Sync now. At Sync now's centre, the element hit is Dismiss. Keep the controls under it reachable, and add the case to the `expectClearOf` coverage.
4. **r2-opus-4 (minor):** a first start date after today saves without the warning that a later move gets (`9036e26`). Show the same consequence when the first date is set.
5. **r2-sol-a-2 (minor):** after a partial Undo where a deleted Category was kept, focus scrolls to the row, leaving the explanation above the visible area. Show the explanation next to where focus lands, or keep it in view.
6. **r2-sol-a-1 / r2-opus-6 (minor/nit):** under Vite dev serving only, a Category chevron moves 9 px in about 1 run in 3 of `transactions/select-categorize`, after a held bulk save. The journey's layout-shift guard then fails under `bun run app verify`. The production build doesn't show it. Find the cause, since the font faces already live in the page shell.
7. **r2-opus-5 (nit):** at 320 px, a Cash Account with a balance of 1,234,567.89 pushes Reconcile to 321 px.
8. **r2-opus-7 (nit):** an unconfirmed Starting balance reads "Now $2,418.37" next to the header Balance. Consider "Recorded now", to match "Remembered now".

## Acceptance

- Each finding is fixed, or answered with a reason, in this file.
- Behavior changes are proven with verify-budge journeys at desktop and 320 px, plus a red run on the old behavior.
- The ticket gets a three-judge UI review, scoped to these changes.
