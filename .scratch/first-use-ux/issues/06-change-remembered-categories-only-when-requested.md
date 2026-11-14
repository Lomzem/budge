# 06: Change remembered Categories only when requested

**Status:** done

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 05 — adds the explicit remember choice to the new editing interaction.

Deliver: a one-off Category edit changes that Transaction only. An explicit separate remember choice sets the Payee's Category for later imports. Future imports remain reviewable. Apply the same meaning to existing edit paths so the result does not depend on which control was used. Keep current remembered choices usable. Make selection of a default deliberate when first categorizing a new Payee; do not silently treat every edit as a new default.

Proof: extend the production owner test sequence: set remembered Category, edit an exception, import again; then explicitly change the remembered Category and import again. Assert real imported/persisted outcomes with independent expected Categories. Browser proof owns the explicit choice and save interaction; it does not repeat the import-owner matrix.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Landed 2026-11-13 (commits 4654a23..f29238b on `feat/first-use-ux`)

**Decisions**

- **The write owner states the policy.** `saveTransaction` in `convex/lib/transactions.ts` now takes a required `{ approve?, rememberCategory }`. Every writer has to say whether a save remembers, and `rememberPayee` writes the Payee's Category only when it does. Rename memory (Bank Text to Payee) is unchanged. Tickets 07 and 08 reuse this option.
  - `transactions.create` and `update` take `rememberCategory`.
  - `transactions.categorize`'s Category choice takes `remember`.
  - Each defaults to a one-off.
  - Taking the bank's version (`bankChanges.takeBankValues`) and the seed's owner edits pass `false`. Before this, taking the bank's version silently made the Transaction's Category the Payee's default.
- **Refusal.** Remembering when the result has no Payee or no Category (a blank Payee, a Transfer, a split, a Starting Balance) is refused with `INVALID_INPUT`.
- **Rows carry the memory.** Each list row has `rememberedCategoryId` (through `lastCategoryOf`, so a deleted Category or a Payment Category reads as none). The row picker uses it to say what is remembered.
- **One meaning, two controls.** Both controls use the shared `src/lib/components/remember-choice.svelte`: a Checkbox `Remember for <Payee>’s later imports`, whose description is `Remembered now: <Category>.` or `Nothing is remembered yet.`.
  - **Row picker.** The checkbox sits at the foot of the open `CategoryPicker` (new optional `remember` prop; `onValueChange(value, remember)`). It resets on each opening.
    - While it is checked, only Categories can be picked.
    - Picking the row's current Category again with it checked remembers it. Otherwise a same pick is still a no-op.
    - The announcement becomes `<Category> saved and remembered for <Payee>`.
    - The row offers it unless the row is a split, has no Payee, or is a Starting Balance.
    - Keyboard path: ArrowDown opens the list, Shift+Tab reaches Remember (the trap cycles; plain Tab first stops on the scroll viewport), Space checks it, Tab returns to the search, and Enter picks.
  - **Dialog.**
    - `Draft.remember` drives the checkbox under the Category field, and `View.remembering` decides whether it is offered.
    - When the chosen Category is already the remembered one, the dialog shows `<Category> is remembered for <Payee>’s later imports.` instead.
    - The `payees.lastCategory` lookup now runs for any nonblank Payee (`memoryQuery`). Prefill still runs only under the old recall conditions (`recallQuery`).
- **A new Payee is never remembered silently.** The checkbox is always unchecked to start, so a new Payee's first Category is a default only when the owner checks Remember.

**Changed files**

- Server:
  - `convex/lib/transactions.ts`
  - `convex/transactions.ts`
  - `convex/lib/transactionRows.ts`
  - `convex/lib/bankChanges.ts`
  - `convex/seedBankSync.ts`
- UI:
  - `src/lib/components/remember-choice.svelte` (new)
  - `src/lib/components/category-picker.svelte`
  - `src/lib/components/transactions/{categoryChoices.ts,transaction-dialog.svelte,transaction-table.svelte}`
  - `src/lib/transactionEditor.ts`
