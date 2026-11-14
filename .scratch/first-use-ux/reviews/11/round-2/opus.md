# Independent judge report: Opus (round 2, ticket 11 first-use UX)

- **Model and reasoning setting:** Opus 5.5 (`claude-opus-5-5`), reasoning effort as configured by the harness. No slot unavailable.
- **Fresh context and independence:** I worked from the round-2 brief only. I did not open `.scratch/first-use-ux/reviews/`, and I did not read any other judge's report, score or verdict, or the implementer's own assessment. Two grep commands accidentally printed single lines from the disposition area of `.scratch/first-use-ux/issues/11-ui-review-round-1.md`:
  - lines 132 and 142, early in the session;
  - line 136 (the opus-6 font row) and line 147 (the round-2 coverage clarification), while I was looking up the T1–T10/G1–G8 scope table.
  
  They repeat dispositions my brief already gave me, and they contain no judge scores or verdicts. No judgment relies on them.
- **Revision, tree and ownership:**
  - Reviewed SHA `1d463b6` (detached) in my own worktree `/home/lomzem/proj/budge-judge2-opus`.
  - `git status --porcelain` is empty. `test-results/` is git-ignored, and `summary.json` reports `uncommittedChanges: false`.
  - The checkout and app session belong to the Opus judge only. I did not touch the main checkout or any other judge's app.
- **App readiness and fixtures (sanitized):**
  - I ran `bun run app up`.
  - `bun run app doctor`:
    - Clerk variables are set and belong to one development instance.
    - The local Convex backend and Vite are reachable, and `convex/_generated` is fresh.
    - The Clerk test user is available.
  - The app was served by the Vite dev server at `127.0.0.1:5175`.
  - Fixtures were synthetic only: `empty-budget`, `budget-with-accounts` and `bank-sync`. I reseeded before every manual script.
  - Sync, Reconnect and Link answers were faked at the browser boundary with `answerInsteadOfServer` and a fake `link-initialize.js`. No real Plaid credentials or bank data were used.
  - Manual sessions used the saved storage state and `timezoneId: America/Los_Angeles`. Today was 2026-11-14.

Evidence roots:
- `E` = `/home/lomzem/proj/budge-judge2-opus/test-results/verify-budge`
- `M` = `E/judge2-opus-manual`. Each run folder has `log.txt`, screenshots and aria snapshots.
- Scripts are in `/home/lomzem/proj/budge-judge2-opus/test-results/ui-review/`.

## Maintained journeys

`bun run app verify … --run judge2-opus-1` ran 38 journeys. 37 passed: `settings/start`, `settings/cutover`, `settings/later-start`, `settings/later-move`, the `accounts/*` setup and held set, `plaid/*`, `transactions/*`, `transfers/*`, `payees/*`, `splits/lines`, `search/*`, `shell/*`, `imports/approve` and `budget/needs-you`.

1 failed: `transactions/select-categorize`. All 10 of its steps passed, but its final layout-shift guard reported a Category chevron moving 9 px (score 0.0000) after a held bulk save landed. I reran it as `judge2-opus-2` and `judge2-opus-3`, and both passed (see r2-opus-6).

## Task table

