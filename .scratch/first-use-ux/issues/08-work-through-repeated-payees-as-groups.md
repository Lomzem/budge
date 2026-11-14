# 08: Work through repeated Payees as groups

**Status:** done

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 07 — grouping builds on individual selection and bulk actions.

Deliver: review Transactions grouped by their existing Payee identity, inspect dates/amounts, and select a group or exceptions. Retain individual and cross-Payee selection; the Payee is not forced into one Category. Validate the interaction against the repeated-vendor task before settling layout. Do not merge names or change stored Payee identity as a side effect of grouping.

Proof: one browser-owned mixed-purpose Payee scenario proves group membership, subset exclusion, and reuse of selection. Ticket 07 owns the write/undo contract; do not repeat its API matrix. A grouping unit test needs a distinct independent contract, not a mirrored inventory of rendered rows.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Landed 2026-11-13 (commit 66ac82f on `feat/first-use-ux`, docs in the next commit)

**Decisions**

- **Identity, not names.** `transactions.list` rows now carry `payeeId`, and `groupByPayee` (`src/lib/components/transactions/payeeGroups.ts`) groups by it. Rows without a Payee fall into `Transfers`, `Starting Balance` and `No Payee`, after the named Payees. Grouping writes nothing; the journey's lookalike (`SAMPLE WAREHOUSE 7702` beside `7701`) stays apart, and every row still names its Payee once grouping is off.
- **A view, not a filter.** `Group by Payee` is a toggle button (`aria-pressed`, `secondary` when on, icon only below `sm`) beside the Approve button. Its state is the URL param `group=payee`, outside the filters and the selection's scope key, so reload keeps it and turning it on or off keeps the selection.
- **Layout.** Each section (`Unapproved`, `Approved`, or the one filtered list) holds one `tbody` per Payee, ordered by name, rows in their loaded date order. The heading row holds a tri-state Checkbox `Select the N <Section> shown from <Payee>` and the name with `N shown`. Grouped rows drop the Date column; each row's edit button shows its long date (its name still begins with the Payee), and the column header reads `Date`. Ordering by name keeps a group in place while exceptions are worked through.
- **Selection reuse.** The group box calls ticket 07's `selection.set(ids, picked)` on the group's loaded rows only; the bulk picker, Approve, Undo and late-result ownership are unchanged. No unseen history is selected, nothing is chunked past `BULK_CATEGORIZE_LIMIT` (the existing `Categorize at most 250 at once.` applies), and no bulk Remember.
- **Phone wrapping (07's open question).** Below a 512 px table the Payee heading spans the Payee and Amount columns (`colspan` 2, `hideFrom="lg"`; a second heading cell takes over from `lg`), so `SAMPLE WAREHOUSE 7701` reads on one line at 320 and 390 px instead of three, and the rows below it show only dates. The ungrouped list still wraps long Payees as before; grouping is the answer for repeated ones.
- **Shared table primitives.** `shadcn/no-restyle` refuses classes on `Table.Head`/`Table.Cell`, so the table gained a `hideFrom` column variant and a `Table.Head` `variant="group"` (body-size, wrapping, centered). Focus after approve, categorize, resolve and dialog close now follows the display order (`listed`), which equals `rows` when ungrouped.

**Changed files**

- Server: `convex/lib/transactionRows.ts`, `convex/transactions.ts` (`payeeId` on the list row).
- UI: `src/lib/components/transactions/{transaction-table.svelte,payeeGroups.ts (new)}`, `src/lib/components/ui/table/{table-variants.ts,table-head.svelte,table-cell.svelte}`.
- Journey: `e2e/journeys/transactions.ts` (`transactions/payee-groups`).
- Map: `.agents/skills/verify-budge/features/transactions.md` (`txn-payee-groups`, the journey, a Group by Payee recipe, Sources).

**Tests (red, then green)**

Evidence is under `test-results/ticket-08/`.

- Authoring gate: contract is group membership by stored identity, a group box covering only that group's shown rows and going mixed with exceptions, cross-Payee selection through ticket 07's path, grouping that keeps the selection and survives reload, and a one-line heading on phones. Owner is the browser journey; 07's write/undo matrix is not repeated (the Category outcomes only prove exclusion). No `groupByPayee` unit test: Payee names are unique (`payees.rename` refuses duplicates), so its only independent case would mirror the rendered rows. No test-only seam: `payeeId` is read by production grouping.
- Red: `t08-red`, failing at step 2 (no `Group by Payee`) before the UI existed.
- Green: `t08-green` (payee-groups, approve-all-undo, select-categorize).
- Negative control: `t08-control-no-colspan` drops the heading's `colspan`; the 320 px step fails with the name on 3 lines (expected 1).
- Affected journeys: `t08-affected`, 12 passed (transactions create, late-save, categorize, categorize-late, approve-all-undo, select-categorize, payee-groups, approve-phone; search filters, phone; shell navigate, phone-pages).
- Before screenshots of the ungrouped phone list: `before-{320,390,1280}.png`.

**Checks**

- Main checkout: `codegen:check`, `format:check`, `lint`, `lint:ui`, `typecheck`, `test` (908 passed) (`check.log`). `capacity:check` not run: it refuses in the main checkout and the change adds no write, read loop or admitted size.
- Full `bun run test:e2e:local` at 66ac82f: 53 passed, 1 failed in 8.2 min (`e2e-local.log`). The failure is `splits/lines` at its second step (`Line 1 amount` not found after choosing `Split across Categories` in Add Transaction), which this ticket does not touch; it passed 3 of 3 runs alone (`t08-splits-{1,2,3}`), so it is recorded as a flake for the review. The Clerk FAPI retry lines are the known teardown noise.
- The worktree app (`budge-t08`) was stopped with `bun run app down`, and the worktree was removed.

**Open questions**

- Group order is by name; a "most rows first" order may suit a long list better. Left alphabetical for stability while working.
- A group's box names its section (`Unapproved`); with `Approve them too` the approved rows move to an `Approved` group of the same Payee, which is correct but may surprise.
- `splits/lines` failed once in the full suite and passed three times alone; worth watching for a timing race in the Split choice.
- Grouping is per loaded page; a Payee with history past `Show more` shows `N shown`, not its total. Saying the total would need a count query.

### Review fixes 2026-11-13 (commits 88b3988..b1d8bdf on `feat/first-use-ux`)

Made in a detached worktree (`budge-t08-fix`, since removed) and fast-forwarded onto the branch. Evidence is copied to `test-results/ticket-08-fix/` and `test-results/verify-budge/t08fix-*` in the main checkout. The stress harness is kept beside the review as `reviews/08/selection-stress.ts.txt`.

**P2: Undo and Show more focus followed date order, not the shown order (fixed, 88b3988).**

- One display-order lookup in `transaction-table.svelte`: `firstShown(ids, controlOf)` takes candidate IDs, walks `listed` (the shown order, grouped or not), and returns the first row's control; each caller keeps its own fallback (`approveAllButton` for Undo). Both Undo kinds pass `touchedBy(entry)`. Show more keeps the IDs loaded before `loadMore`, derives the new ones once the page arrives, and focuses the first of them as shown. Receipts and mutation order are unchanged.
- `transactions/payee-groups` gained steps 9 and 10: fifty newer `SAMPLE ZOO 9902` rows and one older `SAMPLE ARCADE 3301` row are imported and the page reloaded (an exhausted first page grows to take new rows, so the reload is what puts ARCADE past `Show more`). Show more must focus ARCADE's edit button; with one ZOO row and ARCADE checked, Undo after Gifts must focus ARCADE's Category and Undo after `Approve 2 selected` its Approve.
- Red: `t08fix-red-showmore-2` (unfixed code; step 9, focus not on ARCADE), `t08fix-red-undo-receipt-order` (Undo through receipt order; step 10, Category), `t08fix-red-undo-approved-receipt-order` (receipt order for the approved kind only; step 10, Approve). `t08fix-red-showmore` is void: it ran before the reload was added and ARCADE was already on page 1. Green: `t08fix-green-order`.

**P2: the Payee lookup's status shifted Split from under the pointer (fixed, 4c7037d).**

- At the picker/dialog boundary: `selectionChoices()` no longer adds the disabled `Looking up the remembered Category…`/`Pick a Category` option; the dialog passes that text as the `CategoryPicker`'s `placeholder`, so the trigger still says it (with `data-placeholder`) while the open list's options and geometry stay put when the lookup resolves. Options stay keyed by value. `splits/lines` does not wait for the lookup.
- `splits/lines` step 1 now holds `payees:lastCategory` with `withholdQueryResult`, asserts the trigger reads the lookup text, opens the list, rests the pointer on `Split across Categories`, releases the answer, waits for `Uncategorized`, then clicks the same point and requires `Split across Categories`, the reviewer's `split-race.ts` interleaving.
- Red: `t08fix-red-split-race` (the click picked `Ready to Assign`). Green: `t08fix-green-split-race` (`splits/lines`, `payees/last-category`). This is the likely cause of the `splits/lines` flake recorded at landing.

**Item 3: the lost `1 selected` in `transactions/select-categorize` (explained; not an app race; journey and skill fixed, b1d8bdf).**

- The reviewer's trace shows two page reloads the journey never asked for (`[vite] connecting...` and fresh Convex `InitialConnect`) during the final `1 selected` wait, while `bun run check` ran in the same checkout. Reproduced: running `bun run sync` (the first thing `typecheck` does) while the journey runs makes Vite reload the page about a second later (`stress-sync.log`: sync exits at 6.8 s, unrequested reload at 7.8 s), and the reload drops the in-page selection. Started at offsets into the late-save step, it fails the journey at several assertions depending on where the reload lands (`stress-sync-delay-{1000,1100,1200,1300,1400}.log`; 600 ms and 0 ms passed because the reload landed before the step's own state). I did not land a reload exactly on the `1 selected` line; the trace and these runs make the cause the reload, not the save's ownership. Without a concurrent sync, the late-save step passed every run, including six at 4× CPU (`stress-cpu4*.log`, `stress-cpu4-green.log`). Fix: verify-budge's Launch step now says not to run `check`, `typecheck` or `sync` in a checkout while its app drives a journey.
- Found on the way, a real journey race: at 4× CPU the next step (`a Split in the selection…`) failed 5 of 5 (`stress-cpu4.log`, `stress-cpu4-watch.log`). It typed `Warehouse` and checked the club row at once; the row was still visible in the unfiltered list, so the check landed inside the 300 ms search pause and the search, applying after, started the selection over (watch log: checked at 155 ms, cleared at 507 ms). The journey now waits for the bookshop row to leave before checking. Green: 3 of 3 at 4× CPU (`stress-cpu4-green.log`). Product behavior is unchanged: a check made before a pending search applies is cleared with the rest of the selection, as ticket 07 decided for searches; see Open questions.

