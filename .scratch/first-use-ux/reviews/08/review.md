# Ticket 08 review

Revision: `fb88dc6c5d030c015eef4090b80761aefd92dd34`; reviewed `git diff 00a05c9...fb88dc6` and both commits in that range. Analysis only: no production edits, commits, or delegation. The review brief's explicit prohibition on further delegation takes precedence over code-review's parallel-agent procedure; both axes were reviewed inline.

## Verdict

The grouping and selection design meets the ticket. Correct the grouped Undo focus mismatch before calling its keyboard flow complete. Separately, there is a reproducible, pre-existing Category-picker race that can explain the reported missing split fields. Passing reruns do not resolve it. The exact historical failure cannot be attributed conclusively because its trace was not supplied in this checkout.

## Standards axis

No new hard documented-standard breach found. The additional `payeeId` is validated at the public response boundary and derived from the stored Transaction. Grouping is a pure projection; it writes no Payee or Transaction. Category/approval writes remain with ticket 07's owners.

The shared table additions do **not** evade the UI-primitive rule's intent. `hideFrom` extends the existing typed visibility vocabulary; `Table.Head variant="group"` expresses a meaningful heading role with styling centralized in the primitive. They introduce neither native pickers nor unmanaged scroll areas, raw colors, arbitrary per-call restyling, or lint suppression. `lint:ui` passes. The variant's `align-middle` means vertical alignment, not horizontal centering; names remain left aligned. The mobile colspan and complementary visibility produce a full-width heading without squeezing the Amount column. Avoid expanding these into arbitrary styling bags, but no abstraction rewrite is justified here.

### Test-audit

Skipping a second unit inventory of `groupByPayee`'s rendered membership was reasonable. The new browser owner covers grouping, exceptions, cross-Payee reuse, persistence, and phone layout through real imports and controls. Ticket 07 retains the write/Undo matrix. No test-only production seam was introduced.

Qualify the implementer's rationale: unique names do not prove that an ID contract has no independent tests. A stable group key across a Payee rename is a possible independent module/lifecycle contract. Conversely, the current journey's differently named Payees would also pass an implementation grouping by unique names; it should not be described as discriminating ID versus name grouping. Source review confirms the Map and keyed tbody use IDs (`payeeGroups.ts:31–46`, table `:1097`). Do not add an impossible duplicate-name fixture just to distinguish implementations. No additional grouping unit test is required for this ticket; prioritize the loaded-page boundary in the existing browser owner, and cover rename lifecycle if that interaction becomes in scope.

## Spec axis — findings by severity

### P2 — Undo resumes in date order, not displayed Payee order (verified)

`src/lib/components/transactions/transaction-table.svelte:688` (receipt production uses `selection.of(rows)` at `:282`).

Scenario: import a newer `ZZZ Review` and an older `AAA Review`; turn grouping on, select both, categorize, then Undo. The displayed order is AAA then ZZZ, but focus returns to ZZZ's Category. On a long register this sends the keyboard user past the beginning of the restored batch. Evidence: `groups.log`, `undo-focus.png`, `undo-focus.aria.yml`, and the runnable `groups.ts` in this directory. The categorization completion itself correctly focuses Undo; row approval correctly proceeds to the next waiting row in displayed order.

Fix: intersect the receipt's restored IDs with current `listed` order before choosing a visible Category/Approve control. Apply this to both Undo kinds. Do not change receipt semantics or mutation order merely to implement focus. Extend the existing grouped journey with differently ordered dates/names and assert the restored focus. Other changed focus paths (edit return, delete fallback, single categorize, approve, bank resolution) now use `listed` appropriately by inspection. Show-more still uses `rows[focusFrom]` at `:580`; its first-new-row order is a related inferred gap, discussed under corrections.

### P2 — An async picker status shifts Split out from under a pointer (verified, pre-existing)

`src/lib/components/transactions/transaction-dialog.svelte:215`; relevant indexed option rendering in `src/lib/components/category-picker.svelte:182`; journey trigger at `e2e/journeys/splits.ts:28`.

Controlled reproduction: withhold the real `payees:lastCategory` response using the repository's WebSocket boundary helper. Fill the same Payee, amount, and memo as `splits/lines`; open Category or Transfer. Move the mouse onto Split, release the lookup, wait for the loading option to disappear, then click the same screen position. Split moves from y≈268 to y≈229; the pointer now hits Ready to Assign. The picker closes, Ready to Assign is selected, and `Line 1 amount` count is zero—the reported symptom. `split-race.ts`, `split-race.log`, `race-before.png`, `race-after-lookup.png`, `race-result.png`, and `race-result.aria.yml` retain the evidence. These are synthetic records; the probe makes no save.