| Task / entry point / journey | Fixture | Viewport and input mode | Observed outcome / persistence | Evidence path | Pass / fail / unverified |
| --- | --- | --- | --- | --- | --- |
| T1 Choose the start: Budget, Bank, Settings; `settings/start`, `settings/cutover` | empty-budget | 1280 pointer (journeys); 1280 keyboard; 320 touch | <ul><li>Nov 1, 2026 is proposed everywhere, with the consequence explained at the choice.</li><li>Keyboard: 12 Tabs reach the date with a visible ring. Enter saves and focus goes to Change. Escape or Cancel returns focus to Change. The unset Settings entry has no Cancel.</li><li>An all-earlier file shows "Nothing in this file is dated on or after the cutover date." with Import disabled, and Escape returns focus to Import file.</li><li>320 is clean.</li><li>A first date after today saves with no warning (r2-opus-4).</li></ul> | `E/judge2-opus-1/settings/*`; `M/m1-start-keyboard`, `M/m1-start-touch`, `M/m1b-future` | Pass (minor r2-opus-4) |
| T2 Confirm Account identity and balance: Bank card → Check balance; Account actions → Starting balance; `accounts/setup-check`, `accounts/start-late-save` | bank-sync, budget-with-accounts | 1280 keyboard; 320 touch; 390 touch dark | <ul><li>Check Savings takes 17 Tabs and focus lands in the field. An empty Confirm shows "Enter the balance your bank showed on Sep 1, 2026." at the field, and focus stays.</li><li>Escape or Cancel returns focus to Check. Reopening shows an empty field.</li><li>Confirming 1000 moves focus to "Categorize its Transactions". The badge drops from 9 to 8 and the status clears the tab bar.</li><li>Checking via actions → Starting balance: entering 2500 changed the balance from $8,165.49 to $8,247.12 (+$81.63 over "Now $2,418.37"), which is consistent. Focus returns to the actions trigger and the badge drops from 8 to 7.</li><li>The basis disclosure is readable at 320. Dark theme is legible.</li></ul> | `M/m2-bank-keyboard`, `M/m2c-checking-keyboard`, `M/m3-bank-phone-320`, `M/m3-bank-phone-390-dark`; `E/judge2-opus-1/accounts/*` | Pass (nit r2-opus-7) |
| T3 Correct a mapping: Stop syncing → Bring back → Set up; held map, new card, unknown kind, legacy name, ignore | bank-sync | 1280 keyboard; 320 touch; 390 touch dark | <ul><li>Held Savings Plus → Savings: focus opens on a radio, and arrow keys choose. The Starting balance step has a described field, and Escape or Skip returns focus to Check balance (opus-1 fixed).</li><li>Rewards Card as a new Credit card shows "Amount owed on Sep 1, 2026".</li><li>Ignore moves focus to the card with a visible border, and the row reads "Done / Ignored".</li><li>Remove connection… opens an alertdialog. Escape returns focus to the actions trigger.</li><li>New Account "Savings Plus" at 500: focus goes to "Open Savings". The earlier-Transactions note is muted, not amber, and is not counted (opus-2 fixed). The badge drops from 8 to 7 and survives reload. Budget Needs you agrees.</li></ul> | `M/m2-bank-keyboard`, `M/m2b-bank-keyboard`, `M/m3-bank-phone-*`; `E/judge2-opus-1/accounts/held-*`, `plaid/stop-and-bring-back` | Pass |
| T4 Preview a later start: Settings → Change → Start on date? | budget-with-accounts | 1280 keyboard; 320 touch; 390 touch dark | <ul><li>The preview shows per-Account folded history, Starting Balances, the Now/After table (stacked on phones) and the discarded $6,140 assignment copy.</li><li>Focus opens on Cancel, with the Tab order as answered (opus-7). Move start date is visible at every size.</li><li>Escape keeps the date draft and returns focus to the field.</li><li>A future date with history refuses with "Pick today or an earlier date…" and offers Cancel only (opus-5 fixed for moves).</li><li>Right edges are OK.</li></ul> | `M/m4-later-keyboard-1280`, `M/m4-later-touch-320`, `M/m4-later-touch-390-dark`; `E/judge2-opus-1/settings/later-start` | Pass |
| T5 Confirm and recover: Move start date; Undo move; re-import an earlier row | budget-with-accounts | 1280 keyboard; 320 touch; 390 touch dark | <ul><li>Move puts focus on Change and the region shows "Starts on Nov 1, 2026, moved from Sep 1, 2026." with Undo move explained.</li><li>Re-importing a folded 2026-10-15 row shows "Nothing in this file is dated on or after the cutover date." on 1280 and 320, and Cancel returns focus to Import file.</li><li>Undo puts focus on Change, shows the status "The start date is back on Sep 1, 2026, with its history.", and survives reload.</li><li>The fixture needed no unlock.</li></ul> | `M/m4-later-*`, `M/m9a-phone`; `E/judge2-opus-1/settings/later-move` | Pass |
| T6 Search and edit one Category or Transfer inline; accounting recipes | budget-with-accounts | 1280 pointer and keyboard; 320 touch | <ul><li>Income +1000 to Ready to Assign: RTA $12,826.88 → $13,826.88 and Checking +1000.</li><li>Cash Transfer of 50: RTA unchanged, Checking −50, Savings +50.</li><li>Card payment of 30: Checking −30, debt −30, RTA unchanged, and Payment Available $1,165.91 → $1,135.91.</li><li>Ready to Assign and "Transfer: X" are offered in their sections.</li><li>Keyboard: 33–45 Tabs to a row Category with a ring. Typing searches directly. Enter does a one-off save, and focus returns to the row button.</li></ul> | `M/m5-picker-keyboard`, `M/m5-picker-touch`; `E/judge2-opus-1/transactions/categorize*`, `transfers/*` | Pass |
| T7 Remember deliberately | budget-with-accounts | 1280 keyboard; 320 touch | <ul><li>A one-off save leaves the memory at Rent.</li><li>Keyboard: Remember is 1 Tab from the search with a ring. Space checks it, 1 Shift+Tab returns, and Enter shows "Groceries saved and remembered for Sample Landlord". Add Transaction then recalls Groceries with its memory line.</li><li>Discard returns focus to Add Transaction.</li><li>Phone: Remember is clear of the tab bar and reads "Remembered now: Rent."</li></ul> | `M/m5-picker-*`, `M/m9b-remember-keyboard`; `E/judge2-opus-1/payees/*` | Pass |
| T8 Select a subset, save with or without approval, Undo | bank-sync | 1280 keyboard; 320 touch | <ul><li>Space toggles checkboxes with a ring. The bar shows the count and scope.</li><li>The bulk picker opens in its search. "Approve them too" is 1 Tab away. Saving moves focus to Undo, and Undo moves focus to the first restored row.</li><li>Reaching the bulk picker by keyboard takes 31 Shift+Tabs (r2-opus-2).</li><li>A row Approve while another row is selected shows no visible result or Undo (r2-opus-1).</li><li>Touch 320: the bar is 145 px (as answered for opus-9). The picker, opt-in and Undo are clear of the tab bar. "2 Transactions now Dining Out. Undo" and "Approved 4 Transactions. Undo" both appear. The no-match empty state offers Clear.</li></ul> | `M/m6-select-keyboard-1280`, `M/m6-select-touch-320`, `M/m6b-undo-with-selection`; `E/judge2-opus-1..3/transactions/select-categorize`, `approve-*` | Pass (minor r2-opus-1, r2-opus-2) |
| T9 Mixed-purpose Payee: Group by Payee | budget-with-accounts, bank-sync | 1280 keyboard; 320 touch | <ul><li>The toggle is a button with `aria-pressed`, and Enter toggles it. It survives reload.</li><li>Group checkboxes read "Select the N Unapproved shown from <Payee>". At 320 a group tap picks the shown row and Show more is offered. Ungrouping keeps the selection. Right edge is OK.</li></ul> | `M/m6-select-keyboard-1280`, `M/m9a-phone`; `E/judge2-opus-1/transactions/payee-groups` | Pass |
| T10 Read Sync feedback and recover | bank-sync | 1280 keyboard; 320 touch | <ul><li>Focus stays on Syncing… while busy.</li><li>A zero sync reads "No Transactions added." A held result reads "3 Transactions added. 2 wait for setup below." with Details, and the next Tab reaches "Set up Sample Savings Plus".</li><li>Details opens with Space, has a ring, and its hit area is 44 px on touch (opus-10 fixed).</li><li>A failure says "Bank sync isn't set up on this server." and is never shown as success.</li><li>After reload only freshness remains, because the failure was faked in the browser and never stored; see G1/G2.</li><li>The pinned confirmation covers the last card on a phone (r2-opus-3).</li></ul> | `M/m7-sync-keyboard`, `M/m7-sync-touch`, `M/m7b-details-target`, `M/m3b-toast`; `E/judge2-opus-1/plaid/*` | Pass (minor r2-opus-3) |
| G3 Deleted-Category Undo | bank-sync | 1280 pointer, two tabs | <ul><li>Bulk changed 2 Groceries rows to Dining Out, then Groceries was deleted in a second tab with its history moved to Rent.</li><li>Undo was still offered and says "2 Transactions kept Dining Out because their earlier Categories were deleted." Focus goes to the first row. The message is truthful.</li></ul> | `M/m8c-g3` | Pass |
| G4 Earlier-Transactions notice | bank-sync | 320/390 touch | <ul><li>After confirmation it is muted information with a link and counts nowhere. No dismissal is needed.</li></ul> | `M/m3-bank-phone-*` | Pass |
| G5 Pending-search selection | bank-sync | 1280 keyboard | <ul><li>A row checked immediately after typing stays checked once the search applies, with 1 picked.</li></ul> | `M/m6-select-keyboard-1280` | Pass |
| G6 Superseded success / G7 changed counts | bank-sync | journeys | <ul><li>The latest operation owns the feedback.</li><li>The copy counts only added, waiting and matched rows. It never claims "nothing changed".</li></ul> | `E/judge2-opus-1/plaid/superseded-sync`, `sync-waiting` | Pass |
| G8 Load stability (dev serving mode) | bank-sync | 320, 390, 1280 cold loads | <ul><li>`/`, `/bank` and `/accounts` recorded 0 layout-shift entries at each width. The font swap (opus-6) is gone.</li><li>The one guard trip was the chevron in r2-opus-6, not fonts.</li></ul> | `M/m8-g3-long/log.txt`; all journey runs | Pass |
| Long content | bank-sync | 320 touch | <ul><li>A 60-character Account name truncates in the h1. Register, Accounts list, Bank and Budget are clean.</li><li>A seven-figure balance pushes Reconcile 1 px past the edge (r2-opus-5).</li></ul> | `M/m8b-long-phone`, `M/m8-g3-long` | Pass (nit r2-opus-5) |

