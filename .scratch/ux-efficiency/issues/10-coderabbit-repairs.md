# 10 — CodeRabbit production repairs (PR 32)

Status: ready-for-agent

Base: `eb1d3f9` on `feat/ux-efficiency`. Scope: the three production/UI findings from the completed CodeRabbit review. Docs findings, replies, push and merge stay with the parent. The parent's independent reviews and affected UI judging are still pending, so the status stays `ready-for-agent`.

## Dispositions

| CodeRabbit ID | Finding | Disposition |
| --- | --- | --- |
| Inline 4577048660 | `Swap From and To` was icon-only, against the rule that only "more actions" and the narrow search/filter/clear/add controls may show just an icon (`.scratch/bank-sync-ux/spec.md`, `.coderabbit.yaml`) | **Fixed.** The button now shows `Swap From and To` beside its icon at `size="sm"` (32 px, 44 px under a coarse pointer). The visible text is the accessible name, so `aria-label` is gone and the journeys' selectors still match. |
| Inline 4577048665 | `reordered = $state({ from: list.data, … })` deep-proxies the query result, so `reordered.from === list.data` was never true and the optimistic order never showed | **Confirmed and fixed at the root.** In convex-svelte 0.15.1, `useQuery().data` is the raw `localQueryResult` object (`$derived`, not proxied). Svelte 5.57.3's `$state` hands back a proxy of it, so the equality always failed. Two quick ArrowUp presses on Coffee therefore computed the second move from the unmoved list: both saves sent index 1, and Coffee moved only once. Rather than switch to `$state.raw`, which keeps the hand-held snapshot and its flicker (the first response replaces the order before the second lands), both reorders now use Convex's optimistic update on `categories.list`. The Convex client stacks pending updates, re-applies them over each server result, and rolls one back if its mutation fails. The `reordered` state and its failure cleanup are gone. Category and Group reorders share this path. |
| Review 5909130525 (outside diff), `src/routes/(app)/+page.svelte` ~47 | An entry with no `?month`, such as the first `/`, fell back to the shared Budget month, so `/` → Categories → Budget → Next month → Back → Back showed next month and `keepInUrl` rewrote the first entry | **Confirmed and fixed.** The feature map already says the month is "dropped for the current month", so an entry without `?month` means the current month: Back or Forward to one shows the current month. A link or goto into the Budget with no month keeps the month viewed last. That is the existing in-session behavior (the sidebar and tab bar link to plain `/`), and it is preserved. The rule is one function, `monthAt`, which reads `navigating.type === 'popstate'` (from `$app/state`) both when the page mounts and on same-page URL changes. Entries with a month and the month/transaction context fixes are unchanged. |

## Follow-up: refused reorder recovery (sol-a-CR-A1)

Base `3dc077b`. A refused `categories:move` or `categories:moveGroup` rolled the order back but left focus on `<body>`: 4 Tabs to return to Move Coffee, 17 to Move Everyday. At 320 px the reason showed only in the page-top alert, above the visible list, so the snap-back looked unexplained. A second observer also reported the reason staying after the first of two quick presses was refused and the second landed.

- **Cause.** When the keyed `{#each}` moves a row, Chromium blurs whatever inside it has focus (`focusout` with `relatedTarget` null, the node still connected), and focus falls to `<body>`. The handle's key handler refocused it only after its own optimistic move, so the Convex rollback, a second move, lost focus. Any server-driven move of the focused row did the same.
- **Focus repair (`src/lib/reorder.ts`).** Each reorder item restores focus to the element inside it that was focused when it moved: the handle, the name button or the rename field. It acts only if that `focusout` had no `relatedTarget`, the item's place among its siblings changed, and focus is now on the document. Tab, a dialog, any other focused control, or a click on blank space (which moves no item) is never taken back. The key handler's `tick` refocus is gone, since the optimistic move takes the same path.
- **Reason in context (`src/routes/(app)/categories/+page.svelte`).** A move failure belongs to the item that moved. It shows as a `role="alert"` line inside that row or group header, so it is in view next to the handle. Only the latest move of an item decides its message. A new move clears it, and an older move refused after a newer one was sent stays silent, because the newer, absolute index decides the order. That resolves the stale-message report as part of the same ownership change. Other page actions keep the page-level alert, whose placement predates this branch and is unchanged.
- **Harness gap found and fixed (`e2e/journeys/layoutShift.ts`).** Once a journey calls `routeWebSocket`, Playwright replaces the page's `WebSocket` with an in-page mock. The guard had already patched the native class, so it watched only the mock's inner socket and missed held requests and forged answers. It reported the rollback-plus-reason shift as unprompted. The guard now follows the class the page uses and ignores the mock's inner socket. Probes on the scratch page confirmed that the refusal shift is now credited and that an injected shift with no input still fails, with and without a route.

