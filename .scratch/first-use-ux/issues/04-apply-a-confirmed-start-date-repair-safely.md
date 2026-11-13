# 04: Apply a confirmed start-date repair safely

**Status:** done

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 03 — consume a reviewable repair proposal.

Deliver: a user can confirm the previewed change and get consistent Transactions, Starting Balances, and budget totals. Reject a stale preview rather than applying unreviewed effects. Interruptions/retries must not duplicate work; preserve Transfer integrity and respect reconciliation rules. Provide and verify a recovery path. Another sync must not reintroduce excluded history. Inspect the actual user's setup and prepare its November repair, but do not execute a live repair without approval of the concrete preview and recovery plan.

Proof: the repair owner is primary for before/after persistent accounting state, stale-preview rejection, and repeat/interruption safety using synthetic data. Reuse monthly-cache consistency proof rather than duplicate its implementation. Add one distinct sync-boundary regression for excluded history only if current sync proof does not cover the changed boundary. A browser journey proves preview-to-confirm completion and recovery access, not every accounting permutation. Actual account correctness requires checking actual inputs separately; fixture tests cannot certify it.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Decisions from ticket 03 review

Owner decisions recorded 2026-11-13 from the ticket 03 review. They bind this ticket's apply step.

- **Recompute, then compare.** Applying recomputes the proposal inside the same mutation, with the read limits in `LATER_CUTOVER_READS` (`convex/lib/laterCutover.ts`). It then compares the recomputed fingerprint with the one the user confirmed. A mismatch rejects the apply and changes nothing, so the user previews again. The fingerprint is a SHA-256 of the ready preview's canonical form, with object keys sorted and every list sorted as a set. Any change to what the preview shows changes it; a presentation-only reorder does not.
- **Server time, not the client's `today`.** The mutation validates the date against server time under a defined time-zone policy, not against the `today` argument the preview query takes from the client. Write the policy down here before implementing it.
- **Explicit unlock for reconciled history.** Replacing a reconciled Starting Balance, or folding reconciled Transactions, requires an explicit unlock from the user. Without it, the apply refuses.
- **Bank-feed confirmations become unconfirmed after the move.** This is already the ticket-02 rule, verified 2026-11-13:
  - `confirmStartingBalance` keys `connectionAccounts.startingBalanceConfirmedFor` to the cutover date.
  - `isStartingBalanceConfirmed` (`convex/lib/accounts.ts`) compares that key with the current cutover date, so moving the date unconfirms every feed.
  - The owner test is `convex/heldAccounts.test.ts`: "a confirmed starting balance is unconfirmed again once the cutover date changes, until the owner sets it for the new date".
  - Apply must not re-confirm feeds itself.
- **The new Starting Balance's state.** It is cleared, approved and unreconciled. `saveStartingBalance` already writes `cleared: 'cleared'` and `approved: true`.
- **Uncleared rows.** The preview must state that folding uncleared rows changes the cleared balance. Today's caution reads "… that haven't cleared count in the Starting Balance as if they had". Keep that caution, and name the cleared-balance change it causes.

### Time-zone policy for the apply (recorded 2026-11-13, before implementing it)

Budge stores no time zone: the owner's day is the browser's local date, as for every other date the app proposes. The apply therefore takes the browser's `today`, but trusts it only as far as server time allows:

