# 08: Work through repeated Payees as groups

**Status:** landed — review pending

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
