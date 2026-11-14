# 09: Show useful Sync results without hiding problems

**Status:** done

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: keep a concise Transactions-added count, including an honest zero result. Keep other diagnostic counts in details. Distinguish a sync with rows waiting for Account setup from a finished import, and preserve busy/failure/reconnect problems. A successful sync does not certify a balance. Use counts from the actual run, not total Transactions or the review backlog.

Proof: extend the existing outcome/report owner with independently defined outcomes: additions, zero additions, held rows, busy/failure as appropriate. Browser proof only for the distinct placement/action path needed to resolve waiting setup. Preserve existing sync integration proof for actual run counts and add a missing case at that owner only if necessary; do not mock a formatter and then claim sync arithmetic was tested.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Landed 2026-11-13 (commits 6394a8f..1efd6f4 on `feat/first-use-ux`, this record in the next commit)

**Decisions**

- **The real defect was on the server.** `syncConnection` already totals `held` for each run, but the public `ownerSync` (behind `syncNow` and `syncAfterReconnect`) dropped it. So a run that only held rows read as `Added 0, Matched 0`. `ownerSyncResult` now carries `held`. All counts come from this run's totals, not from Transactions totals or the review backlog.
- **Copy.** The count stays visible: `1 Transaction added.`, `12 Transactions added.` or `No Transactions added.` (an honest zero). When the run held rows, the result adds `N wait for setup below.` (`1 waits …`), which points at the card's `New bank Accounts` section and its `Set up` buttons. Matches go in muted detail text: `N matched Transactions you entered.` / `1 matched a Transaction you entered.`. The detail shows only when the count is above zero. Reconnect adds a `Reconnected.` prefix. Busy, no-login and error results are unchanged. `Synced.` is gone.
- **Why the waiting wording is short.** The first wording, `2 transactions wait for setup under New bank Accounts below`, was clipped by the card's fixed two-line status slot at 320 px; the journey caught this. The bank-sync spec says status lines keep their slot, so I shortened the text rather than letting the slot grow.
- **No balance certification.** The success check now follows the idle rule, extended to held bank Accounts: no problem, no feed needing the owner, no held bank Account. Otherwise a clock shows. The detail sits in the same muted spot as the freshness text after a failure. The `status` region announces the text plus the detail.
- **Considered, not changed.** A late Sync now result can still replace a newer Stop syncing or Bring back report on the same card. Dropping it instead would hide a sync failure, which this ticket forbids. Sync now stays busy until its own result arrives, and focus never moves, so no newer state gets cleared.

**Changed files**

- Server: `convex/bankConnections.ts` (`held` in `ownerSyncResult`/`ownerSync`).
- UI: `src/lib/bankConnections.svelte.ts` (`Report.detail`, `describeSync`/`describeReconnect`), `src/lib/components/bank/connection-card.svelte`.
- Tests: `convex/plaidWebhook.test.ts`, `src/lib/bankConnections.test.ts`, `e2e/heldResponse.ts` (`answerInsteadOfServer`), `e2e/journeys/plaid.ts` (`plaid/sync-waiting`).
- Map: `.agents/skills/verify-budge/features/plaid.md` (card result copy, the journey, gotcha, Sources).

**Tests (red, then green)**

Evidence is under `test-results/ticket-09/`.

- **Run counts.**
  - Contract: the owner's Sync now answer gives this run's `added`/`matched`/`held`.
  - Regression: `held` dropped, or totals reported instead of this run's counts.
  - Owner: `convex/plaidWebhook.test.ts`. The fake Plaid `fetch` is the real boundary, and its sync page gains rows for an unmapped bank Account. The test runs Sync now twice: the first run gives `{added 2, matched 0, held 3}` (pending and pre-cutover rows excluded); the quiet second run gives all zeros.
  - Existing proof missed it because `convex/bankConnections.test.ts` and `heldAccounts.test.ts` prove the internal totals, while the public action was tested only for busy and noToken.
  - Red: `server-red.txt` (`held` missing). Green: 44/44.
