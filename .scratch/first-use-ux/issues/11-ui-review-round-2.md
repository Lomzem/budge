# UI review — first-use UX, round 2

Use [the protocol](../../../docs/quality/ui-review/README.md) and [rubric](../../../docs/quality/ui-review/rubric.md). Round 1 and its dispositions: [11-ui-review-round-1.md](11-ui-review-round-1.md).

## Coordinator brief

- **Spec, scope, tasks and gaps:** unchanged from round 1. The tasks are T1–T10 and the gaps G1–G8 in the [round-1 brief](11-ui-review-round-1.md#coordinator-brief), with the same entry points, journeys, fixtures and expected outcomes. Judge every task afresh; this is a full re-inspection, not a spot check.
- **Reviewed SHA:** `ROUND2_SHA` on `feat/first-use-ux`.
- **Changes since round 1 (`0b22367`):**
  - `80dda30`: a search or filter keeps the checked rows it still shows and says which left.
  - `4ce2459`: the font faces now live in the page shell.
  - `ca0239c`: focus after Bank-card dialogs.
  - `460de2a`: once setup is confirmed, the earlier-Transactions note is information and isn't counted.
  - `e63354d`: Starting Balance entry: no 0.00 placeholder, a message at the field, a confirmed amount prefilled.
  - `9036e26` and `a1c8a9b`: later-start copy.
  - `e6b43ba`: a 44 px touch target for Details.
  - `adb9e33`–`191c424`: every dialog returns focus through one resolver (opener, then continuation, then fallback, never `<body>`). A dialog opened from a menu returns focus to the menu's trigger, and a dialog closing over another keeps focus inside it.
- **Checks at the reviewed SHA's code (`191c424`):**
  - `bun run check`: 924 tests, with capacity checked in a worktree.
  - The dialog journeys: 56 passed.
  - `bun run test:e2e:local`: 56 passed.
  - Sol's code-review, test-audit and `/correct` of the round-1 fixes: no defects ([fix-review](../reviews/11/round-1/fix-review.md)).
- **Required coverage (clarified after round 1).** Round 1's matrix asked for a full cross-product that no judge could finish, and it counted external Plaid as required. Round 2 requires what the protocol states:
  - every task T1–T10 at desktop 1280×800, with pointer;
  - every task T1–T10 at phone 320×640, with touch;
  - keyboard-only completion of every task that offers a keyboard path, including focus return after each dialog closes;
  - targeted samples, not cells: 390×844, dark theme, long names, and the empty, loading, error and held states, where they matter to a flow.

  Two kinds of gap don't block a judge's approval, and their owner tests carry them: G1, real Plaid (Link, delivery, receipts, post-move sync), which the environment can't exercise; and the G2 states that would need a production seam (straddling-Transfer blocker, stale-preview refusal, every unsafe-Undo refusal). Assess G3–G8 on their merits.
- **Sessions:** the judges run in parallel in fresh worktrees at the reviewed SHA, and each judge owns their checkout, backend, browser and evidence. Each writes their report to `test-results/ui-review/<judge>.md` in their checkout; the coordinator copies it to `../reviews/11/round-2/<judge>.md`.

## Independent judge reports

Copied from each judge's checkout into `../reviews/11/round-2/`.

## Coordinator disposition and final gate

Pending.
