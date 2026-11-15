# Ticket 01 Standards, test-audit and analysis-only corrections

Review target: `52e699e`; sole implementation commit in `git diff b1537fa...52e699e`. Original checkout: `/home/lomzem/.t3/worktrees/budge/t3-0383bc99-0c2aaafa4fd2d5e6`. Sources stayed unchanged. No parent-checkout inspection, app/browser launch, commit or delegation.

## Standards summary (under 400 words)

**Request changes. Five findings; none concerns a tooling-enforced rule.**

1. **S1 · P2 · Pending rename replaces a newer draft.** `src/lib/components/categories/inline-name.svelte:33–50`: save A, reopen, type B without submitting, then settle A. Clearing `pending` reruns the editing effect and resets B; failure explicitly assigns A again. `latest` protects later saves, not later editing. Violates Experience First's polished core workflow and Model the Domain's ownership of lifecycle state. Snapshot on editor entry; preserve a newer draft across older settlement.
2. **S2 · P2 · Interrupted reorder commits or leaves visual state behind.** `src/lib/reorder.ts:80–112` registers cancellation as successful release; teardown only removes listeners. A focused call of the actual attachment reproduced a move on `pointercancel` and surviving transforms on detach. Violates Experience First's interaction details and Model the Domain's lifecycle discipline. Distinguish commit from cancel; reset all owned styles/capture on cleanup.
3. **S3 · P2 · New-Group submission consumes later edits.** `src/lib/components/budget/add-category-dialog.svelte:65–76` reads Category `name` after awaiting Group creation; editable fields can change meanwhile. Capture the submitted names before the await. Violates Model the Domain and Boundary Discipline: a command should have an established typed input, rather than reading mutable form state between effects.
4. **S4 · P2 · Two new checks miss the contract they claim.** `e2e/journeys/categories.ts:99–103` submits with both names empty, so Category Name can block the request even if Group-name validation breaks. `e2e/journeys/inspector.ts:168–185` accepts any positive cover prefill and only checks that overspending disappears; excessive covering passes. Violates test-audit's intended-guard and independent-expected-value requirements. Strengthen these existing owner journeys.
5. **S5 · P2 · Month journey depends on the current calendar month.** `e2e/journeys/budget.ts:250–278` asks for the prior year's button in January–March without changing the shown year; in February its later ArrowLeft starts on January. Violates test-audit proof guide's controlled-clock/reproducible-proof requirement. Exercise the first-month boundary in its year and choose an interior grid month for the keyboard step.

**Judgment-call smells:** no additional baseline smell warrants an independent finding. The shared Target button and deleted RenameDialog reduce duplicated behavior. Do not add abstraction simply to shorten the inspector or combine its short error handlers.

## Evidence and focused checks

### S1: latest save is not latest edit

- The `$effect.pre` reads `editing`, `pending`, and (when pending is null) `name`, then assigns `draft` (`inline-name.svelte:33–38`). The user can reopen the editor while `pending` is non-null.
- `save` clears `pending` at line 45 even when that editor contains a newer unsubmitted draft. The effect resets the draft. A failed save also writes `draft = next` at line 49.
- Existing `categories/late-rename` submits the second name before releasing the first response (`e2e/journeys/categories.ts:281–315`), so its `latest` guard succeeds while this case remains untested.
- Required owner proof: hold save A; reopen and type B without Enter; release A; B and focus must remain. Include the old-save failure path without fabricating a successful persistence receipt. This finding is from source; no browser reproduction was permitted in this review.

### S2: actual attachment probe

Ran Bun with `--no-env-file`, importing the production `reorderHandle`. A small EventTarget/HTMLElement adapter supplied three real input boxes at y=0/40/80, height 40. Dispatching down at y=20 and move at y=100, then cancel or detach, gave:

```json
{"case":"cancel","moves":[1],"transforms":["","",""],"dragging":[false,false,false]}
{"case":"detach","moves":[],"transforms":["translateY(80px)","translateY(-40px)",""],"dragging":[true,false,false]}
```

