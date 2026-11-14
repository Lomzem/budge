# UI review — first-use UX, round 2

Use [the protocol](../../../docs/quality/ui-review/README.md) and [rubric](../../../docs/quality/ui-review/rubric.md). Round 1 and its dispositions: [11-ui-review-round-1.md](11-ui-review-round-1.md).

## Coordinator brief

- **Spec, scope, tasks and gaps:** unchanged from round 1. The tasks are T1–T10 and the gaps G1–G8 in the [round-1 brief](11-ui-review-round-1.md#coordinator-brief), with the same entry points, journeys, fixtures and expected outcomes. Judge every task afresh; this is a full re-inspection, not a spot check.
- **Reviewed SHA:** `de7b552` on `feat/first-use-ux`.
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

**Gate: passed on `1d463b6`** (the reviewed `de7b552` plus the line that pins it). All three judges scored 9/10 on that commit independently. Each completed the required coverage, and none left a blocker or major open.

| Judge | Model, effort | Score | Verdict | Report |
| --- | --- | ---: | --- | --- |
| Sol A | GPT-6.1-Sol, high | 9 | approve | [sol-a.md](../reviews/11/round-2/sol-a.md) |
| Sol B | GPT-6.1-Sol, high | 9 | approve | [sol-b.md](../reviews/11/round-2/sol-b.md) |
| Opus | Opus 5.5 | 9 | approve | [opus.md](../reviews/11/round-2/opus.md) |

All round-1 findings were re-checked as fixed or answered. The one exception is opus-5: the warning covers a later move, but not a first start date after today. That case is now r2-opus-4.

The Opus judge's grep printed four lines of the round-1 disposition section: two dispositions its brief already gave it, and the round-2 coverage note. They contained no score or verdict from any judge. The judge declared this, and no judgment relied on them. The approval stands.

Every round-2 finding is a minor or a nit. Fixing any of them would change the approved commit and need a fresh three-judge round. So all are deferred, with reasons, to [first-use-ux-polish 01](../../first-use-ux-polish/issues/01-round-2-ui-findings.md):

| Finding | Severity | Disposition |
| --- | --- | --- |
| r2-opus-1: Approving one row while others are checked hides that row's result line and Undo behind the selection bar. | minor | **Deferred.** The result is still announced. Clear selection brings Undo back, and the row can be unapproved directly. |
| r2-opus-2: A keyboard user needs about 31 Shift+Tab presses from the checked rows to the bulk Categorize button. The bar comes before the table in reading order. | minor | **Deferred.** The task completes by keyboard. The fix is a change to reading order or a skip control, and needs its own design and a journey. |
| r2-opus-3: At 320 px, the pinned Starting-balance confirmation covers the last Bank card's Reconnect and Sync now. | minor | **Deferred.** Dismiss clears it, and the message is short-lived. Needs a layout fix and a journey assertion. |
| r2-opus-4: A first start date after today saves without the warning that a later move gets. | minor | **Deferred.** The user can recover with Change. It extends the existing future-date line from `9036e26` to the first-set path. |
| r2-sol-a-2: After a partial Undo following a Category deletion, the explanation sentence is above the visible area once focus scrolls to the row. | minor | **Deferred.** The sentence is in the live region, so screen readers announce it, and scrolling up shows it. This is a rare two-tab path. |
| r2-sol-a-1 / r2-opus-6: In about 1 run in 3, a Category chevron moved 9 px on the dev server and the journey's layout-shift guard failed. | minor / nit | **Deferred.** Seen only under Vite dev serving. CI and `test:e2e:local` run the production build behind `scripts/local/preview.ts` (`playwright.config.ts`), and 56 of 56 passed there. Cold loads showed 0 shifts for all three judges. Remaining risk: `bun run app verify` can flake on this journey. |
| r2-opus-5: At 320 px, a balance of 1,234,567.89 pushes Reconcile 1 px past the right edge. | nit | **Deferred.** It needs a seven-figure balance. |
| r2-opus-7: The unconfirmed "Now $2,418.37" next to the header Balance can read as today's balance. | nit | **Deferred.** It's a wording choice ("Recorded now"); copy review in the follow-up. |