### Red → green

Evidence is under `test-results/verify-budge/`:

- `cr-focus-red` (base source plus the new steps) failed at step 11: no alert in Coffee's row (the reason was only the page-top alert), after a rollback through the real routed socket.
- `cr-focus-red-focus` (the page fix only, base `reorder.ts`) failed at step 11: `Move Coffee` was `inactive`, not focused, after the rollback.
- `cr-focus-green` failed on the journey's own wrong assumption that Everyday had a group above it. The step now picks ArrowUp or ArrowDown from Everyday's place.
- `cr-focus-green2` failed on the guard gap above.
- `cr-focus-green3`: all 12 `categories/reorder` steps pass on the finished source, including rapid held moves, Home/End, touch cancel, the second finger, touch autoscroll, the desktop drag and both new steps.
- `cr-focus-affected`, under the changed guard: 21 of 22 pass. These are every journey that routes the socket (except `categories/reorder`, covered above), plus `budget/phone-groups`, `budget/assign`, `shell/navigate` and `inspector/cover-and-manage`. `categories/manage` failed once, in the Add Category dialog: "Enter a name." did not appear in the step where the group is made but the Category is refused. This diff does not touch that dialog. It passed in reruns `cr-focus-manage-rerun` and `cr-focus-manage-rerun2`, so it is intermittent (1 of 3) and left open.
- `cr-focus-final`: `categories/reorder` (all 12 steps) and `categories/manage` pass on the committed tree. The tracker map became a `SvelteMap` for `svelte/prefer-svelte-reactivity`.

Test-audit gate: both new steps check what a user observes: order, the visible reason beside the row, focus, retry and persistence. They fail at the real transport boundary on the base source, add no production seam, and reuse `failFirstCallTo`. The focus-away step guards the ownership requirement, so a "refocus the handle on failure" fix would fail it. The guard change has no unit test. Its behavior was shown by the two scratch probes above and by the journeys rerun under it.

### Manual probes (not in the journey)

- `cr-focus-manual2` (`notes.txt`, screenshots, ARIA):
  - 320 px keyboard: the reason box is at y=306, right under the handle at y=268, focus stays on `Move Coffee`, nothing is past the right edge, and a retry clears it.
  - First of two quick presses refused at 1280 px: no reason stays, Coffee stays first after a reload, and focus stays on the handle.
  - Focus moved into the Add Category dialog before the refusal stays on the dialog's input.
  - A click on blank space before the refusal leaves focus on `<main>`.
- `cr-focus-manual2-touch-d`: a refused 320 px touch drag puts Coffee back with the reason in view (y=306) and nothing past the right edge.
- The partial `cr-focus-manual` run, the touch step at the end of `cr-focus-manual2` (timed out after 90 s with no move sent), and `cr-focus-manual2-touch`/`-b`/`-c` record probe-script mistakes (a page-rooted `has` locator, a BODY expectation where `<main>` takes focus, a drag started before the list loaded). They are not product failures.

## Red → green

Both new journey steps failed on unchanged `eb1d3f9` source, for the reported reason, and pass after the repair:

- `categories/reorder`, "two ArrowUp presses on Coffee while its first save is unanswered move it twice at once, and both saves last". `holdResponseTo('categories:move')` holds the first answer and every later frame. Red run `cr-red`: the order stayed `Groceries, Dining Out, Coffee, Transit` with no optimistic move. Green run `cr-green`: Coffee was first at once, and still first after the release and a reload. The step replaced "ArrowUp and Home". Home and the no-op ArrowUp at the edge stay in "End and Home move Coffee…", which also covers End on a Category.
- `budget/month-jump`, "a Budget entry without a month stays the current month after the next one is viewed from a later entry". Red run `cr-red`: after Back twice the picker read `December 2026` where `November 2026` was expected. Green run `cr-green`: Back twice shows the current month with its own Groceries Assigned and no `?month`, the same after a reload, and Forward twice returns to next month with its distinct amount.

