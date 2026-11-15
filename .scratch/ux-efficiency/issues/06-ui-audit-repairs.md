# 06 — Repair three-judge UI audit findings

Status: ready-for-agent

Fresh Opus owns production/UI fixes from round1. Primary required repair is sol-a-1: changing viewed Budget month after reload, navigating to Categories, then Back must restore the last-viewed month. Preserve explicit deep links, current-month URL convention, cutover boundary and deliberate history semantics; test the user-visible context and actual monthly assignments.

Disposition every Opus minor/nit from round1 explicitly with fixed/answered/deferred and reason. Prefer focused polish that improves the approved flows; avoid unrelated redesign. SolB's report is still independent/pending at7aa0bbe; its eventual findings will join this repair batch. Never share other judges' scores/verdicts with a still-running judge.

Use existing public journeys and verify-budge. Preserve evidence at desktop1280x800,phone320x640 touch,keyboard and relevant390/dark states. Reproduce required bug before fix, prove after navigation/reload and correct money/month. Update feature map for changed coverage; test-audit every new/changed test. Full source review and fresh affected UI judging remain parent gates. Do not mark ticket done before those gates.

## Implementation record (Opus 5.5 repair, worktree `t3-0957aeec-d0baf4154befc730`, branch `t3/budget-history-ui-repairs` from `1c3aa26`)

Status stays `ready-for-agent` until the parent gates (full source review, fresh affected UI judging) pass.

### Dispositions