- `today` must be a real date, and it must be the calendar date somewhere on Earth at the server's clock when the mutation runs: from the UTC date at `Date.now()` − 12 hours to the UTC date at `Date.now()` + 14 hours (UTC−12 to UTC+14). Any other `today` refuses with a message that the device's date looks wrong, and changes nothing.
- The new cutover date must be on or before that `today` (the preview's `notYet` rule). So no device clock can start a budget on a day that has not begun anywhere.
- The recomputed preview uses the same validated `today`, so its fingerprint matches the one the owner reviewed when nothing else changed. A device whose date rolls over between preview and confirm sees the preview change, which is the stale-preview path.

### Landed 2026-11-13 (commits dc02b22..HEAD on `feat/first-use-ux`)

**Decisions**

- **One atomic mutation.** `settings.applyLaterCutover` recomputes the preview with `LATER_CUTOVER_READS` and compares fingerprints. It then folds the history, writes Starting Balances through `saveStartingBalance`, removes earlier Assigned amounts, and moves the date, all in one transaction. A stale fingerprint, an unsupported or blocked preview, Reconciled history without `unlockReconciled`, and a device date outside the recorded time-zone policy each refuse and change nothing. Owned writes go through `convex/lib/transactions.ts` (`removeEarlierHistory`, `restoreEarlierHistory`) and `convex/lib/monthlyTotals.ts`.
- **Measured bounds.** The bounds were measured, not chosen. At 500 Transactions the apply passed 4,096 index ranges, because every delete and patch counts as one. The bounds are now:
  - 250 Transactions, 250 bank rows and 250 split lines;
  - a new bound of 500 earlier Assigned amounts, which the apply deletes.

  `capacity:check` now runs two worst-case shapes through preview, apply and undo.

  | Call | Index ranges | Documents read |
  | --- | --- | --- |
  | Apply | 2,641 of 4,096 | 15,575 of 32,000 |
  | Undo | 2,335 | |
  | Preview | 711 | 12,899 |

  A bigger history is refused before the preview with the limit named. A batched apply was rejected because it would give up atomicity and the stale check.
- **Retry.** A repeat with the same date and fingerprint returns the same move and writes nothing, because the last move (`cutoverMoves`) records both.
- **Transfers.** `removeEarlierHistory` refuses to fold one side of a Transfer, and the preview already blocks a Transfer that straddles the date.
- **Recovery.** `settings.undoLaterCutover` undoes the last move, until the date moves again. Settings offers it as `Undo move`.
  - It restores the date, the folded Transactions (with new ids), their split lines, Transfer links, Bank Row links and matched flags, the earlier Starting Balances in their prior state, the earlier Assigned amounts, and the monthly totals.
  - It refuses, changing nothing, when a new Starting Balance has changed or been reconciled, a Category it needs has been deleted, a Bank Row has been matched again, amounts have been assigned before the month, or the date has moved again.
  - It cannot restore the old Transaction ids. Bank-feed confirmations stay unconfirmed, by design.
- **Sync boundary: no new regression.** Folded bank rows stay as bank memory through the same `keepAsBankMemory` path a Transaction delete uses. Imports and syncs refuse rows dated before the cutover (`convex/lib/imports.ts`, owner test `imports.test.ts` "a date before the cutover"). The existing delete and bank-row tests cover the dedup against kept rows. The apply changes only the cutover value those checks read, so a separate regression would duplicate them.
- **UI.**
  - The preview ends in `Move start date`. When Reconciled history is in the preview, the button stays disabled until the user checks "Unlock the Reconciled history".
  - The uncleared caution now names the cleared-balance change.
  - After a move, the Cutover date row reads `Starts on <date>, moved from <date>.` with `Undo move` beside `Change`. The button's description names what it puts back.
  - The undo shares the date row, so neither the move nor the undo pushes the sections below. The undo result is announced in a screen-reader-only status line.

**Changed files**

- Server:
  - `convex/settings.ts`, `convex/schema.ts` (`cutoverMoves`, `cutoverMoveHistory`);
  - `convex/lib/laterCutover.ts`, `convex/lib/transactions.ts`, `convex/lib/monthlyTotals.ts`, `convex/lib/accounts.ts`.
- Tests:
  - `convex/settings.test.ts`, `convex/owner.test.ts`, `convex/export.test.ts`;
  - `eslint.config.js`, `eslint/rules/owned-writes-config.test.js`.
- Capacity: `scripts/capacity/{harness.js,run.js,README.md}`.
- UI: `src/lib/components/settings/{cutover-date,later-cutover-dialog,later-cutover-preview}.svelte` and `src/routes/(app)/settings/+page.svelte`.
- Journeys: `e2e/journeys/{settings,export}.ts`.
- Feature map: `.agents/skills/verify-budge/features/settings.md`.

**Tests, with contract and red/green evidence.** Each refusal and guard was shown red by disabling only that guard, then green.

- "folds the earlier history into Starting Balances on the new date and leaves the budget the preview showed". It reuses the monthly-cache proof: the kept totals equal `monthlyTotals.rebuild`.
  - Red, with the fold-totals guard off: `[['Checking', 28000], …]` instead of `[['Checking', 62500], …]`.
- `refuses $refusal and changes nothing`: a stale preview, Reconciled history without the unlock, and a device date that isn't today anywhere. Each case compares every table before and after.
  - Red for each case: the call did not throw, so `toMatch` received undefined.
- "confirming the same preview again, as a retry does, changes nothing more".
  - Red: the second call failed with "Pick a date after the current cutover date."
- "undoing the move puts back the history, Starting Balances and assignments it replaced, once".
  - Red, with the Transfer relink off: the restored state differed from the seeded state.
- "will not undo the move over a Starting Balance changed since, and changes nothing".
  - Red: the call did not throw.
- Unsupported preview case "amounts assigned in the months before the new date".
  - Red: "expected an unsupported preview, got ready".
- Journey `settings/later-move` covers the preview-to-confirm path, the unlock by keyboard, Undo move by keyboard, reload, and a 320 px phone. It failed under the production build with "The page shifted without user input" (Theme moved 270→374 px when the separate undo row appeared). The fix moved the undo into the date row, and the journey now passes. The guard's root cause was content appearing in a new row after an asynchronous mutation; the status line was the same pattern and is now screen-reader-only.
- Generated tests ran red first for the new public functions and tables:
  - `owner.test.ts`, the public-function guard;
  - `export.test.ts`, the table list;
  - `featureMap.test.ts`;
  - `owned-writes-config.test.js`.

**Checks**

- `bun run check` at e3d8036 in a separate worktree: exit 0, 58 files and 885 tests. `capacity:check` passed, including the cutover shapes, in 106.6 s.
- Capacity evidence, copied to the main checkout: `test-results/capacity/2026-11-13T19-30-56.296Z` (3 runs per shape) and `…T19-42-38.397Z`.
- `bun run test:e2e:local`:
  - Run 1: 3 failures. `export/files` lacked the new tables, `later-start`'s Escape closed the form under the opening dialog, and `later-move` shifted. All three were fixed.
  - Run 2: 48 passed, 1 failed (the later-move shift).
  - Run 3, after the in-row undo: 45 passed, 4 failed.
    - `shell/phone-pages`: Settings at 390 px shifted 44 px. c3cf29a had made the Cutover date section show `Loading…` until the last move arrived, and at 390 px the loaded row wraps to two lines. The Settings card now waits for the last move as well as the settings, so the section mounts with both and paints its loaded height first.
    - `later-start`: the 320 px step counted the preview's lists before the preview had loaded. That race came from ticket 03; the step now waits for the first list.
    - `bank-changes/take-the-banks` and `transfers/import-link`: register and import-preview shifts in code this ticket does not touch. Both passed on rerun (`t04-ui-10`).
  - Run 4 did not start: `convex dev` found its port taken (`Requested port 39216 is not available`).
  - Run 5, at 31810a7's content: 49 passed in 8.9 min.
- `bun run check` at 31810a7's content, in the worktree: exit 0. 58 test files and 885 tests passed, and `capacity:check` passed (cutover shapes included) in 105.0 s (`test-results/capacity/2026-11-13T20-37-12.745Z`).

**verify-budge evidence** (`bun run app verify … --run <name>` in a separate worktree, copied to `test-results/verify-budge/` in the main checkout before the worktree was removed):

- `t04-ui-6`: later-start, later-move, settings/cutover and export/files pass.
- `t04-ui-8`: later-move, later-start and settings/cutover pass after the shift fix. The screenshots show the row at 1280 px (53 px to spare) and at 320 px.
- `t04-ui-10`: later-move, later-start, settings/cutover, shell/phone-pages, bank-changes/take-the-banks and transfers/import-link pass after the Settings card gate and the later-start wait.

**Not done here: the real owner's November repair.** Nothing ran against production or real data. To prepare it, someone with approval would need:

1. A read-only export of the owner's deployment: settings, Accounts, Transactions before 2026-11-01, split lines, bank rows, `connectionAccounts`, and Assigned amounts.
2. Its counts against `LATER_CUTOVER_READS`.
3. The preview for 2026-11-01, run against that state (or an imported copy on a throwaway local backend), and its blocked items resolved.
4. Approval of that concrete preview and of the undo scope above, before any confirm on the live deployment.

**Deferred or open**

- Ticket 03's limit list (500 and 1,000) is historical. The live bounds are in `laterCutover.ts` and `scripts/capacity/README.md`.
- An AGENTS.md enforced-rules row for "the later cutover bounds fit one atomic apply and undo (`bun run capacity:check`)" is not added. Adding it needs the writing-for-agents pass.
- At 320 px, the tab bar's "Categories" label shifted once in development after a resize. It was not reproduced in production runs.
- On a phone, saving a later date already wraps the form to two lines, and the moved row wraps the same way. No journey moves the date at phone width.

**Cleanup.** The worktree's app was stopped with `bun run app down`, and the worktree and the kept E2E temp directories were removed. No app process from this ticket is running.

### Review fixes 2026-11-13 (commits 45d0a9f..5e8d2c9 on `feat/first-use-ux`)

These commits answer the review in `.scratch/first-use-ux/reviews/04/review.md` and the owner's six decisions. Evidence logs are in `.scratch/first-use-ux/reviews/04/fix-evidence/`. Browser evidence is in the main checkout's gitignored `test-results/`.

**Findings and their fixes**

1. **P1: Undo overwrote later changes to a Starting Balance. Fixed in 45d0a9f.** The move now records each new Starting Balance's full post-move state. Undo refuses, changing nothing, when any field it would overwrite has changed since the move, or when the row was deleted. Tests cover each of these changes: Payee, Category and memo, amount, Cleared state, approval, and deletion. Reconciling the row was already refused. Undo still works after unrelated later edits.
   - Red: `p1-red.log`, with 6 settings tests failing. `repro-red.log` is the reviewer's probe, with 5 of 13 failing.
   - Green: `p1-green.log`, then `p1-p2-green.log` (157 passed across the owner and sibling suites).
2. **P2: Sync dropped bank modifications to folded rows. Fixed in 45d0a9f.** While a move can still be undone, a bank modification to a folded Bank Row is kept on the row, not consumed. After Undo, the restored Transaction shows it as a bank change. A modification that moves the row before the new cutover stops the move from being undone. The regression runs move, then sync through `internal.bankConnections.apply`, then Undo (`convex/bankConnections.test.ts`).
   - Red: `p2-red.log`, with 3 bankChanges tests failing.
   - Green: `p1-p2-green.log`.
   - The capacity seed broke on this guard at 45d0a9f (`capacity-45d0a9f.log`), because it attached bank rows that were already removed. ab73619 seeds only linked rows, which is the shape a fold can meet. It now passes (`capacity-linked-bank-rows.log`). Undo uses at most 2,335 of 4,096 index ranges.
3. **Layout-shift attribution. Fixed in 539824f, 93bba43, 3091461 and fe03b0a.** No guard was turned off, and no wait was added.
   - 539824f: the register no longer blanks when an Account or Payee query changes. Its pages now resubscribe only when their arguments' values change, through `src/lib/paginatedQuery.svelte.ts`.
   - 93bba43: a closing Transaction dialog keeps showing the bank change it acted on, so the banner no longer collapses.
   - fe03b0a: `e2e/journeys/layoutShift.ts` credits a shift to a request that the user's input sent, until 500 ms after its result is on screen:
     - a Mutation, once the page has synced through its commit;
     - an Action, once it responds;
     - a new query subscription, once its first result arrives.

     Shifts during background updates and page loads with no input still fail.
   - Red: `layout-shift-red.log`. This is the reviewer's `latency-journeys.ts` (`latency-journeys.ts.txt`), with an 800 ms delay.
   - Green: `layout-shift-green.log`.
   - Negative controls: `layout-shift-negative-controls.log` (script `latency-negative.ts.txt`). With 800 ms latency, both controls still fail the guard: a change made from another tab, and an insert injected while no request is pending.
4. **Import dialog readiness. Fixed in adff400 and 3091461.**
   - adff400: the File field stays disabled until the cutover date has loaded. "Set the cutover date before importing" shows only when settings say there is no cutover date. `imports/approve` withholds `settings:get` and expects the field to be disabled meanwhile. That expectation went red against the old dialog (`t04-fix-import-red-withheld`).
   - 3091461: journeys pick a file through `chooseBankFile`, which waits until the field accepts one.
5. **AGENTS.md enforced-rules row. Added in 582580b.** The row names `LATER_CUTOVER_READS` and `bun run capacity:check`, which runs in `bun run check` and in CI's Import capacity contract step.
6. **Phone move and Undo. Added in 5e8d2c9.** `settings/later-move` now confirms the move and undoes it at 320 and 390 px. It reaches Settings through the tab bar and checks `expectClearOf` (tab bar and dialog bar) and `expectNothingPastTheRightEdge`. The feature map entry is updated. Evidence: `later-move-phone.log`, `test-results/verify-budge/t04-later-move-phone-{a,b}`.

**Checks**

- `bun run check` with P1 and P2: 58 files and 898 tests passed (`check-p1p2.log`). It passed again before every later commit, through the pre-commit and pre-push hooks.
- `bun run app verify` on the 24 journeys these changes touch: all passed (`test-results/verify-budge/t04-fix-layout`).
- `bun run test:e2e:local` at 5e8d2c9: 49 passed in 8.4 min, exit 0.
- `capacity:check` in a temporary worktree at the final commit: passed, including both cutover shapes (`capacity-final.log`, `test-results/capacity/2026-11-13T22-02-51.268Z`). Apply used at most 2,641 index ranges and Undo at most 2,335, both of 4,096.
- `clock-envelope-mutant.log`: the device-date envelope in `laterCutover.ts` was widened by one hour on each side. The two just-outside cases of the "somewhere on Earth" tests then failed, and they pass on the real code.

**Deferred, with reasons**

- **Development-only font race.** On a dev-server full load, the Atkinson font can arrive inside its `font-display: optional` block period. When it does, the bold tab labels narrow (Categories went from 69 to 62 px) and the guard reports the shift. Production-build runs have not shown it. The phone step navigates with the tab bar as a phone user would, so it never reloads. The two first `later-move-phone` runs show the race (`later-move-phone.log`). This replaces the earlier "Categories label shifted once in development" entry.
- **No permanent register-blanking test.** Blanking shows only under response latency. The latency harness runs prove the fix. A permanent latency run would add a slow journey to the suite for this one regression.
- **Optional lint restriction.** A rule could make code import `usePaginatedQuery` only through `$lib/paginatedQuery.svelte`. It was not added, because the wrapper has one caller today.
- **Navigation-load attribution.** Under slow responses, a page load that a navigation click started within 500 ms is exempt until its first result arrives. At normal latency nothing changes, and loads with no input still fail. The owner should confirm this is acceptable.
- **Positive missing-date message.** "Set the cutover date before importing" cannot appear through the UI, because the app routes a budget with no cutover date to setup before the import dialog can open. No journey shows it.
- **Resolved earlier deferrals.** The AGENTS.md row (item 5) and the phone-width move (item 6) are now done.

**Cleanup.** The verify worktree's app was stopped with `bun run app down`, its evidence was copied to the main checkout, and the worktree was removed. The capacity worktree stopped its app and removed itself. No app process from this fix is running.