The adapter does not implement reorder decisions; those outputs came from the production attachment. This proves its event and disposal behavior, not a physical touchscreen journey. A refreshed query can retain keyed rows while updating attachments; cleanup must restore the styles it owns. Track the active pointer so another pointer/cancellation cannot finish its drag, and handle lost capture as cancellation. A focused owner regression should assert unchanged persisted order after interruption, plus restoration after an attachment is replaced. Do not add an internal `moveInList` test duplicating the existing successful reorder journey.

### S3: command input changes during the command

The Group request takes `groupName` at line 72. After it settles, lines 73 and 76 read the then-current `groupName` and Category `name`; only the Add button is disabled (`add-category-dialog.svelte:129`), while both inputs remain editable. Thus typing a different Category name during that await changes the saved Category without submitting that draft. Snapshot the submitted values before invoking `dialog.run`; use the snapshot for both mutations and the retained Group label. `DialogSession` scopes completion delivery, but does not freeze variables captured by the work callback.

Retry handling has a useful narrow property: after Group success and Category failure, `created` and `groupId` retain that Group for a retry in the same opening. There is no journey proving that failure path. Recovery after closing/reloading between the two mutations remains an explicit unresolved design question; this review does not claim server-level idempotency or demand a backend API change without Opus's decision.

### S5: deterministic calendar analysis

The picker opens in the selected month's year (`month-picker.svelte:65–66`) and only renders that year's twelve buttons. Source-derived date calculations gave:

| Current month | `monthName(-3)` | In open grid? | Month where later ArrowLeft starts |
| --- | --- | --- | --- |
| January 2027 | October 2026 | No | December |
| February 2027 | November 2026 | No | January (no previous button) |
| March 2027 | December 2026 | No | February |
| November 2027 | August 2027 | Yes | October |

This identifies a journey defect, not a requirement that grid arrows wrap between years. Keep boundary semantics in `BudgetMonth.goTo` and the disabled picker controls. Add boundary/focus coverage through the existing journey rather than source assertions. The feature map currently says the journey exercises `Previous year` (`features/budget.md:35`), while it clicks `Previous month`; align that description with the repaired journey.

### Commands and recorded evidence

- `git diff --check b1537fa...52e699e`: exit 0.
- `bun run test scripts/app/featureMap.test.ts e2e/journeys.test.ts`: exit 0, **one Vitest file / three tests**, 690 ms runner duration. Only the feature-map tests ran; `e2e/journeys.test.ts` belongs to Playwright and was not selected by Vitest. This is metadata proof, not UI proof.
- The actual-attachment event probe above: exit 0. No source/test files were created for it.
- Confirmed `.local-app/running.json` absent. No process lifecycle operations were performed.
- Read `test-results/verify-budge/ux01-full/summary.json`: 60 journeys recorded passed; the 11 Budget/Categories/Inspector/Targets journeys' referenced screenshots and ARIA captures exist. Also read `ux01-e` (2 passed) and `ux01-f` (1 passed). These summaries identify `b1537fa` plus uncommitted changes, so **they do not independently pin the tested tree to 52e699e**. This review did not rerun browser checks. `ux01-a` retains five actual failures; two are product-focus failures and three are selector failures, rather than five proven product defects.

## Test-audit appendix

Retain the new journeys: they use the public user interface, add distinct interaction/lifecycle contracts, and generally assert persistence after reload. `data-reorder-item` is used by production, so it is not a test-only seam. Comparing totals before and after collapse is valid preservation proof, not a vacuous self-comparison.

