# 07: Select Transactions and categorize or approve them together

**Status:** done

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 05, 06 — reuse the picker and deliberate memory behavior.

Deliver: select individual Transactions across Payees and subsets within a Payee. Clearly show the selection/count and affected rows. Apply a Category, approve, or categorize-and-approve; saving a Category alone does not approve. Provide undo that restores the Category/approval state of rows still as the action left them; a row changed since keeps its change, and the Undo offer ends once the person changes a row the action touched. A bulk Category action must not silently change remembered defaults. Do not treat all selected Transactions as one Transfer; exclude or explain unsupported/locked rows before changing anything. Search/filter changes must never silently expand a selection to unseen rows.

Proof: the bulk-write owner is primary for exact persisted selection scope, approval choices, restrictions, memory side effects, and undo. Browser proof covers selecting a noncontiguous subset, filter/selection behavior, using the shared picker, and invoking undo, including a phone path. Extend existing approval/undo proof instead of cloning it. Do not create a production export solely to reach selection internals from tests.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Landed 2026-11-13 (commits 8e9b5c2..6c86b7f on `feat/first-use-ux`)

**Decisions**

- **One owner, two mutations.** `transactions.categorizeMany({ transactionIds, categoryId | null, approve })` runs in one atomic mutation through the existing write owners: `categorizeTransaction` with no `remember` (so a Payee's remembered Category never changes), then `markApproved` only when `approve` is true. A Category alone leaves approval as it was.
  - It returns `{ categoryId, changes: [{ transactionId, previousCategoryId, approvedNow }] }`, listing only rows it changed.
  - `transactions.undoCategorizeMany` takes that record back. It restores a row's Category only while the row still has the bulk Category and is neither a Split nor a Transfer, and unapproves only rows the bulk approved that are still approved and not reconciled. So a row changed since keeps its change (value-based best effort; see the fix-stage Comments below), and the count of rows put back is returned.
  - It refuses the whole call (`INVALID_INPUT`, nothing written) when a Split or Transfer is chosen, and `NOT_FOUND` for a missing Transaction. The UI never sends them: they are left out and named in a note (`1 Split keeps its Category.`).
- **Bound.** `BULK_CATEGORIZE_LIMIT = 250` (`src/lib/domain/bulkCategorize.ts`), enforced at the server on both mutations and shown in the UI (`Categorize at most 250 at once.`). Each Transaction costs about 5 index ranges, 16 documents read and 5 written. At 250 the largest use is 1,456 of 4,096 index ranges (36%) in 0.46 s. At 500 it reaches 66% and 0.9 to 1 s per call. `capacity:check` now runs the bulk contract (categorize-and-approve, then undo) at the limit and fails at 900 on the 4,096 index-range limit.
- **Selection state** lives in `src/lib/components/transactions/selection.svelte.ts` (`SelectionPerScope`), keyed by Transaction ID and cleared whenever the scope (Account plus filters and search) changes. So a search or filter never expands or carries a selection to rows not shown. Ticket 08's groups can call `selection.set(ids, picked)` for a Payee's rows.
- **UI.**
  - Each row's first cell holds a Checkbox `Select <Payee>, <date>`; a selected row has `data-state="selected"`.
  - While anything is selected, the count line becomes a sticky bar: `N selected` with `Clear`, the shared `CategoryPicker` (placeholder `Categorize`, named `Category for N selected Transactions`), no Transfer choices, and an `Approve them too` opt-in in its popover. It also holds `Approve N selected` (`Approve N` below `sm`).
  - The existing Approve button acts on the selection while there is one. That extends the approve/undo path rather than adding a second one.
  - Undo is the existing count-line Undo, generalized to either kind of action, and focuses the first restored row.
  - Scroll padding follows the bar's measured height (`--selection-bar-height`), so focused rows stop below it.
- **The opt-in checkbox** (`remember-choice.svelte`, renamed to `opt-in-choice.svelte`) and the picker's `remember` prop (renamed to `optIn`) are now general, because the bulk picker reuses them for `Approve them too`.
- **No bulk Remember.** Bulk categorize never touches Payee memory, and no bulk Remember is offered. The ticket allows that, and naming the affected Payees fits 08's groups better.

**Changed files**

- Server and contract:
  - `convex/transactions.ts`
  - `src/lib/domain/bulkCategorize.ts` (new)
  - `scripts/capacity/{harness.js,run.js,README.md}`
- UI:
  - `src/lib/components/transactions/{transaction-table.svelte,selection.svelte.ts (new),transaction-dialog.svelte}`
  - `src/lib/components/{category-picker.svelte,opt-in-choice.svelte (renamed)}`
  - `src/lib/components/ui/table/table-variants.ts` (`select` width)
  - `src/app.css`
- Tests:
  - `convex/transactions.test.ts`
  - `convex/owner.test.ts`
  - `e2e/journeys/transactions.ts`
- Map: `.agents/skills/verify-budge/features/transactions.md` (`txn-select`, both journeys, Sources)

**Tests (red, then green)**

Evidence is under `test-results/ticket-07/`.

- **Owner tests**, `convex/transactions.test.ts` "categorizing several Transactions at once" (3 tests). They cover the exact rows changed, approval only on request, unchanged remembered Categories, undo that keeps later Category, Transfer and approval changes, and the refusals with nothing written.
  - Red: 3 failed with no export (`owner-red.txt`). Green: `owner-green.txt`.
  - Five mutation probes each failed a test (`owner-mutations.txt`): the bulk remembers, approves unasked, undo ignores a later change, a Transfer is accepted, no size bound.
  - `convex/owner.test.ts` adds both mutations to the owner-only table.
- **Journeys.**
  - New `transactions/select-categorize`: a noncontiguous subset, search clearing the selection, the shared picker without Transfers, undo with focus, `Approve them too` plus undo, the Split note, and a 320 px phone path that stays clear of the tab bar and the right edge.
  - `transactions/approve-all-undo` gains a last step: `Approve 2 selected` approves only the selected waiting rows, then Undo.
  - Red: both failed at their new steps against the server-only UI (`t07-red`).
  - Green: `t07-green-8` (create, approve-all-undo, select-categorize, approve-phone, categorize, search/phone) and `t07-green-6` (late-save, categorize, categorize-late).
- **Capacity.** Bulk at 100, 250 and 500, three runs each with identical counts (`capacity/bulk*.log`). `capacity:check` green at 250 (`capacity-check.log`, 117 s overall). Red at 900, where it exits 1 with the bulk contract message on 4,096 index ranges (`capacity-check-red-900.log`). At 700 it still passes the full limits (`capacity-check-700.log`).

**Checks**

- The main checkout ran `format:check`, `lint`, `lint:ui`, `typecheck`, `test` (908 passed) and `codegen:check`.
- `capacity:check` ran in the temporary worktree `budge-t07`.
- Each of the three commits was typechecked and unit-tested on its own.
- Full `bun run test:e2e:local` at 6c86b7f: 53 passed in 8.0 min (`e2e-local.log`). The Clerk FAPI retry lines are the known teardown noise.
- The worktree app was stopped with `bun run app down`, and the worktree was removed.

**Open questions**

- Undo fails as a whole if a previous Category was deleted in between (the owner refuses a missing Category). Rare; left as is.
- If rows are checked before a debounced search lands, the selection clears when it lands. That is safe, but it may surprise.
- The select column narrows the phone Payee column, so long Payees wrap more (`SAMPLE STREAMI NG`).
- Transfers are excluded and proven at the owner. No browser step checks a Transfer row, because the fixture's Transfers are not in a waiting subset worth selecting. The Split note covers the UI path.
- The bulk opt-in has an empty hint. 08 may want a hint naming what approval does.

### Fixed after review 2026-11-13 (commits 9edaa25..8b632af, docs in the next commit, on `feat/first-use-ux`)

Review: `.scratch/first-use-ux/reviews/07/review.md`. Evidence is under `test-results/ticket-07-fix/`.

**Dispositions**

- **P2, a late bulk completion clears a newer selection: fixed.**
  - `SelectionPerScope` counts a generation on every `set` and `clear`, and its scope effect now goes through `clear`. `mark()` captures the generation and scope; `owns(mark)` says whether nothing was checked, cleared or rescoped since.
  - Bulk categorize, categorize-and-approve and selected approval capture the mark before the call. After it they reset only their busy state. They clear the selection, set Undo, the result or the error, and take focus only while they still own it. The server write still lands.
  - No general workflow framework was added.
- **P2, a deleted earlier Category blocks the whole Undo: fixed.**
  - `undoCategorizeMany` restores every eligible part in one mutation. A row whose earlier Category is gone keeps the bulk Category, and its approval is still put back. It returns `{ restored, kept }`.
  - The count line names the conflict, for example `3 Transactions put back. 1 kept Dining Out because its earlier Category was deleted.` That text sits in the same aria-live slot as Undo and has no button.
  - After Undo the count line shows `N Transactions put back.` / `N back to Unapproved.` visibly, replacing the hidden announcement.
- **P2, value matching: fixed as decided.**
  - Undo stays value-based best effort, with no revision state. The promise is narrowed: Undo restores rows still as the action left them, and a row changed since keeps its change.
  - The Undo offer ends as soon as the person picks a row's Category, approves, unapproves, edits in the dialog, or resolves a bank change on any row the action touched. Changing an untouched row keeps it.
  - The ticket's Deliver text, the earlier Comment ("a later change wins") and the feature map are corrected.
- **(a) Search clears the selection:** accepted, no change.
- **(b) Phone Payee wrapping:** accepted for 07; revisit in 08.
- **(c) Transfer UI proof:** a mixed Transfer + ordinary selection step added. The Transfer keeps its Category, and the ordinary row takes Groceries.
- **(d) Bulk Remember:** deferred.
- **(e) Opt-in hint:** `Marks these Transactions reviewed. Balances already include them.`, asserted as the checkbox's accessible description.
- **Review probes.**
  - The deleted-Category probe failed after the fix (`probes-red.txt`, `probes-after.txt`) and is folded into the owner Undo test.
  - The monthly-totals probe is not kept. Bulk writes go only through the owned writers (`local/owned-writes`), and the seeded sequences in `convex/monthlyTotals.test.ts` own that invariant.
  - The same-state probe is not kept: it pins the accepted value-based limit. `convex/ticket07review.test.ts` was deleted.

**Tests (red, then green)**

- **Owner test.** "Undo puts back each Category and approval it changed, but keeps a row changed since and a Category whose earlier one was deleted". Red: `NOT_FOUND` on the old owner (`owner-red.txt`). Green: `owner-green.txt`.
- **Journey `transactions/select-categorize`.** New steps: the hint, the Transfer + ordinary selection, Undo retirement (an untouched row keeps Undo, a touched row ends it), and a held `transactions:categorizeMany` released after `Clear` and checking another row.
  - Red on the pre-fix UI, one new step at a time (`red/t07fix-red` at the hint, `red/t07fix-red-2` at retirement with Undo count 1, `red/t07fix-red-3` at the held step with the newer selection cleared and Undo shown). The Transfer step passed pre-fix, as expected for coverage.
  - Green on the final code: `green/t07fix-green-final`, with select-categorize, approve-all-undo, categorize and approve-phone all passing. The after-Undo and late-save screenshots were inspected.
- **Gap:** the deleted-Category sentence is proven at the owner and by type; no journey deletes a Category mid-Undo.

**Checks**

- The main checkout passed `codegen:check`, `format:check`, `lint`, `lint:ui`, `typecheck` and `test` (908 passed) (`check.txt`).
- `capacity:check` passed in the temporary worktree `budge-t07fix` on the final code: bulk is 250 and below half (`capacity-check.txt`).
- Full `bun run test:e2e:local`: 53 passed in 7.5 min (`e2e-local.txt`). The Clerk FAPI lines are teardown noise.
- The commit 9edaa25 was typechecked and owner-tested on its own.
- The app was stopped and the worktree removed.

**Principles that changed a choice**

- **Encode Lessons in Structure / Model the Domain:** ownership is a selection mark checked at one boundary, not a flag per handler.
- **Laziness Protocol:** no revision state; the earlier Category's existence is cached per Undo; the redundant probes were not kept.
- **Test Behavior:** real held traffic, plus a paired retirement case.
- **Minimize Reader Load:** the after-Undo note reuses the Undo slot rather than adding a second live region.