**Open questions answered (owner decisions, recorded)**

- Group order stays alphabetical.
- Rows approved with `Approve them too` keep moving to the `Approved` section; the outcome wording was read again and left as it is.
- The heading keeps `N shown` with no count query.
- Show more leaves a group's box mixed and never selects the new rows; the review confirmed it, and it is kept.

**Authoring gate (test-audit)**

- payee-groups steps 9 and 10: contract is focus on the first affected row in the shown order after Show more and both Undo kinds; regression is any date- or receipt-order lookup; existing proof only had lists where the two orders agree; owner is the browser journey, since focus exists only there; no seam.
- splits/lines step 1: contract is that the open Category list holds still when the lookup answers, so the pointed option is the picked one; regression is a status row inside the options; held at the real Convex WebSocket boundary (`e2e/heldResponse.ts`); `payees/last-category` owns the recall outcome, not the list geometry.
- select-categorize step 9: a synchronization on a visible outcome (the narrowed list), no new contract.

**Checks**

- `bun run check` in the worktree, which includes `capacity:check` there: passed, 908 tests (`check.log`). Rerun after a Prettier fix to the journey.
- Affected journeys `t08fix-affected`: 12 passed (payees last-category, remember; splits lines, restart; transactions create, late-save, categorize, categorize-late, approve-all-undo, select-categorize, payee-groups, approve-phone) (`affected.log`).
- Full `bun run test:e2e:local` on the final tree: 54 passed in 8.6 min (`e2e-local.log`). The Clerk FAPI retry lines are the known teardown noise.
- Hooks, including `gitleaks --redact`, ran on each commit: no leaks.
- The worktree app was stopped with `bun run app down` and the worktree removed.

**Principles that changed a choice**

- fix-root-causes: the focus fix went into one shown-order lookup that all three callers use, rather than patching each sort; the picker fix moved the status out of the options instead of making `splits/lines` wait.
- prove-it-works: the receipt-order red runs were made per Undo kind, so each caller's use of the lookup is proven, not only Show more's.
- test-behavior-not-implementation: the search-race fix waits on the narrowed list a person sees, not on the URL, which changes before the search applies.

**Open questions**

- A row checked while a typed search is still pending is lost when the search applies. A person is unlikely to beat the 300 ms pause, but the search could apply at once on a check, or the check could wait for it. Left as ticket 07 decided.
