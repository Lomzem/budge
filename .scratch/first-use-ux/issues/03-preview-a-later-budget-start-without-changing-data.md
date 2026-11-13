# 03: Preview a later budget start without changing data

**Status:** landed — review pending

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 02 — use its Account/balance evidence in the repair preview.

Deliver: for an existing September-start budget, selecting November produces a read-only preview of the affected Transactions, proposed Starting Balances, budget effects, and what must be resolved before it can proceed. Cancel changes nothing. Do not assume the demo seed caused the user's problem. Unsupported or unverifiable cases produce a specific explanation rather than guessed balances. No pre-start archive feature is required.

Proof: the preview owner, exercised through its real public boundary with synthetic persisted Accounts/Transactions, proves independently expected effects and unchanged state. The browser journey proves date entry, readable preview, and cancel behavior without duplicating the numerical case matrix. This ticket is independently demoable as a read-only assessment.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Implementation (Opus 5.5, 2026-11-13)

Commits: `e65ea5c` (server preview and owner tests), `894c037` (a future date with nothing before it is a plain move), `7353fe7` (dialog, journeys, feature map), `0c70d15` (phone layout fix found by verify-budge), and this record.

**Decisions**

- One owner: `previewLaterCutover` in `convex/lib/laterCutover.ts`, behind the public query `settings.previewLaterCutover({cutoverDate, today})`. It is a query, so it cannot write. `today` is an argument because a query cannot read the clock.
- The result is one of four kinds:
  - `unsupported`, with a reason and a specific message: no cutover date yet; not later than the current date; a date after today; more than 500 earlier Transactions (`LATER_CUTOVER_LIMIT`). Large histories are refused rather than half-previewed.
  - `nothingBefore`: no Transaction is dated before the new date. It wins over "after today", so a future plain move, which `setCutoverDate` always allowed, still works.
  - `blocked`, with `mustResolve`:
    - a pending Bank Change;
    - a Transfer whose other side falls across the new date or is missing;
    - an Account whose Starting Balance is dated after the new date.
    An Account touched by a blocker gets `proposedStartingBalance: null`. No guessed balance is shown.
  - `ready`, with a `budget` and a `fingerprint`.
- Each Account lists its folded Transactions, including split lines, plus its current Starting Balance and the proposed one.
- `cautions` don't block. They cover:
  - reconciled rows that fold in;
  - uncleared rows that count as if cleared;
  - rows from a bank Account that now feeds another Account. Their history stays in the Account where it is now, so a remap isn't a blocker.
- The budget effect is the new month seen before and after. "Before" is the current budget at the new first month. "After" rebuilds the totals from the projected Transactions, with the proposed Starting Balances in Ready to Assign. It lists Ready to Assign and only the Categories that change, plus the assigned money in earlier months that goes. `readBudgetInput` moved to `convex/lib/budget.ts` so the query and the preview share it.
- Ticket 04's apply should compare the `fingerprint` (a hash of the cutover date and the folded rows) and refuse a stale preview. A Transaction dated after the new date does not change it.
- UI: saving a later date in Settings opens "Start on {date}?" instead of saving.
  - It has Cancel and Escape, and has no Apply.
  - A `nothingBefore` result offers "Move start date" through the existing `setCutoverDate`, so this ticket adds no write path.
  - Closing returns focus to the date field, which keeps the draft.
  - Async work goes through `DialogSession.run`.
  - On a phone, the budget table puts "Now" under each name and keeps "After" as a column.
- The old E2E step "refused past a Starting Balance" is gone from `settings/cutover`. That refusal is still owned by `convex/transactions.test.ts`.

**Changed files:** `convex/{settings,budget,settings.test,owner.test}.ts`, `convex/lib/{laterCutover,budget}.ts` (new), `convex/lib/monthlyTotals.ts` (exports `Counted`, `keyOf`), `convex/_generated/api.d.ts`, `src/lib/components/settings/{cutover-date,later-cutover-dialog,later-cutover-preview}.svelte` (dialog and preview are new), `e2e/journeys/settings.ts`, `.agents/skills/verify-budge/features/settings.md`.