- Tests:
  - `convex/payees.test.ts`
  - `convex/transactions.test.ts`
  - `convex/imports.test.ts` (its setup now remembers explicitly)
  - `src/lib/transactionEditor.test.ts` (fixture field)
  - `e2e/journeys/payees.ts`
- Map: `.agents/skills/verify-budge/features/payees.md`

**Tests (red, then green)**

Evidence is under `test-results/`.

- **Owner sequence** (`convex/payees.test.ts`, `describe.each` over `transactions.update` and `transactions.categorize`). The steps are: one-off, then remember, then exception, then explicit change, with an import after each. Expected Categories are written by hand, and every import stays Unapproved.
  - Red before the fix, on both controls: a one-off made the next import arrive categorized (`ticket-06/owner-red.txt`).
  - Green: `ticket-06/owner-green.txt`.
  - A probe that always remembers fails 3 tests (`owner-probe-always.txt`).
  - A probe that never remembers fails 8 tests (`owner-probe-never.txt`).
  - The old always-remember tests were replaced. Remaining memory tests now remember explicitly.
- **Refusal row** (`convex/transactions.test.ts`, remember for a blank Payee): red with the guard removed (`ticket-06/refusal-red.txt`), then green.
- **`payees/remember` journey.**
  - Red against the server-only UI, with no checkbox (`verify-budge/t06-remember-red`).
  - Red with the dialog ignoring the checkbox: the Florist stays Uncategorized (`t06-red-dialog-ignores`).
  - Red with the row dropping a same-Category remember: `saved for` instead of `saved and remembered for` (`t06-red-row-same-pick`).
  - Green: `t06-remember-2` and `t06-final`.

**Checks**

- `bun run check` passed in a temporary worktree, with capacity:check: 905 tests (`ticket-06/check.log`).
- Affected journeys:
  - At the server commit: 8 passed (`t06-server`).
  - With the UI: 16 passed (`t06-ui-affected`).
  - Final at f29238b with no uncommitted changes: `t06-final`.
- Hooks (Prettier, ESLint, gitleaks) passed on both commits.
- Full `bun run test:e2e:local` at f29238b: 52 passed (9.9 min) (`test-results/ticket-06/e2e.log`).
- The app was stopped (`app down`) and the worktree removed.
- `code-review` and `/correct` were not run, as the brief requires.

**Open questions**

1. GLOSSARY.md has no term for a Payee's remembered Category. Should `domain-modeling` add one?
2. With the row picker open, Tab first stops on the list's scroll viewport, so Remember is reached with Shift+Tab. Is that acceptable?
3. Choosing Remember with Uncategorized or a Transfer is not offered. Should "forget this Payee's Category" be a separate choice later?

### Review fixes 2026-11-13 (commits 8b8573d..f7f8094 on `feat/first-use-ux`)

Review: `.scratch/first-use-ux/reviews/06/review.md` (no production defect; one P3). The owner's decisions are binding.

**P3: the rename-memory recipe still expected automatic Category memory. Fixed** (f0bebbb).

- `.agents/skills/verify-budge/features/payees.md` (Rename memory): to expect Groceries on the next import, the recipe now checks `Remember for Sample Verification Shop’s later imports` before Save. A separate branch keeps the claim that renaming alone remembers the Bank Text. It renames `SAMPLE MEMORY 9002` to `Sample Verification Kiosk` with Groceries and Remember left unchecked, and the next exact-text import must show the Kiosk with Uncategorized.
- Driven in the browser rather than only traced (scripts kept in `test-results/ticket-06-fix/`). Each Payee was imported, edited, re-imported with the same Bank Text and a different amount, then reloaded:
  - Shop, Remember checked: both rows Groceries.
  - Kiosk, unchecked: the edited row Groceries, the new import Uncategorized under the friendly Payee.
  - Evidence: `test-results/verify-budge/t06-fix-rename-recipe-2`. The first attempt, `t06-fix-rename-recipe`, reused an amount and hit duplicate detection; that was the script, not the app.