## Findings

| Finding ID | Severity | Task and reproduction | Expected vs observed / user impact | Evidence |
| --- | --- | --- | --- | --- |
| r2-opus-1 | minor | T8, bank-sync `/accounts` at 1280: (1) check any row; (2) click Approve on another row. | <ul><li>Expected: the visible "Approved … / Undo" result line, as appears when nothing is selected.</li><li>Observed: the result line is replaced by the selection bar. "Approved SAMPLE BOOKSHOP 0193" exists only in the live region, and there are 0 Undo buttons. Undo reappears only after Clear selection.</li><li>Impact: a mistaken row Approve gives no visible confirmation and no in-place Undo while a selection is in progress. A keyboard user's focus has already moved to the next row's Approve.</li></ul> | `M/m6b-undo-with-selection/01-approved-with-selection.png`, `log.txt`; `M/m6-select-keyboard-1280/log.txt` |
| r2-opus-2 | minor | T8, bank-sync `/accounts` at 1280, keyboard: (1) check 3 rows with Space; (2) try to reach Categorize in the selection bar. | <ul><li>Expected: the bulk action is near the selection, or one stop away.</li><li>Observed: the bar comes before the table in DOM order, so reaching it takes 31 Shift+Tabs from the last checked row, and the count grows with list position.</li><li>Impact: keyboard bulk categorizing works but is slow. Pointer users are unaffected because the bar is sticky.</li></ul> | `M/m6-select-keyboard-1280/log.txt` |
| r2-opus-3 | minor | T2/T10, bank-sync `/bank` at 320 touch: (1) confirm Savings's starting balance; (2) scroll to the end of the page. | <ul><li>Expected: content can scroll clear of a pinned message.</li><li>Observed: "Savings's starting balance is confirmed. Categorize its Transactions / Dismiss" stays pinned above the tab bar for at least 15 s (114 px of a 575 px content area). At the bottom of the page it covers the last card's Reconnect and Sync now: `elementFromPoint` at Sync now's centre returns Dismiss.</li><li>Impact: the last card's controls can't be reached until the user dismisses the message. Keeping the message is reasonable because it carries the next step; the missing bottom inset is the problem.</li></ul> | `M/m3b-toast/02-toast-bottom.png`, `log.txt` |
| r2-opus-4 | minor | T1, empty-budget `/settings`: type 2026-11-20 (six days after today) and Save. | <ul><li>Expected: the same caution that later moves now give, that bank transactions for the coming days won't come in.</li><li>Observed: it saves as "Budge starts on Nov 20, 2026." with only the generic description. The opus-5 fix (`9036e26`) covers later moves only.</li><li>Impact: a user who picks "next month" silently loses the days in between. They can recover with Change.</li></ul> | `M/m1b-future/02-first-future-saved.png`, `log.txt` |
| r2-opus-5 | nit | Long content at 320 touch: add a Cash Account with balance 1,234,567.89, then reload its register. | <ul><li>Observed: Reconcile ends at 321 px and the document is 321 px wide, so there is a 1 px sideways scroll. Five- and six-figure balances are fine.</li></ul> | `M/m8b-long-phone/log.txt`, `M/m8-g3-long/03-long-account-320.png` |
| r2-opus-6 | nit | `transactions/select-categorize`, judge2-opus-1. | <ul><li>Observed: the final layout guard reported a Category chevron moving 9 px (833→824) after a held bulk save landed. It happened in 1 of 3 runs, and the 2 reruns passed.</li><li>Impact: negligible for users, but the journey is intermittently red.</li></ul> | `E/judge2-opus-1/transactions/select-categorize/trace.zip`; `E/judge2-opus-2`, `E/judge2-opus-3` |
| r2-opus-7 | nit | T2, Checking actions → Starting balance (unconfirmed). | <ul><li>Observed: under the empty field, "Now $2,418.37" sits next to a header Balance of $8,165.49. "Now" could be read as today's balance rather than the recorded starting balance.</li><li>A wording like "Recorded now: $2,418.37" would match the picker's "Remembered now: Rent."</li></ul> | `M/m2c-checking-keyboard/01-checking-starting.png` |

