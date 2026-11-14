# 01 — Simplify Budget and Categories

Status: ready-for-agent

Implement spec items 1–12. Fresh Opus implementor. Update this file with decisions, item coverage, changed files, checks, evidence, and remaining work. Do not implement items 13–26. Feature verification, local review, corrections, and three-judge gate are required before done; parent coordinates review.

## Implementation record (Opus 5.5, worktree `t3/budget-category-efficiency`)

Status stays `ready-for-agent` until the parent runs local code review, `/correct` and the three-judge UI gate. This worktree's brief forbade subagents, so the local `code-review` skill (which fans out to sub-agents) was **not** run here.

### Item coverage

| # | Item | Disposition | Where | Proof |
|---|------|-------------|-------|-------|
| 1 | Edit Assigned at 320 px | Done. Assigned stays an editable column at every width (compact `assigned` / `amount-compact` widths). | `budget-table.svelte`, `assigned-input.svelte`, `table-variants.ts` | `budget/phone-groups` step 2; `budget/assign` |
| 2 | Assign a Target from the table | Done. `Assign $X to <name>` button under the row when a Target needs money; focus returns to the name. | `assign-target-button.svelte` (shared with the inspector), `budget-table.svelte` | `targets/monthly` |
| 3 | Cover from another Category | Done. `Cover from another Category` prefills the shortfall with this Category as To and focuses From; `Cover $X from Ready to Assign` kept. | `category-inspector.svelte` | `inspector/cover-and-manage` step 1 (Ready to Assign unchanged, reload) |
| 4 | Explicit From/To | Done. Static side + picker side, `Swap From and To`. Radio group removed. | `category-inspector.svelte` | `inspector/move-money` |
| 5 | Searchable picker | Done. Existing `CategoryPicker` (Popover + Command). Picking focuses Amount. | `category-inspector.svelte` | `inspector/move-money` (`cof` → 1 option) |
| 6 | Add from its Group | Done. `Add Category to <group>` on every ordinary group header (Budget and Categories); dialog preselects it. Add Category is always offered. | `budget-table.svelte`, `+page.svelte`, `categories/+page.svelte`, `add-category-dialog.svelte` | `categories/manage` step 2 |
| 7 | New Group inside Add Category | Done. `New Category Group…` choice reveals required `Group name`, focused on choose; submit creates group then Category. | `add-category-dialog.svelte`, `select-field.svelte` (`onclosed`) | `categories/manage` step 3 (empty Group name keeps dialog open) |
| 8 | Rename in place | Done. `InlineName` for Categories, Groups and the inspector heading. Enter/blur save, Escape keeps, empty → `Enter a name.`, latest-wins. `RenameDialog` deleted. | `inline-name.svelte`, `categories/+page.svelte`, `category-inspector.svelte` | `categories/manage` steps 5–6; `categories/late-rename`; `inspector/cover-and-manage` |
| 9 | Reorder directly | Done. `Move <name>` handle: ArrowUp/Down/Home/End (focus kept) and pointer drag (pointer capture, `touch-action: none`). Optimistic order. Within a group / among groups; cross-group stays `Move to group`. Move up/down removed. | `src/lib/reorder.ts`, `categories/+page.svelte` | `categories/reorder` (keys at 320, mouse drag at 1280, reload, Budget order) |
| 10 | Manage from the inspector | Done. Heading renames in place; `<name> actions`: Rename, Move to group, Hide from budget, Delete…. When the open Category vanishes, the inspector closes and focus goes to `#main`. | `category-inspector.svelte`, `+page.svelte` | `inspector/cover-and-manage` steps 2–5 |
| 11 | Collapse Groups | Done. Header toggle (`aria-expanded`); totals stay; `N overspent` when collapsed; per-browser localStorage; opening a Category (Needs you / Previous / Next) expands its group. | `+page.svelte`, `budget-table.svelte`, `table-row.svelte` (`group` weight) | `budget/phone-groups` steps 4–6 |
| 12 | Month/year jump | Done. Heading is a popover trigger; year steppers, 3×4 grid with arrow keys; months before the first budget month disabled; arrows kept. | `month-picker.svelte`, `budget.svelte.ts` (`firstMonth`, clamping `goTo`) | `budget/month-jump` |

