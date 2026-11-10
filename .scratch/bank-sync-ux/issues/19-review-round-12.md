# 19 — Review round 12: approved

Status: done

Round 12 scored 9 (sol-a12), 9 (sol-b12) and 9 (opus12). Every reviewer is at 9 or above, so the review loop is finished. None of them found a blocker or a major problem.

## Done after approval

- Bank card:
  - A failed Sync now or Reconnect keeps the freshness after its error: `Bank sync isn't set up on this server. Last successful sync 3 hours ago.` (opus12 #2). The failure no longer hides how stale the data is.
  - A paused card with no Account and no held bank Accounts adds `Reconnect to see its accounts and choose where they go.` (opus12 #1).

## Deferred

These are minor findings and nits that every reviewer still scored 9 with. Each is a follow-up, not part of this change.

- At 320 px, Budget has no Assigned column. Assigning goes through the inspector, with no cue on the row (sol-a12). Every reviewer called this a reasonable trade-off.
- At 320 px, Approve sits beside the merchant name, which then wraps to three lines (sol-b12 #1).
- On short phones, the held bank Account dialog's new-Account fields start below its choices (sol-b12 #2).
- The Needs-you chip row has no explicit "more" cue at 320 px (sol-b12 #3, opus12 N7).
- Importing into a bank-fed Account doesn't warn about possible duplicates (opus12 #3). This needs a matcher decision, so it belongs in its own ticket.
- Nits from opus12: the Ready to Assign card's edge, the Import dialog's width, the Cover button wrapping, the phone date format, the Payee filter's scope, and search dropping its section headings.

## Verification

- These pass: `bun run lint`, `lint:ui`, `typecheck` and `format:check`.
- The `plaid/*` journeys pass (7 of 7).
  - `plaid/late-sync` now asserts that the freshness follows a failed result. Its first run caught the two sentences running together without a space, which is now fixed.
  - `plaid/attention` asserts the paused card's reconnect sentence.
- The plaid feature map is updated.