### Round-1 re-checks

| Round-1 finding | Re-check result | Evidence |
| --- | --- | --- |
| opus-1 | Fixed. Every dialog closed in T1–T10 returned focus to a named control, never `<body>`, by keyboard and touch. | `M/m2*`, `m3*`, `m4*`, `m5*`, `m9b` |
| opus-2 | Fixed. The note is muted and not counted. | `M/m3-bank-phone-*` |
| opus-3 | Fixed. The empty field has no placeholder and the error message appears at the field. | `M/m2-bank-keyboard`, `M/m3-bank-phone-320` |
| opus-4 | Fixed (G5). | `M/m6-select-keyboard-1280` |
| opus-5 | Fixed for moves. The first-set case remains as r2-opus-4. | `M/m4-later-*`, `M/m1b-future` |
| opus-6 | Fixed. Cold loads recorded 0 shifts. | `M/m8-g3-long/log.txt` |
| opus-7 | Answered. The order matches. | `M/m4-later-keyboard-1280` |
| opus-8 | Fixed. `settings/later-move` passes with the singular wording. | `E/judge2-opus-1/settings/later-move` |
| opus-9 | Answered. Still 145 px; acceptable. | `M/m6-select-touch-320/log.txt` |
| opus-10 | Fixed. 44 px hit area on touch. | `M/m7b-details-target/log.txt` |