**Tests** (`convex/settings.test.ts`, through the public query as the owner, with synthetic persisted rows and hand-worked values)

- "folds each Account's earlier Transactions … and changes nothing".
  - Contract: the proposed Starting Balances and the folded rows, including a split. The before/after budget for Ready to Assign and the changed Categories. Persisted tables are unchanged.
  - Red: `red-preview.txt`, where the query was missing.
- "names what must be resolved first …".
  - Contract: a Bank Change and a straddling Transfer are named, and the touched Accounts get no balance.
  - Red: `red-preview.txt`.
- "counts a Starting Balance dated after the new date as something to resolve".
  - Red by mutation (`red-sblater.txt`): with the check removed, the preview came back ready.
- `test.each` for notLater/notYet, plus "no cutover date yet" and "names its limit".
  - Contract: a specific reason and message, with no balances.
  - Red by mutation (`red-unsupported.txt`): 5 failed.
- `test.each` nothingBefore for 2026-11-01 and 2026-12-01 ("even after today").
  - True red (`red-future-nothing.txt`): 12-01 came back `unsupported`. Fixed in `894c037`.
- "says when a bank Account now feeds another Account …" and "identifies the history it folds: a change there gives another fingerprint, a later one does not".
  - Red by mutation (`red-ready.txt`).
- `owner.test.ts` registers the query in the owner gate.
- Journeys:
  - `settings/later-start` (budget-with-accounts): date entry, a readable preview (per-Account regions, basis text, the Transactions disclosure, the budget table and the carry-over note, no Apply), Cancel and Escape returning focus and keeping the saved date across reload, and the after-today message. It asserts no arithmetic.
  - `settings/cutover` now ends by moving through a `nothingBefore` preview.
  - Red: `red-journeys.txt` (2 failed without the UI). Green: `green-journeys.txt` (3 passed).
- The red/green files are in the session scratchpad (`/tmp/claude-1000/-home-lomzem-proj-budge/35d35561-c3a7-4b79-a12a-2870181ceaa7/scratchpad/`).

**Checks**

- `bun run check` in the main checkout, at `7353fe7` and again at `0c70d15`: codegen, format, lint, lint:ui, typecheck and vitest (58 files, 872 tests) passed. `capacity:check` refuses there because `.env.local` is not anonymous.
- `bun run capacity:check` in the worktree, with `0c70d15`'s files: passed (`maxFileRows` 250).
- `bun run test:e2e:local -g "settings/"`: 3 passed.
- Full `bun run test:e2e:local` at `0c70d15`: 48 passed.

**verify-budge** (worktree runs copied into the main checkout, gitignored)

- `test-results/verify-budge/first-use-03/` at `7353fe7`: `settings/later-start`, `cutover` and `start` passed.
- `test-results/verify-budge/first-use-03b/`, with `0c70d15`'s files (uncommitted in the worktree): `settings/later-start` and `cutover` passed.
- `test-results/verify-budge/first-use-03-manual/`: PNG and ARIA files at 1280×800 and 320×640, with notes and `manual.ts`.
  - `budget-with-accounts`: ready.
  - `bank-sync`: ready, because none of its Bank Changes is on a folded row.
  - `blocked-straddle`: a straddling Transfer, added only to the worktree's anonymous backend by a throwaway mutation that was then deleted.
  - Each run measures content past the dialog body's right edge. At 320 with every disclosure open it was 53px before `0c70d15` and 0px after.
  - Each run records the keyboard order (disclosures, Cancel, Close). Escape returns focus to the date field. The date is unchanged after Escape and reload.

**Not run here (per the brief):** local `code-review`, `/correct`, and the three-judge UI review. All are pending.

**Open questions for ticket 04**

- If the existing Starting Balance is reconciled, may apply replace it?
- `startingBalanceConfirmedFor` is tied to the cutover date. Should apply ask for bank feeds to be confirmed again?
- What cleared state should the new Starting Balance get?
- Mid-scroll, the shared sticky dialog footer hangs 24px below the dialog edge at desktop height. This comes from the shared primitive and was left unchanged.
