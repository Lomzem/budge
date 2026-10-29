# 07: Inspector, move money, and Cover

**What to build:** Selecting a Category shows its breakdown: left over from last month, Assigned, Activity, and Available. On desktop it appears in the inspector column; on a phone it opens inline under the row. From there I can move money to or from another Category in one action, and Cover an overspent Category from Ready to Assign in one step.

**Blocked by:** 05 (Budget screen)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 33–34, 42, 120; UI (layout)

- [x] The budget entry point also returns each Category's left-over-from-last-month amount (prior Available).
- [x] Inspector column at 1024 px and wider. Below that, the same content opens inline under the selected Category row.
- [x] Move money is one mutation that changes two Assigned values in the viewed month. Nothing about the move itself is stored.
- [x] "Cover $X from Ready to Assign" on an overspent Category assigns exactly enough to bring its Available back to zero.
- [x] `convex-test`: moving money leaves Ready to Assign unchanged and shifts both Categories' Available by the amount moved. Cover brings Available to exactly zero and lowers Ready to Assign by the same amount.
- [x] Keyboard path and visible labels for both actions.

## Comments

- Implemented on branch `07-inspector-move-money-and-cover`.
- Decisions:
  - `computeBudget` returns `priorAvailable` per Category: Available minus this month's Assigned and Activity. Callers still never assemble budget numbers themselves.
  - `moveMoney(month, fromCategoryId, toCategoryId, amount)` changes the two Assigned values through the same helper as `setAssigned`. A row that reaches zero is deleted, and nothing about the move is stored. It refuses a non-positive amount, the same Category on both sides, Ready to Assign (or any non-`normal` Category) on either side, and a month before cutover, each with `INVALID_INPUT`. The inspector offers "Move to" and "Take from", which both call it.
  - `cover(month, categoryId)` reads the budget on the server and adds `max(0, −Available)` to Assigned. It returns the amount covered, so Cover on a Category that isn't overspent does nothing.
  - The inspector is one component, shown in a sticky `aside` (`w-72`) at 1024 px and up, and below that in a row under the selected Category. The Category name is a button (`aria-expanded`). Opening the inspector on desktop moves focus to it. Escape or Close returns focus to the row. After Cover, focus moves to the inspector, because the Cover button disappears.
  - Button gained a `wrap` size, for the Cover label that carries an amount in the narrow column. The Move money select is `w-full min-w-0`, so at 320 px its long options don't widen the table.
  - Playwright runs with `workers: 1`: every test edits the same seeded budget.
- Verification: `bun run typecheck`, `lint`, `lint:ui`, `format:check`, and `bun run test` (133) pass. Playwright (5 tests, including the new `e2e/inspector.test.ts` at 1280 and 320 px) passed against a throwaway anonymous local backend.
- Review (GPT-6.1-Sol, standards and spec): rendered the move options once instead of twice, and kept focus after Cover. Kept `workers: 1` and the e2e test, as supporting scope.
- Shipped in https://github.com/Lomzem/budge/pull/6, squash-merged to `main` as 197dfed. CodeRabbit approved head 3d71f51 with no comments, and all six checks passed.