- **Report outcomes.**
  - Owner: the existing `src/lib/bankConnections.test.ts` table, extended. Its expected strings are written by hand from the requirement: additions (1, 12), zero, matched detail, held with zero and with some additions, busy, no-login, and Reconnect variants.
  - Red: `report-red.txt` (9 failed). Green: 13/13.
- **Placement and action path.**
  - Owner: `plaid/sync-waiting`, which answers `bankConnections:syncNow` in the browser and is labelled as standing in for Plaid. The local server has no Plaid credentials, so no real successful sync can reach the browser.
  - It checks at 320, 390 and 1280 px:
    - the status text;
    - the visible line is not clipped;
    - the line is clear of the tab bar;
    - nothing extends past the right edge;
    - Tab from Sync now reaches `Set up <label>`, and Enter opens its dialog.
  - The layout-shift guard ran the whole time.
  - Red against the old card: `t09-journey-red` (`Synced. Added 1, Matched 0.`). Green: `t09-green`.

**Checks**

- `bun run check`: every step passed except capacity (`check.txt`). `capacity:check` refuses in the main checkout, and it passed in a temp worktree (`capacity.txt`, though capacity was not touched).
- Journeys: `t09-green`, 10 passed (plaid status, late-sync, sync-waiting, attention, consent, late-renew, remove, stop-and-bring-back; accounts held-map, held-new-card).
- Full `bun run test:e2e:local`: 55 passed in 8.6 min, exit 0 (`e2e-local.txt`).

**Open questions**

- Modified and removed bank rows still go uncounted in the result (spec note). Should they get a detail?
- With a large Reconnect result plus a matched detail, the detail can still clip at 320 px. The full text stays in `title` and the status region.

### Review fixes 2026-11-13 (commits 4702f1d..84f6efe on `feat/first-use-ux`, this record in the next commit)

The review is [`reviews/09/review.md`](../reviews/09/review.md). The owner's decisions are binding; each item is below.

**1. P2, a late Sync now result replaced newer card feedback: fixed.**

- `connection-card.svelte` keeps a generation counter. Every card operation (Sync now, including the paused refusal; Reconnect and its sync; Stop syncing; Bring back; Remove) advances it and takes over the result line with its own `Syncing…`/`Reconnecting…` text, then its own report. Only the owner publishes, and only the owner of a Bring back moves focus to `Set up`. Remove still drops the card on success, owner or not.
- A superseded failure does not vanish. It joins the card's problem list as `Sync now failed: <message>` (likewise `Reconnect failed:`, `Stop syncing failed:`, `Bring back failed:`, `Remove connection failed:`), until the next operation on the card. Durable connection problems are unchanged. A superseded success is dropped: the server state it reports already shows in the card.
- Nothing is serialized. Sync now's button still reads `Syncing…` until its own answer comes.
- Proof: `plaid/superseded-sync` (`answerInsteadOfServer`, now able to answer or refuse several actions). Sync now is held, Stop syncing completes, the old success is released, and the Stop syncing report and focus on the actions button survive. Then Sync now is held, Bring back completes, the old failure is released, and the Bring back report and `Set up` focus survive with the failure visible in the problem list.
- Red on the old card: `journey-red` fails at step 2 (status `3 Transactions added.` replaced `Stopped syncing …`). Step 4 is unreachable there. Green: `journey-green`.

**2. P2, diagnostic detail clipped at 320 px with no touch access: fixed.**