| ID | Severity | Disposition | What and why |
| --- | --- | --- | --- |
| sol-a-1 | major | fixed | Root cause: SvelteKit's `replaceState` keeps `page.url` at the URL the page loaded with, and popstate navigates to that stored URL, so Back from another Section returned to the month of the last reload (or the context month without a reload, which hid it). Month changes now replace the history entry with a real navigation, `keepInUrl` (`src/lib/keepInUrl.ts`: `goto(…, { replaceState, keepFocus, noScroll })`). Server loads don't read the URL, so nothing refetches. The same defect in the Transactions filters (`transaction-table.svelte`) is fixed through the same helper. `eslint.config.js` now bans `pushState`/`replaceState` from `$app/navigation` in `src/**`, dialog block included (`eslint/rules/keep-in-url-config.test.js`). Deep links, dropping `month` for the current month, reload and the cutover boundary keep their existing journey coverage (`budget/month-jump`, `budget/assign`, `settings/start`), all green. |
| sol-b-1 | major | fixed | At 390 px, $999,999.99 Assigned and seven-figure Group totals were cut (`td $1,000,229.99 120/112`, `input 999,999.99 110/94`, `td $999,808.87 106/96`). Assigned field widths and cell padding now fit the values. The Budget table now uses container queries on its own width instead of viewport breakpoints: under 28rem of table Available stacks under Assigned, from 28rem it gets its own column, and from 36rem Activity does too. The unused `amount-compact` width and the `roomy` MediaQuery are removed. No value is truncated or hidden; each money value shows once, in full. |
| layout-1024 (found during sol-b-1) | major, pre-existing on `main` | fixed | At 1024 px with the sidebar and inspector both open, three 128 px money columns left the Category column at 0 px and clipped Available. The container queries above stack Available there instead. |
| opus-1 | round-1 minor/nit | answered | The 113×24 `Assign $X to <name>` button already takes taps across 44 px on a coarse pointer (the `xs` size's `pointer-coarse:after` hit area). Measured at 320 touch: tap height 44 px; at 1280 pointer it is 24 px (`test-results/verify-budge/manual-opus-1-2/probe.json`). The visible box stays 24 px so each Category row stays compact. |
| opus-2 | round-1 minor/nit | fixed | The `icon-xs` button (the Group `+`) is `pointer-coarse:size-11`: 44×44 on touch, 24×24 by pointer. `budget/phone-groups` checks the tap height on an emulated touch screen. `useATouchScreen`/`expectTapTargetHeight` moved from `plaid.ts` to `journey.ts` for that. |
| opus-3 | round-1 minor/nit | fixed | Pre-existing. Removing a split line focuses the Category of the line now in its place, else the line before it (`removeSplitLine` in `transaction-dialog.svelte`); `splits/lines` asserts it. |
| opus-4 | round-1 minor/nit | fixed | The inspector has a polite `role="status"` that names each done move (`Moved $10.00 from Groceries to Coffee.`) and cover (`Covered $X for <name> from Ready to Assign.`). Asserted in `inspector/move-money` and `inspector/cover-and-manage`, which now also journeys Cover from Ready to Assign. |
| opus-5 | round-1 minor/nit | fixed | Once the Move form has a choice, an amount or a refusal, a `Clear` button empties it and focuses the picker, and Escape inside the form clears it instead of closing the inspector. A clean form's Escape still closes the inspector. Asserted in `inspector/move-money`. |
| sol-b coverage gaps (provisional 8: extra keyboard/touch coverage) | n/a | deferred to re-judge | These are gaps in judging coverage, not production defects; the parent's fresh affected UI judging owns them. Nothing was masked for them. |

Known envelope, answered: at phone width the design fits a Category Assigned up to $999,999.99 and Group totals up to 13 characters (`$1,000,229.99`, which uses about 8 px of its cell's right padding at 390 px and stays fully readable). The server allows up to $10B, and larger values would wrap or cut at 320 px. Wider amounts are outside the phone design envelope; record a follow-up if real budgets reach eight figures.

### Changed files

`src/lib/keepInUrl.ts` (new), `src/routes/(app)/+page.svelte`, `src/lib/components/transactions/transaction-table.svelte`, `src/lib/components/budget/{budget-table,assigned-input,category-inspector}.svelte`, `src/lib/components/ui/table/table-variants.ts`, `src/lib/components/ui/button/button.svelte`, `src/lib/components/transactions/transaction-dialog.svelte`, `eslint.config.js`, `eslint/rules/keep-in-url-config.test.js` (new), `e2e/journeys/{budget,inspector,splits,search,journey,plaid}.ts`, `.agents/skills/verify-budge/features/{budget,inspector,splits,search}.md`.

### Red before fix, green after (evidence under `test-results/verify-budge/`)

- sol-a-1 Budget: red `red-month-history-2` (Back showed August, not the September chosen after the reload); green `green-month-history`, `green-container`. Manual at 1280 keyboard and 320 touch: `manual-sol-a-1/` (Back returns `?month=2027-01` with its saved Groceries amount).
- sol-a-1 Transactions filters: red `red-filter-history` (Back showed Sample Landlord, not Sample Coffee Shop); green `green-filter-history`.
- Lint rule: `keep-in-url-config.test.js` 3 fail against the `HEAD` config, pass with the new one.
- sol-b-1: red `red-large-amounts` at 390 with the judge's exact values; green `green-large-amounts`, `green-container-2`. Manual 390 dark with a long Category name at 320/390/430/640/768/1024/1280, before the container change `manual-sol-b-1-before-container/` (1024 Category at 0 px), after `manual-sol-b-1/` (nothing cut at any width).
- opus-2: red `red-opus-2`, green `green-opus-2` (`plaid/sync-waiting` also passes with the moved helpers).
- opus-3/4/5: red `red-opus-345` (move status missing, cover status missing, `Line 2 Category` not focused); green `green-opus-345`. The Escape/Clear and Cover-from-Ready-to-Assign steps weren't reached in the red run because an earlier assertion failed first. The old code had no Clear, and its Escape closed the inspector.
- opus-1: measured only (`manual-opus-1-2/`).

### Checks (app stopped)

`bun run typecheck` 0 errors/0 warnings; `bun run lint`, `bun run lint:ui`, `bun run format:check`, `bun run codegen:check` pass; `bun run test` 59 files, 933 tests pass. Full isolated E2E (`bun run test:e2e:local`): first run 62 passed, 1 failed (the new `budget/phone-groups` touch step turned touch emulation on mid-page and the layout-shift guard flagged the coarse-pointer resize). The step now loads the Budget after touch is on, like `plaid/sync-waiting`; red against the old button is re-proven and the rerun is 63 passed (9.5m). Capacity check not rerun (no capacity change; brief).

### Principles that changed a choice

- Fix root causes: the same shallow-routing defect was fixed in both callers through one helper, not only the reported month picker.
- Encode lessons: the lint ban on `pushState`/`replaceState` with a config test.
- Prove it works / experience first: readability is asserted by `expectEveryAmountShownInFull` (no cut cell or field) plus each value shown once, not by zero page overflow.
- Subtract before adding: removed the `roomy` MediaQuery and the `amount-compact` width instead of adding more breakpoints.
- Test behavior: user-visible journeys at real widths, red first.

### Cleanup

`bun run app down` run by this repair; evidence retained under `test-results/verify-budge/`.