## Rubric

| Rubric dimension | Score /10 or unverified | Observation supporting judgment |
| --- | --- | --- |
| Task completion and trust | 9 | <ul><li>Every task completed and persisted after reload.</li><li>Money deltas for income, Cash Transfer, card payment, Starting balance and later move or Undo all reconcile.</li><li>Correction keeps the history honest. The G3 message is truthful.</li></ul> |
| Discoverability and language | 9 | <ul><li>The next step is offered at each decision: Categorize its Transactions, Set up, Undo move.</li><li>Copy uses glossary terms.</li><li>Minor wording ambiguity: "Now $X" (r2-opus-7). The first-set future date has no caution (r2-opus-4).</li></ul> |
| Efficiency and control | 8 | <ul><li>Scope is visible, opt-ins are deliberate, and Undo restores with good focus.</li><li>Keyboard reach to the bulk picker (r2-opus-2) and the hidden row Undo during a selection (r2-opus-1) add friction to the T8 loop.</li></ul> |
| Feedback and recovery | 9 | <ul><li>Zero, held, matched and failed sync results are each distinct and truthful. Busy keeps focus.</li><li>Refusals explain why (future date, nothing on or after the cutover).</li><li>Deduction: r2-opus-1.</li></ul> |
| Accessibility and input | 9 | <ul><li>Every task completed by keyboard, with visible rings and focus returned to a named control after every dialog.</li><li>Touch targets are 44 px (Details via `::after`).</li><li>The keyboard path to the bulk bar is long (r2-opus-2).</li></ul> |
| Responsive layout and visual clarity | 9 | <ul><li>320, 390 and dark are clean. No load shifts on cold loads.</li><li>Dialog footers and opt-ins are clear of the tab bar.</li><li>Pinned confirmation occlusion (r2-opus-3) and a 1 px seven-figure overflow (r2-opus-5).</li></ul> |