### Design decisions

- **No backend change.** Every item composes existing public functions (`categories.list/rename/renameGroup/move/moveGroup/setHidden/create/createGroup/remove`, `budget.moveMoney/cover/assignTarget`).
- **Item 7 is two mutations, not a new combined one.** If the Category create fails after the group was created, the dialog keeps the created group selected (`created`), so a retry reuses it rather than making a duplicate group (Make Operations Idempotent).
- **Item 1 at 320 px:** keeping Assigned narrows the name column to about 70 px. Group header rows below `xs` span the Category and Assigned columns and show the group's Assigned total as `$X assigned` under the name (so no total is lost); Category names drop their left indent below `xs`. Long single words (`Groceries`, `Emergency`) still wrap mid-word at 320 px; `hyphens: auto` was tried and is not applied by the verification Chromium, so it was not kept.
- **Item 9 within-group only:** dragging across groups would need drop targets in other lists and a different keyboard model; `Move to group` already covers the move with keyboard and touch. Handles have an sr-only usage hint (`#reorder-hint`) and `aria-keyshortcuts`.
- **Item 11 state is a per-viewer convenience** (localStorage, guarded by `Result.try`), not shared data; collapsing never hides totals or the overspent count.
- **Item 8:** `InlineName` keeps the pending name visible while the save is in flight, ignores an older save that lands after a newer one, and reopens with an alert on failure. The old `RenameDialog` and `RenameTarget` type were deleted in the same change (Migrate Callers Then Delete Legacy APIs).
- `SelectField` gained an optional `onclosed` (bits-ui `onOpenChangeComplete`) because the Select returns focus to its trigger after it closes, which would otherwise steal focus from the newly revealed `Group name` field.

### Changed files

- New: `src/lib/components/budget/{assign-target-button,month-picker}.svelte`, `src/lib/components/categories/inline-name.svelte`, `src/lib/reorder.ts`
- Deleted: `src/lib/components/categories/rename-dialog.svelte`
- Changed: `src/lib/budget.svelte.ts`, `src/lib/components/budget/{add-category-dialog,assigned-input,budget-table,category-inspector}.svelte`, `src/lib/components/categories/types.ts`, `src/lib/components/select-field.svelte`, `src/lib/components/ui/table/{table-row.svelte,table-variants.ts}`, `src/routes/(app)/+page.svelte`, `src/routes/(app)/categories/+page.svelte`
- Journeys: `e2e/journeys/{budget,categories,inspector,targets}.ts` (new `budget/month-jump`, `budget/phone-groups`, `categories/reorder`, `inspector/cover-and-manage`; rewritten `categories/manage`, `categories/late-rename`, `inspector/move-money`, `targets/monthly` funding step; `budget/needs-you` selectors)
- Feature maps: `.agents/skills/verify-budge/features/{README,budget,categories,inspector,targets}.md`

### Checks

- `bun run check` pieces: `codegen:check`, `format:check`, `lint`, `lint:ui`, `typecheck` (0 errors, 0 warnings), `test` (58 files, 924 tests) all exit 0; `capacity:check` exit 0 against a briefly started local backend (it fails with ECONNREFUSED when no backend runs).
- Real app (`bun run app up`, `doctor`, `login`, `seed budget-with-accounts`, `verify`, `down`):
  - `ux01-a`: first run, 6/11 pass. Failures were real: month picker focused the first month instead of the chosen one; `Group name` not focused after choosing `New Category Group…`; journeys used `combobox` for the picker trigger (a button) and an exact toggle name that ignores the collapsed `N overspent`. All fixed.
  - `ux01-b`, `ux01-c`: the five fixed journeys pass.
  - `ux01-full`: all 60 journeys pass (`summary.json` result `passed`, 0 failures).
  - Screenshot review then found 320 px group names breaking letter by letter; fixed (see Item 1 decision). `ux01-d` (8 Budget/phone journeys) and `ux01-e` (`budget/phone-groups`, `budget/needs-you`) pass on the final table code. `phone-groups` now also asserts the `$X assigned` line on a collapsed group.