- The summary (`N Transactions added.`, `N wait for setup below.`, the `Reconnected.` prefix) sits in its own span and stays whole. Matched counts open from an inline `Details` button: a shadcn-svelte Collapsible, added under `src/lib/components/ui/collapsible/`, using the Button `link`/`xs` variant through the trigger's `child` snippet so `lint:ui` stays clean. It opens by tap, click, Enter or Space; the detail shows in muted text below the line, and a new operation closes it. The `status` region still reads text plus detail; `title` stays only as a backstop for long failure messages.
- Layout: measured at 320 px, the worst Reconnect summary plus `Details` takes three lines, so the slot reserves three lines below 640 px and two from there (it keeps its slot whether empty or not, per the bank-sync spec). Between 640 and 1279 px the side-by-side slot was 149–277 px wide, so the buttons now sit beside the line only from 1280 px (`xl:`) and below it otherwise.
- Proof: `plaid/sync-waiting` gains a step at 320 and 390 px. Reconnect runs a fake Plaid Link and is answered with 1000 added, 1 matched and 199 held. The summary is visible, unclipped by any ancestor, and clear of the tab bar and buttons; `Details` starts collapsed, opens by a CDP touch tap, closes by Enter and reopens by Space; the detail is clear of the tab bar and nothing passes the right edge. The layout-shift guard ran throughout.
- Red on the old card: `journey-red` fails at the 320 px step (summary span not found; text and detail shared one clipped span). Green: `journey-green`.
- Found on the way: `page.route` turns off the browser cache, so routing the Plaid Link script before the page loaded refetched a font after first paint and shifted the tab bar's `Categories` label (shift score 2.7e-5, at about 350 ms after load, also present with the old card). The route is now added after the page loads (`fakePlaidLinkOnceTheCachedPageLoaded`) and removed at the step's end.

**3. Changed/removed counts: deferred.** `syncConnection` in `convex/lib/sync.ts` totals only `added`, `matched` and `held`. `applyBankChange` and `applyBankRemoval` in `convex/lib/bankChanges.ts` return nothing and decide internally whether a change is a no-op, followed quietly, flagged `changed`, or removed. Counting applied changes and removals needs new per-row outcomes from those functions, threaded through the apply mutation and its capacity budget, which is new tracking beyond a per-run sum. The result never shows them as additions or as the backlog; the feature map says they are not counted.

**4. Receipt coverage gap: fixed.** In `convex/plaidWebhook.test.ts` the public receipt test became a table over both owner entry points, `syncNow` and `syncAfterReconnect`, with three cases each: a mixed run then a quiet run (`{2,0,3}` then zeros), a run matching a Transaction the owner entered (`{added 1, matched 1, held 0}`), and a held-only run (a fake-Plaid `onlyUnmapped` flag; `{0,0,2}`). The fake Plaid `fetch` stays the boundary. This is existing behavior, so red is by mutation of `ownerSync`'s mapping: matched folded into added fails the 2 matched cases (`server-red-matched.txt`); `held: 0` fails the 4 mixed and held-only cases (`server-red-held.txt`). Green: 49/49 (`server-green.txt`).

The webhook and daily sync intentionally return no receipt: nobody is waiting on them, and their user-visible result is the card's freshness, its problems and the `New bank Accounts` section.

**Checks**

Evidence is under `test-results/ticket-09-fix/`.

- `bun run check` (`check.txt`): codegen, format, lint, `lint:ui`, typecheck and 924 unit tests passed; `capacity:check` refused in the main checkout as before. Not rerun in a worktree: no write, limit or mutation changed.
- Journeys in a temporary worktree (`journeys-affected`): 14 passed, all `plaid/*` (status, late-sync, sync-waiting, superseded-sync, attention, consent, late-renew, remove, stop-and-bring-back) and `accounts/held-*` (map, new-card, unknown-kind, legacy-name, ignore).
- Full `bun run test:e2e:local`: 56 passed in 8.5 min, exit 0 (`e2e-local.txt`).
- Feature map: `.agents/skills/verify-budge/features/plaid.md` (card result line, Details, ownership and late failures, both journeys); `scripts/app/featureMap.test.ts` passes.

**Principles**

- *Separate Before Serializing Shared State*: the card's single result slot was the shared write target. Each operation now owns its turn by generation, and a superseded failure goes to its own channel (the problem list) instead of serializing operations.
- *Fix Root Causes*: the tab-bar shift was traced with layout-shift timestamps to an uncached font refetch caused by the journey's own route, not suppressed or blamed on the card.
- *Prove It Works*: every new assertion was shown red on the old card or by mutation before green.

**Open questions**

- Should a superseded *success* also leave a trace (for example a muted `Sync now finished.`)? It is dropped now, since the card's freshness and sections already reflect it.
- Changed/removed counts (item 3) wait for per-row outcomes from `applyBankChange`/`applyBankRemoval` if the owner wants them.