Control: picking Split while the lookup is withheld and releasing it **after** selection preserves both Split and its empty lines (`probe.ts`, `probe.log`, `split-delayed-memory.*`). Thus this reproduction is a moving target before selection, not a late response resetting an already selected split.

Fix at the picker/dialog boundary: keep transient lookup status outside the selectable options and keep the open menu's geometry stable as the lookup resolves. Preserve option identity by value rather than position, but keying alone cannot stop physical targets moving. Protect this with a controlled-response browser case at the real picker boundary. Waiting for lookup completion in `splits/lines` may stabilize that journey, but must not be presented as fixing the user-facing race.

Attribution: all four implicated files are unchanged between `00a05c9` and `fb88dc6` (`git diff --name-only` on them is empty). Grouping is off in this journey. This is demonstrably an existing app race, not merely a test assertion that needs a longer timeout. The original trace is absent, so whether this exact interleaving caused that particular full-suite failure remains **inferred**. A fresh full-suite execution and focused `splits/lines` execution passed; those outcomes neither falsify nor repair the controlled reproduction.

## Focus-area conclusions

- **Identity:** uses `Map<Id<'payees'>,…>`, never the name as membership key. Labels only sort/display. Null Payees are separated as Transfers, Starting Balance, and No Payee; a named Payee with one of those labels remains distinct. No identity normalization or writes.
- **Scope and limit:** group handlers map only that section's loaded `group.rows` into `selection.set`. Accessible names say exactly which section/count is shown; visible headings say `N shown`. The group toggle is absent from `scopeKey`, so toggling preserves selection and Undo scope. `tooManyToCategorize`, disabled picker, handler guard, and one `categorizeMany` invocation remain intact; no chunk loop or selection of unseen history.
- **Ticket 07:** generation marks and completion ownership remain intact; grouping's `selection.set` increments that same generation. Undo still promises restoration of rows in the action's resulting state; the feature map retains that narrowed wording and intervening-change retirement. Grouping does not broaden the promise to causal revision tracking.
- **URL:** `group=payee` is separate from filters, uses replaceState, survives reload, and is removed when toggled off. Unknown grouping values leave grouping off. The owner journey verifies persistence and selection retention.
- **Phones:** the maintained journey passed at 320 and 390 px, including one-line Payee names, selection/tab-bar clearance, and right-edge checks. Its captures are 740 px high; additional 640 px review checks are recorded below. This local review is not the three-judge shipping gate; ticket 11 still owns that protocol.

## Recommended answers

1. **Keep alphabetical order.** It preserves location as rows are categorized, approved, or loaded. Ranking by loaded row count is both unstable during work and misleading when a Payee's history is partly loaded. Add a deliberate sort choice only after evidence from long-list use justifies it.
2. **Keep the Unapproved/Approved split.** Approval means leaving the review queue. Existing section labels and “N Transactions now … and approved” feedback accurately describe this; combined completion focuses Undo. Do not duplicate approved rows in Unapproved to preserve a group. If judging finds the movement unclear, add concise outcome wording about Approved rather than changing grouping semantics.
3. **Keep `N shown`.** It truthfully describes both membership and selection. Do not add a count query merely for a heading. Load-more must never silently select the newly loaded rows; the checkbox should become mixed until the person explicitly selects again.

## `/correct` — scoped analysis

**Repeated class: using transport order for keyboard recovery after introducing display order.** The Undo receipt iteration (`:688–694`, verified above) and show-more's raw index (`:580`, inferred from code) repeat the assumption that fetched order equals rendered order. The ticket already corrected that assumption in five other focus paths, making the remaining copies a maintenance risk.

Highest useful enforcement: **architecture**, through one local display-order lookup for focus candidates. Give it candidate IDs, iterate `listed`, and let each action retain its appropriate fallback control. For show-more, retain the previously loaded ID set and derive newly loaded candidates before applying displayed order. Types distinguish IDs from names but cannot express a temporal/rendering order; a blanket lint ban on `rows` would also reject legitimate pagination and selection logic. A focused journey assertion is the necessary behavior check, not a replacement for consolidating the ordering decision.

Concrete proof of value: the AAA/ZZZ Undo probe currently returns ZZZ. The common lookup would choose AAA; revert that lookup to receipt order and the added focus assertion must fail. The show-more scenario should use new rows whose date order differs from alphabetical order. No fix or green-after-fix is claimed in this analysis-only review. Do not invent a new global lint or add duplicated prose rules. The picker race is a separate demonstrated bug; this review has not established two independent historical instances warranting a broader new enforcement rule.

## Checks, evidence, and remaining work

Final execution results and cleanup are appended below. All paths in this report are relative to this directory unless stated otherwise. The original implementer artifacts under `test-results/ticket-08/` were unavailable here; their claimed red/negative-control runs were not independently rerun.

### Execution results