- Negative cases persisted in journeys: empty rename refused; Escape keeps the name; empty `Group name` keeps the dialog open; empty move amount refused with nothing moved; months before the first budget month disabled; keyboard reorder at a group edge is a no-op with focus kept; an older rename landing late does not win.

### Evidence (absolute paths)

- `/home/lomzem/.t3/worktrees/budge/t3-0383bc99-0c2aaafa4fd2d5e6/test-results/verify-budge/ux01-full/summary.json` (60/60)
- `/home/lomzem/.t3/worktrees/budge/t3-0383bc99-0c2aaafa4fd2d5e6/test-results/verify-budge/ux01-e/budget/phone-groups/` (320 px collapse, final table)
- `/home/lomzem/.t3/worktrees/budge/t3-0383bc99-0c2aaafa4fd2d5e6/test-results/verify-budge/ux01-full/budget/month-jump/`
- `/home/lomzem/.t3/worktrees/budge/t3-0383bc99-0c2aaafa4fd2d5e6/test-results/verify-budge/ux01-full/categories/reorder/`
- `/home/lomzem/.t3/worktrees/budge/t3-0383bc99-0c2aaafa4fd2d5e6/test-results/verify-budge/ux01-full/inspector/cover-and-manage/`
- Failed first attempt kept: `/home/lomzem/.t3/worktrees/budge/t3-0383bc99-0c2aaafa4fd2d5e6/test-results/verify-budge/ux01-a/`

### Test-audit authoring gate

- Each new journey guards one user-visible contract the existing ones miss: month-jump (heading picker + first-month boundary), phone-groups (Assigned editable at 320 px; collapse keeps totals/overspent cue and persists), reorder (keyboard and pointer reorder persists to Budget), cover-and-manage (cover from a Category keeps Ready to Assign; manage actions from the inspector). Changed journeys follow changed contracts (in-place rename, From/To form, table Target button).
- Credible regressions each one catches: the first-month guard dropped; collapse hiding totals; order not saved; cover drawing from Ready to Assign; a late rename winning. `ux01-a` showed four journeys failing on real defects before the fixes.
- No test-only seams: `data-reorder-item` is read by the production drag code; `data-category-id` already existed. No unit test for `moveInList`: the reorder journey drives it through the handle and checks the stored order, so a unit test would duplicate that proof.
- Baseline: on `b1537fa` these features do not exist, so the new journeys fail at their first interaction by construction; not run separately.

### Principles that changed a choice

- **Make Operations Idempotent:** item 7 retry reuses the group already created instead of creating another.
- **Migrate Callers Then Delete Legacy APIs:** `RenameDialog`, `RenameTarget` and Move up/Move down were removed in the same change as their replacements.
- **Prove It Works:** reviewing the screenshots after a green 60/60 run found the 320 px group-name breakage, which was fixed and re-verified; `hyphens-auto` was dropped because the verification browser could not show it working.
- **Test Behavior, Not Implementation:** journeys assert stored outcomes after reload (order, Assigned, Ready to Assign, names) rather than intermediate UI state; no `moveInList` unit test.

### Ownership and cleanup

- App started and stopped by this run only (`bun run app down`; `.local-app/running.json` absent afterwards). Parent checkout untouched. No push, PR or external messages.

### Remaining risks and work for the parent

- Local `code-review`, `/correct` and the three-judge UI gate have not run (subagents were out of scope for this worktree).
- Touch drag is proven only through mouse pointer events; a real touch or emulated-touch drag remains a manual check.
- Long single-word Category names wrap mid-word at 320 px because Assigned now stays in the table.
- Moving a Category into a collapsed group hides its row (the group's totals still change).
- `DeleteCategoryDialog` opened from the inspector unmounts with it after a successful delete (focus goes to `#main`, which `cover-and-manage` checks).
- Cross-group drag is not offered; `Move to group` covers it.
