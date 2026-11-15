# Repair Standards recheck

Reviewed `git diff 9f41ec1...cec8434`, commit `cec8434cbd7cc2d09a614fa1cb5989e3af5b45de` (repair cherry-pick). HEAD advanced to documentation-only `73481ac`; the reviewed source, journeys and Categories feature map remain identical. No source edits, commits, delegation, app/browser operations, full suite or sync. This report is the only file written.

## Standards (under 400 words)

**No findings. Standards findings 1–3 are resolved in the pinned repair.** Tooling-enforced rules excluded; no additional judgment-call baseline smell warrants change.

1. **Resolved — failed rename editor ownership.** `src/routes/(app)/categories/+page.svelte:61–69` leaves the shared editor with its current owner when a failed save requests reopening. Explicit user opens still select their row (`:167–169`). `src/lib/components/categories/inline-name.svelte:39–42,53–59,117–120` retains the failed submitted name/error, displays the failure beside its persisted name when another row owns editing, and restores the failed name on the next opening. This preserves the newer editor and provides retry without a generic coordination framework. The inspector's existing single-editor binding remains compatible.

2. **Resolved — pointer ownership.** `src/lib/reorder.ts:137–145,163–173` filters pointer cancellation/lost capture by the owned pointer ID while keeping Escape and disposal unconditional. Direct execution of the production attachment confirms foreign interruptions preserve its eventual drop and owned interruptions cancel it; cleanup leaves no capture, frame, transform or dragging marker.

3. **Resolved — coverage description.** `.agents/skills/verify-budge/features/categories.md:23–25` correctly names 320px touch, retained cancellation/Escape/second-finger checks and the failed-rename journey. It explicitly excludes owning-pointer lost capture, page departure and native gesture cancellation from maintained journey coverage. Browser coverage for those excluded cases is not inferred from the attachment probe.

## Test-audit and evidence

- **Failed rename:** `e2e/journeys/categories.ts:546–628` owns cross-row failure, draft/focus retention, accessible error, retry and persisted-name assertions. Same-row successful settlement remains separately owned by `late-rename`. Credible regression: unconditional reopening replaces Coffee's draft. No duplicate private-helper proof.
- **Failure boundary:** `e2e/heldResponse.ts:130–182` intercepts only the first named mutation, does not send that request to the server, and injects `MutationResponse` with `success:false`. This is a synthetic transport failure, not an actual backend execution. Its shape matches installed Convex's `MutationFailed` (`node_modules/convex/src/browser/sync/protocol.ts:282`); failures resolve without a success timestamp/receipt (`request_manager.ts:139–161`). Subsequent saves reach the real server; reload asserts real persistence. No production test seam or fabricated success.
- **Reorder:** `categories.ts:362–435` requires visible displacement before cancellation, restored geometry/order afterwards, and an exact changed order after the second finger lifts; reload/Budget assertions retain persistence proof. The distinct Escape and browser touch paths justify separate steps. The second-finger sequence explicitly ends finger 2 (`:425`), rather than merely omitting it from a move.
- Inspected implementor artifacts under `/home/lomzem/.t3/worktrees/budge/t3-70d3dfa3-145e8cc7c58da72e/test-results/verify-budge/`: `red-1` failed at cross-row recovery; its ARIA shows Groceries reopened and Coffee's draft absent. `red-2` failed the corrected second-finger step with Coffee unmoved. `final-repeat` ARIA retains Coffee's draft beside Groceries' alert; both journeys pass. `final-focused` records 12 passes. These are inspected historical artifacts, not fresh browser runs or proof of an exact committed checkout (summaries record base plus uncommitted changes).

## Fresh checks

- `bun run test scripts/app/featureMap.test.ts`: 1 file, 3 tests passed; 682ms runner duration. This validates map inventory, not every prose coverage claim.
- `git diff --no-ext-diff --check 9f41ec1...cec8434`: passed.
- Bounded production-attachment probe using an EventTarget/HTMLElement geometry/capture adapter: three rows at y=100/140/180, pointer 1 down at 120 then move to 210. Control and foreign pointercancel/lostcapture each commit destination 2; own pointercancel/lostcapture, Escape and disposal commit nothing. All seven cases leave zero frames/capture/transforms/dragging markers. The adapter supplies browser mechanics, no reorder/cancellation decisions; it does not prove browser-generated event order or physical touch behavior.

## Principles and remaining scope

**Model the Domain / Experience First** made shared editor and pointer ownership decisive rather than accepting per-component freshness alone. **Boundary Discipline / Test Behavior, Not Implementation** accepted the failure fixture only after checking the real protocol and real retry/persistence path. **Prove It Works** separated direct attachment execution, inspected red/green artifacts and unexecuted browser gates. **Laziness Protocol / Minimize Reader Load** supported the existing owner setter and local failure record over another abstraction. **Guard the Context Window** kept reading pinned and checks focused.

No unresolved Standards/test-audit finding in this repair. Fresh pinned browser/judge/full integration gates remain with the parent; this bounded recheck does not certify shipping or rendered UI quality.
