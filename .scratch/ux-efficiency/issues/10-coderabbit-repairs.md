# 10 — CodeRabbit production repairs (PR 32)

Status: ready-for-agent

Base: `eb1d3f9` on `feat/ux-efficiency`. Scope: the three production/UI findings from the completed CodeRabbit review. Docs findings, replies, push and merge stay with the parent. The parent's independent reviews and affected UI judging are still pending, so the status stays `ready-for-agent`.

## Dispositions

| CodeRabbit ID | Finding | Disposition |
| --- | --- | --- |
| Inline 4577048660 | `Swap From and To` was icon-only, against the rule that only "more actions" and the narrow search/filter/clear/add controls may show just an icon (`.scratch/bank-sync-ux/spec.md`, `.coderabbit.yaml`) | **Fixed.** The button now shows `Swap From and To` beside its icon at `size="sm"` (32 px, 44 px under a coarse pointer). The visible text is the accessible name, so `aria-label` is gone and the journeys' selectors still match. |
| Inline 4577048665 | `reordered = $state({ from: list.data, … })` deep-proxies the query result, so `reordered.from === list.data` was never true and the optimistic order never showed | **Confirmed and fixed at the root.** In convex-svelte 0.15.1, `useQuery().data` is the raw `localQueryResult` object (`$derived`, not proxied). Svelte 5.57.3's `$state` hands back a proxy of it, so the equality always failed. Two quick ArrowUp presses on Coffee therefore computed the second move from the unmoved list: both saves sent index 1, and Coffee moved only once. Rather than switch to `$state.raw`, which keeps the hand-held snapshot and its flicker (the first response replaces the order before the second lands), both reorders now use Convex's optimistic update on `categories.list`. The Convex client stacks pending updates, re-applies them over each server result, and rolls one back if its mutation fails. The `reordered` state and its failure cleanup are gone. Category and Group reorders share this path. |
| Review 5909130525 (outside diff), `src/routes/(app)/+page.svelte` ~47 | An entry with no `?month`, such as the first `/`, fell back to the shared Budget month, so `/` → Categories → Budget → Next month → Back → Back showed next month and `keepInUrl` rewrote the first entry | **Confirmed and fixed.** The feature map already says the month is "dropped for the current month", so an entry without `?month` means the current month: Back or Forward to one shows the current month. A link or goto into the Budget with no month keeps the month viewed last. That is the existing in-session behavior (the sidebar and tab bar link to plain `/`), and it is preserved. The rule is one function, `monthAt`, which reads `navigating.type === 'popstate'` (from `$app/state`) both when the page mounts and on same-page URL changes. Entries with a month and the month/transaction context fixes are unchanged. |

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

- Opus 5.5 implementor: final tree (after the lint rename and Prettier formatting) passed `categories/reorder`, `budget/month-jump`, `inspector/move-money` and `inspector/cover-and-manage` in run `cr-final`; the app was stopped with `bun run app down`. Local `code-review` (sub-agents) was not run here because this task forbade further delegation; the parent schedules the reviews and affected UI judging.
