# 11 — Fixes from review round 4

Status: done; round 5 reviews next

## Done

- Budget `Needs you` strip: the chips were invisible. Tailwind's `mask-l-*`/`mask-r-*` pair combined into an inverted mask that hid every chip. The strip now uses `fade-edges` with `fade-start`/`fade-end` (`src/app.css`), a single gradient that fades only the edge with more chips beyond it.
- Phone register: Payees wrap to two lines with an ellipsis. The Table cell's `whitespace-nowrap` had kept them on one clipped line, so `line-clamp-2` never applied.
- Phone Accounts page: the `Your Accounts` list starts closed, so Add Transaction, search and the first rows are in view. It opens on arrival only if the owner left it open last time.
- Bank card recovery: a connection that needs a reconnect shows one line, `Needs you to reconnect before it can sync again. The bank stopped its sync at <time>.`, instead of a second failure line carrying the Plaid code. Other failures show the bank's reason without the code. An action refused for a missing login now says `Reconnect this bank first.`, which no longer repeats the card's problem line.
- Dialog footers on phones: buttons share rows instead of stacking one per line, primary last. At 320 px the Transaction editor's footer drops from three full-width rows to Delete beside Approve with Save beneath, giving the form about 50 px more. Delete uses the destructive tint so it reads apart from Approve, and it still confirms first. Each phone register row already has its own Approve button (44 px), so approving one Transaction never needs the editor.
- Import likely duplicates: a CSV row with no bank ID, on the same day and amount as a Transaction already imported from a CSV, previews as `Likely already here: <Payee>, <date>` and is skipped unless the owner picks `Add it as new`. Each earlier Transaction holds back one row at most, so two genuinely identical purchases in one file still import as two. Preview dates use the long format.
- Bank sync on a server that isn't set up: Sync now says `Bank sync isn't set up on this server.` without recording a failure on the card, and the daily sync skips every connection, so a missing Plaid secret or token key never paints every card red. A paused connection still says `Reconnect this bank first.`.
- Bank cards: the filled button is the card's next step (Reconnect when a reconnect is needed, else Sync now); the sample card with no bank login has both outlined. The seeded Savings Bank last synced a day ago instead of never, matching a connection the bank paused.
- Budget: the viewed month lives in the URL (`?month=`), so reload, Back and shared links keep it. Ready to Assign is one row with its label and Uncategorized note on the left and the amount on the right. The separate Overspent list is gone, since overspent Categories already show in `Needs you` and their own rows; a negative hidden Category is red. On wide screens the empty side panel says what it is for.
- Settings: Change focuses the date field; Cancel and Save return focus to Change.
- Transaction editor: Delete's confirmation uses a red Delete, and `Keep it` returns focus to the editor's Delete instead of the page. A split that doesn't add up says how much is left (`$1.50 is still left to split.`) or over (`The lines are $0.50 over the amount.`). The footer reserves the error line's height on phones and wide screens, so an error never moves Save.

## Verification

- `bun run lint`, `lint:ui`, `typecheck`, `codegen:check` and `bun run test` (801 tests) pass.
- Screenshots of the Needs-you strip at 320, 390 and 1280 px, scrolled to the start and to the end, show the chips, with the fade only on the overflowing edge.
- At 320 px, every Payee is at most two lines and none is clipped; the page doesn't scroll sideways.