Test-audit gate: each step protects an observable contract that existing proof missed. The old reorder step waited for the server after every press, and the old month steps only used entries that had `?month`. Each fails on a credible regression (shown red above), adds no production seam, and reuses existing helpers.

## Checks

Evidence is under `test-results/verify-budge/` in this worktree, from the worktree-local `bun run app` (anonymous local backend, `budget-with-accounts`, synthetic data only):

- `cr-red`: the two new steps fail on the unchanged source.
- `cr-green`: `categories/reorder` and `budget/month-jump` pass.
- `cr-affected`: `budget/assign`, `budget/assign-back`, `budget/needs-you`, `budget/phone-groups`, `categories/manage`, `categories/late-rename`, `categories/failed-rename`, `inspector/move-money`, `inspector/cover-and-manage`, `search/filters` and `shell/navigate` pass.
- `cr-manual`, with screenshots, ARIA snapshots and `notes.txt`:
  - Swap at 1280 px: Tab reaches it, Enter and Space swap and keep focus. Escape in the open picker closes only the picker and keeps the draft. Escape on a started move clears it and leaves the inspector open.
  - Swap at 320 px with touch: visible label, 44 px tap target, nothing past the right edge, and a tap swaps. Escape in the picker and on a started move behave as at 1280 px, and the dialog stays open.
  - Two held `moveGroup` presses move `Savings Goals` up twice at once, and the order lasts after the release and a reload.
  - A failed `categories:move` rolls the optimistic order back and shows `Budge couldn't save that. Try again.`
  - The sidebar Budget link keeps next month after a visit to Categories.
- `cr-final`: the final run on the finished tree, recorded under Comments.
- `bun run format:check`, `lint`, `lint:ui` and `typecheck` pass, and `bun run test` passes all 933 tests (59 files), including the feature-map test.
- No Convex, admission or codegen change, so `codegen:check` and `capacity:check` were not rerun.

Feature map: `budget.md` (`budget-month-jump` and the `budget/month-jump` journey) and `categories.md` (`categories/reorder`). `inspector.md` needs no change: the Swap button's name is the same, and that file belongs to the parent.

## Comments

- Parent integrated `37c22be` as `2cdd2e1`. Fresh local code-review at `f93eb14` reports no production Standards violations/smells and no Spec findings; changed-test audit passes and seven focused checks pass. Reports: `test-results/ux-efficiency/reviews/cr-repairs-{standards,spec}.md` in the parent checkout. Parent independently read the actual pre-fix failures and green, affected and final summaries.
- Standards P3: the Categories map put failed-save rollback inside the `categories/reorder` journey description, although only `cr-manual` exercises refusal/rollback. Removed that parenthetical; the manual proof remains explicitly in this ticket. Feature-map checks and formatting pass.
- Analysis-only corrections, decided by the Opus implementor: C1 (component copies losing operation/query context) **answered** by existing submitted-command snapshots for async feedback and library-owned optimistic query updates; their owners differ, so no shared state framework. C2 (manual checks drifting into journey coverage) **accepted** as a documentation-only convention in the feature-map README: journey descriptions list retained assertions; manual probes have separately labelled clauses. No runtime or source-grep lint is justified.
- Parent documentation fixes address CodeRabbit 4577048648 (regrouping keeps inspector open), 4577048651/4577048654 (repository-relative protocol links), 4577048655 (private artifact paths labelled as local), and 4577048658 (current resume phase/remaining steps). Archive notes identify link-only editorial changes; observations/verdicts are preserved. Link targets resolve and redacted secret checks pass. Fresh affected UI judging and final-head CI/CodeRabbit approval remain required; no new shipping claim is made.

- Opus 5.5 implementor: final tree (after the lint rename and Prettier formatting) passed `categories/reorder`, `budget/month-jump`, `inspector/move-money` and `inspector/cover-and-manage` in run `cr-final`; the app was stopped with `bun run app down`. Local `code-review` (sub-agents) was not run here because this task forbade further delegation; the parent schedules the reviews and affected UI judging.