| Owner journey | Existing meaningful proof | Gap / proportionate action |
| --- | --- | --- |
| `categories/manage` | Add from Budget Group, create Group+Category and reload; category/group rename; invalid rename; focus; hide/delete | S4: fill valid Category Name before testing empty Group name; check the intended invalid field. Add one real Group-success/Category-failure/retry case if retaining this two-step operation. |
| `categories/late-rename` | Two submitted saves, older response does not replace newer name; reload | S1: add the unsaved second-draft lifecycle case. Existing two-save proof remains independently useful. |
| `categories/reorder` | Concrete keyboard category order, keyboard Group move, boundary no-op, focus, desktop mouse category drag; reload and Budget | No touch drag, cancellation, teardown, or pointer Group drag. Feature map honestly labels touch as manual. Exercise required touch behavior and S2 without replaying the same algorithm in unit tests. |
| `budget/phone-groups` | Table Assigned changes Ready to Assign by exactly $5 and persists; collapse preserves totals and reload state; Needs you expands Group | Retain. The overspent count is only checked as a positive integer, not the correct count; derive expected count from the independently visible overspent categories if strengthening this contract. |
| `budget/month-jump` | Heading focus, disabled boundary, month selection focus return, URL/reload, one-month arrow, keyboard choice | S5: remove current-month-dependent assumptions. Also exercise the first-year stepper bound. |
| `inspector/move-money` | Independently expected ±$10 effects on both Categories, Ready to Assign unchanged, searchable choice, swapped direction, amount refusal | Retain. Existing negative starts after a successful choice and clears Amount, so it reaches its intended guard. |
| `inspector/cover-and-manage` | Cover persists and preserves Ready to Assign; rename/refocus; regroup; hide/delete and reload | S4: read the initial negative Available independently, assert prefill equals its exact negation; after save assert target zero and donor's exact decrease. Deletion step says history moved to Coffee, but only proves Dining Out disappeared; existing backend history ownership does not prove this new inspector passed the right destination. Either narrow the title or inspect the resulting user-visible history. |
| `targets/monthly` | Known $25 target, exact Assigned delta, table action removal, focus, persisted amount | Retain. This is distinct table interaction proof; no need to duplicate it with an internal component test. |

No tests were removed or changed. New journeys were not run on the baseline by the implementor; the ticket explicitly says the baseline failure was inferred from absent controls. Do not call that an observed red run. The retained `ux01-a` failures demonstrate some real pre-fix focus problems, but do not establish the untested guards/retry/cancellation cases above.

## Analysis-only /correct appendix

Two recurring classes have at least two actual historical examples. Proposed enforcement is for Opus to decide; nothing was implemented.

### C1: an asynchronous completion owns more state than the interaction that started it

Historical evidence, inspected in actual diffs:

1. `9db39a9`, `assigned-input.svelte`: added a `latest` ticket and compared against pending `sent`, repairing the case where an earlier Assigned save could clear a newer edit. Its `budget/assign-back` journey holds the first save, types the old amount back, then checks exact amounts after reload.
2. `92837d3`, `transaction-table.svelte`: moved the latest-pick check to immediately after `await linksAnImport`, before both branches, so a superseded lookup cannot save or open a dialog. Its `transactions/categorize-late` journey withholds the lookup, chooses a new Category, then lands the old lookup and checks persistence.
3. `8b632af` and `4702f1d` independently fixed stale bulk-save selection/focus and stale Bank card result/focus ownership. These corroborate the class; a global shared object would not be appropriate because those surfaces own different state.

Current instances: S1 and the mutable submission input in S3. **Strongest proportionate level: local architecture.** Make the reusable in-place editor own explicit editing transitions and a revisioned submitted snapshot; initialize drafts on editor entry rather than through an effect subscribed to persistence. A settlement may clear its own pending operation, but must not overwrite a newer editor revision. Capture Add Category's command input before its first effect. Types should distinguish current draft from submitted snapshot inside the owner; avoid a repository-wide generic async framework or instruction-only rule.