- Dependencies were initially absent: the first `app up` refused, then `bun install --frozen-lockfile` succeeded. Startup thereafter succeeded without a network error. `app doctor`, login, fixture seed, and authenticated Budget/Assigned-for-Groceries readiness all passed. No credential values were printed or changed.
- `bun run test:e2e:local`: **54/54 passed, 8.2 minutes, exit 0**, including `splits/lines` in its original suite position (7.6 seconds), selection (12.7 seconds), and grouping (7.9 seconds). See `e2e-local.log`. This is fresh full-suite evidence, not the implementer's three isolated reruns.
- `bun run app verify transactions/payee-groups … --run t08-review`: grouping passed all eight steps. Evidence is in `../verify-budge/t08-review/transactions/payee-groups/`. The selection sibling then failed at its final late-save `1 selected` visibility assertion; browser closure prevented further journeys and left that sibling's trace archive incomplete. The ARIA failure capture shows the selection bar absent. This observation is **unresolved**, not declared an environment flake: the earlier checkbox/focus assertions had passed, but the incomplete trace does not establish when selection cleared or why. The run overlapped unit/type checking, which is context, not a demonstrated cause.
- Fresh sequential browser run `--run t08-review-siblings`: **4/4 passed**, selection, approve-all-undo, splits/lines, splits/restart. See `siblings.log` and `../verify-budge/t08-review-siblings/summary.json`. Together with the full-suite pass this provides counter-evidence, not a causal explanation for the initial selection failure. Revisit the retained count-line failure if selection is touched again; no new ticket-08 causation was established.
- `TZ=America/Los_Angeles bun test-results/ticket-08-review/groups.ts`: **exit 0**. Synthetic 55-row Payee: initial 50 shown/selected; Show more exposes five unchecked rows, leaves 50 selected, and group checkbox becomes mixed. A second import takes the group to 255; its bulk picker is disabled and says `Categorize at most 250 at once.` Both 320×640 and 390×640 checks passed tab-bar/selection-bar clearance and right-edge assertions, with `groups-320.png` and `groups-390.png`. The same script records Undo's wrong focus and asserts the subsequent single approval focuses AAA. Early harness attempts incorrectly assumed 49 rows on the first page and reused an imported amount, triggering duplicate detection; those were corrected fixture/expectation errors, not product defects.
- `split-race.ts`: **2/2 controlled reproductions**, exit 0, both select Ready to Assign at Split's former coordinates and report no Line 1 amount. `probe.ts`: delayed response after selecting Split preserves it, exit 0. These inspection scripts intentionally record the defect rather than assert a hypothetical fixed result; the output and screenshots are the evidence. They are review artifacts, not new maintained tests.
- Unit suite: **908/908 passed, 58 files, 33.98 seconds**, exit 0 (`unit.log`). Focused editor + feature-map run: **53 passed**, 1.17 seconds, exit 0. Typecheck, scoped ESLint over every changed executable file, full `lint:ui`, scoped Prettier, and `git diff --check` passed (`typecheck.log`, `lint.log`, `lint-ui.log`, `format.log`). Doctor independently checked generated-code freshness. Capacity was not rerun: this ticket adds a response field and presentation projection, not a mutation, capacity limit, or database read loop. Prior capacity claims are not represented as new review measurements.
- No before/after timing comparison or pre-fix failure of the new focus assertion is claimed. The 7.9-second grouping journey is the measured added browser cost; the implementer's historical red and colspan negative-control evidence was unavailable in this checkout.

## Principles that changed the review

- **Prove It Works / Fix Root Causes:** used real lookup delivery and pointer geometry to reproduce missing split fields rather than dismissing successful reruns as a repair.
- **Test Behavior, Not Implementation:** retained the browser-owned grouping proof and avoided a duplicate membership unit inventory; distinguished an ID implementation audit from what the current journey can actually discriminate.
- **Experience First:** treated keyboard return order and moving click targets as user problems; recommended stable alphabetical groups and truthful loaded counts.
- **Laziness Protocol / Minimize Reader Load:** retained the existing selection, mutation, Undo, and table primitives; proposed one local focus ordering decision rather than another grouping framework.
- **Encode Lessons in Structure / Model the Domain:** identified display order as a distinct concept from query/receipt order and scoped the correction to their common boundary.
- **Separate Before Serializing Shared State:** used only this checkout's owned app for manual driving; the full E2E command owns a separate temporary backend. Browser drivers and reseeds were sequential.

Cleanup: `bun run app down` exited 0; this run’s process record is absent. Browser contexts were closed in `finally`; no other checkout or shared backend was reset or stopped. Report, logs, scripts, screenshots, snapshots, and valid journey traces remain nonempty after teardown. `git status --short` and `git diff --check` are clean; all review artifacts are ignored under `test-results/`. No commits.