**Glossary: Remembered Category added** (8b8573d), through `domain-modeling`.

- The definition: the Category chosen for a Payee, which fills later imports and new Transactions entered for it, changes only on an explicit remember, never through a one-off edit, and so need not be the Payee's latest Transaction's Category. Imports it fills are still Unapproved.
- _Avoid_: Last Category, default Category.
- No field, API or UI copy was renamed.

**Forward Tab order: proved, and the list's focus ring fixed** (f0bebbb, f7f8094).

- **Probe (1280×800, row picker on Sample Landlord):**
  - Forward Tab from the search: the list's scroll viewport, then Remember, then back to the search.
  - Shift+Tab reverses the same path. Every stop matched `:focus-visible`.
  - Evidence: `test-results/verify-budge/t06-fix-tab-probe-2`.
- **Defect found: the ring on the list stop was clipped.** It drew 2 px outside the viewport and was cut off by the popover, so only a faint line under Search showed (`t06-fix-tab-probe-2/zoom-1.png`).
- **Fix:** `src/lib/components/ui/command/command-list.svelte` gives its viewport `focus-visible:-outline-offset-2`, matching the standalone ScrollArea. The ring now draws fully around the list (`t06-fix-tab-probe-3/zoom-1.png`; Remember's ring is in `zoom-2.png`). The category picker is the only user of the Command list.
- **Journey.** `payees/remember`'s keyboard step now uses the forward path: ArrowDown, Tab (focus is in the `Choices` listbox), Tab (Remember focused), Space, Shift+Tab (in the list), Shift+Tab (search), Enter. The old Shift+Tab-from-search shortcut assertion was replaced; the trap still cycles that way. The feature map's journey line was updated.
- **Red/green.** The fault was a Tab handler on the list that sent forward Tab back to the search, skipping Remember; it was reverted.
  - The previous journey still passed under the fault: `test-results/verify-budge/t06-fix-fault-old-journey`. It proved only the reverse shortcut.
  - The new journey failed at `Remember … toBeFocused`: `t06-fix-fault-red`.
  - With the fault reverted it passed: `t06-fix-forward-green`.
  - Visible focus is proved by the screenshots, not asserted. A pixel or computed-style assertion would pin styling.
- **Test-audit gate.**
  - Contract: forward and reverse keyboard reach of Remember in the open row picker.
  - Regression: a focus trap that loops the list back to the search.
  - Why existing proof missed it: it drove only Shift+Tab from the search.
  - The owning journey step was extended, with no new test and no seam.

**Forget a Remembered Category: deferred to a later ticket. No code.**

- Uncategorized and a Transfer are choices for one Transaction. They must not silently clear a Payee's memory, so Remember stays unavailable for them.
- Forgetting is its own user action. It should leave historical Categories untouched and make later imports Uncategorized. It needs its own scope and proof.
- Nothing in tickets 07 or 08 depends on it.

**Checks**

- `bun run check` in a temporary worktree, with capacity:check: exit 0, 58 files and 905 tests (`test-results/ticket-06-fix/check.log`).
- Affected journeys, all passed (`test-results/verify-budge/t06-fix-affected-2`): payees/last-category, payees/remember, transactions/create, late-save, categorize, categorize-late, approve-all-undo, approve-phone.
- Prettier, ESLint, shadcn-lint and gitleaks hooks passed on each commit.
- Full `bun run test:e2e:local` with the content of f7f8094: 52 passed (7.3 min) (`test-results/ticket-06-fix/e2e.log`).
- The local backend started normally; the reviewer's DNS `EAI_AGAIN` did not recur. The app was stopped (`app down`) and the worktree removed.

**Open question**

1. The glossary now avoids "Last Category", but UI copy still says `Looking up the last Category…`, `Budge couldn't look up this Payee's last Category…`, and the `payees/last-category` journey title uses it too. Should that copy say "Remembered Category" in a later ticket? It was left alone here, as the owner asked for no renames.