Past-mistake proof: retain and rerun `budget/assign-back` and `transactions/categorize-late` on their actual parent/fix pairs when changing those owners; they demonstrate the two historical failures at the user boundary. For this ticket, hold A, start B without submitting, land A and verify B survives; hold Group creation, edit the form and verify the submitted snapshot determines the created records. Demonstrate red on 52e699e and green after repair. No identifier/source-grep rule would prove this ownership contract.

### C2: a journey observes a state other than the scenario its claim requires

Historical evidence, inspected in actual diffs:

1. `789022e`, `transactions/approve-all-undo`: replaced immediate Unapproved-row reads with a settled count check; otherwise it captured a partial list and could draw the wrong conclusion about which rows were outside the filter.
2. `b1d8bdf`, `transactions/select-categorize`: added the observable absence of the bookshop after changing Search before checking the Split; otherwise it acted before the intended filtered scenario existed.

Current instances: S4's unrelated invalid Name field and insufficient exact-cover expectation; S5's absent month buttons are another scenario-precondition mismatch. **Strongest proportionate level: behavior tests at the existing journey boundary.** Set valid neighboring inputs, assert the intended invalid field, observe asynchronous preconditions before snapshots, and calculate monetary expectations from the requirement and independently observed starting balances. Keep one primary owner for each contract. A type/lint cannot establish that an arbitrary prose claim matches a user scenario; generic mandatory wrappers would add seams while leaving weak assertions possible. Keep this as an explicit test-audit judgment gate with these concrete examples, rather than inventing source checks or a new testing framework.

Past-mistake proof: run the original and corrected historical journeys with the relevant transition delayed through the existing transport seam; the old journey must observe or act on the premature scenario while the corrected journey waits for the intended state. These historical commits repair tests, so simply running the corrected journey on the old product would not prove the old test wrong. If the original timing cannot be forced, report that baseline limitation. For the current negative, a mutation removing only Group-name validation must fail the repaired field-specific assertion while Category Name stays valid. For cover, changing prefill to shortfall plus $1 must fail its exact expectation. These are proposed proof runs, not runs performed here.

No broader recurring class is claimed for pointer teardown or two-step Group recovery: this review did not establish two historical occurrences. Repair the concrete defects without inventing history or expanding the enforced-rule table.

## Principles and open work

- **Test Behavior, Not Implementation / Prove It Works:** retained meaningful reload and monetary-delta checks; distinguished recorded browser evidence from a fresh pinned run; used the actual attachment for the bounded event probe; identified the invalid-field and exact-cover gaps.
- **Model the Domain / Minimize Reader Load:** recommends explicit editor/drag lifecycle ownership and immutable submission snapshots, instead of more synchronized booleans or a global mechanism.
- **Laziness Protocol / Foundational Thinking:** recommends extending existing public journeys and local owners; no duplicate algorithm tests, generic async framework, or extraction based only on file size.
- **Make Operations Idempotent:** recognizes same-opening Group reuse, but leaves crash/reopen recovery unproven and assigned to Opus for a deliberate disposition.
- **Encode Lessons in Structure:** correction recommendations use local state ownership first, tests where intent cannot be encoded, and do not duplicate already enforced lint/type rules.
- **Guard the Context Window:** review stayed on one pinned implementation and bounded historical examples; no mutable integration-source investigation or full-suite/browser run.

Read in full: all principles requested in the brief, plus triggered `make-operations-idempotent.md`, `separate-before-serializing-shared-state.md`, `foundational-thinking.md`, and `build-the-lever.md`; code-review, test-audit and correct skills, test-audit proof/audit references, repository AGENTS/CLAUDE/domain/issue-tracker guidance, glossary, ADR 0002, spec, ticket 01 and verify-budge instructions. ADR 0002's money-source/cache rule is unchanged by this UI-only implementation; no ADR conflict identified.

Remaining: Opus dispositions/fixes for S1–S5; realistic retry/touch coverage; refreshed feature map; feature checks and three-judge reviews pinned to the final integrated revision. This report does not declare the ticket or UI gate complete.