- **Overall score:** 9/10.
  - The first-use flows are clear, trustworthy and recoverable at 1280 and 320, by pointer, touch and keyboard.
  - Every round-1 major is fixed, and focus return is now consistent across every dialog I closed.
  - What remains is four localized minors, each with an obvious path to completion (Clear, Shift+Tab, Dismiss, Change), and three nits. None misleads about money or blocks a task.
  - This is a judgment, not an average of the dimension scores.
- **Unverified tasks, external behavior and blockers:**
  - G1: real Plaid Connect, Link, reconnect, actual bank suggestions and real post-move sync are unverified, by environment.
  - G2 production-seam states are unverified: a stored sync failure surviving reload, stale or unsafe Undo-move refusal, and blocked repairs needing an unlock. A browser-faked failure is not stored, so after reload only freshness shows.
  - All slow-network observations used held answers, not a throttled network.
  - G8 was observed in dev serving mode only.
  - No blockers.
- **Verdict:** **approve**. Required coverage is complete: every task at 1280 pointer, every task at 320 touch, and keyboard completion. The score is 9/10, and there is no open blocker or major. Minors r2-opus-1 to r2-opus-4 are recommended follow-ups.
- **Cleanup, ownership release and evidence retained:**
  - `bun run app down` printed "app: down." and exited 0. `doctor` then confirmed that the backend on 3214 and Vite on 5175 no longer answer, so the ports are released.
  - The worktree is still clean: `git status --porcelain` is empty.
  - Evidence is retained and nonempty:
    - `/home/lomzem/proj/budge-judge2-opus/test-results/verify-budge/judge2-opus-1` (369 files)
    - `/home/lomzem/proj/budge-judge2-opus/test-results/verify-budge/judge2-opus-2` (22)
    - `/home/lomzem/proj/budge-judge2-opus/test-results/verify-budge/judge2-opus-3` (22)
    - `/home/lomzem/proj/budge-judge2-opus/test-results/verify-budge/judge2-opus-manual` (249)
    - scripts and this report in `/home/lomzem/proj/budge-judge2-opus/test-results/ui-review/`
  - The worktree is left in place.
