# Spec review — Budget/Categories

Reviewed `git diff b1537fa...52e699e` at clean pinned HEAD `52e699e2a352a89d3792c248c382f7ff0c01b680` (one commit), against items 1–12.

- **P2 — Item 2 excludes overspent Categories.** Spec: “Assign the needed Target amount directly from the budget table without opening the inspector.” `src/lib/components/budget/budget-table.svelte:78` explicitly requires `category.status !== 'overspent'`, even when `target.needed > 0`. The same funding action remains available in `category-inspector.svelte:397`. An overspent Category with an unmet Target therefore still requires the inspector. Remove the exclusion or provide an equivalent table action.

- **P2 — Item 8 can erase a rename being typed.** Spec: “Rename Categories and Groups in place.” In `src/lib/components/categories/inline-name.svelte:33`, the reactive effect resets `draft` from `pending ?? name` whenever those values change while editing. Commit name A, reopen during its pending save, and type B without submitting. When A completes, `save()` clears `pending` at line 45, triggering the effect and replacing B with A. Initialize the draft on entering edit mode without resynchronizing over active edits. `e2e/journeys/categories.ts:280` submits B before releasing A, so its late-response test misses this case.

- **P2 — Item 9 lacks touch access to off-screen reorder destinations.** Spec: “Directly reorder Categories and Groups … keyboard and touch access required.” `src/lib/reorder.ts:47` snapshots item centers; lines 65–77 only translate by pointer displacement, with no edge scrolling. `src/routes/(app)/categories/+page.svelte:143` disables native touch scrolling on the handle; it offers no tap destination alternative. With two Groups each taller than the phone, the next center can require more displacement than the screen permits, so the first Group cannot move past it by touch. Add working edge scrolling or a direct touch alternative. The journey uses keyboard at 320px and mouse drag at 1280px (`e2e/journeys/categories.ts:204`, `:235`).

No unasked scope expansion found. Items 3–7 and 10–12 have matching source paths; Group retry retains the created ID. Committed latest-rename persistence is distinct from the draft-loss issue above.

**Checks/limits:** source and changed journeys inspected; no app, browser, full suite, source edits, or commits. Final 320px amount/control legibility and real touch behavior require parent verification.

**Principles applied:** Experience First exposed unreachable touch destinations; Prove It Works favored actual paths over ticket claims; Test Behavior, Not Implementation identified the missing typing-in-progress scenario. Guard the Context Window kept review scoped to this commit.
