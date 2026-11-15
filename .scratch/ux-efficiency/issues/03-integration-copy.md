# 03 — Integrate and remove redundant copy

Status: done

Fresh Opus implementor integrates tickets 01/02 and implements spec items 21–26. Resolve production/UI integration issues, run full checks and feature verification, prepare neutral review tasks and known external gaps. Parent coordinates independent local code review, corrections, three judges, and shipping. Record evidence and final revisions here.

## Copy slice (items 21–26), isolated implementor

Scope: items 21–26 only, on `t3/ux-efficiency-copy-cuts` from `c7d354b`. Items 1–20 (transactions slice in baseline; Budget/Categories slice in its own worktree) and raw Luna candidates were left alone.

### Dispositions

| Item | Change | File |
| --- | --- | --- |
| 21 | Deleted the sign-in tagline; heading row and Clerk `SignIn` kept. Dropped the wrapper that only held the heading and tagline. | `src/routes/sign-in/+page.svelte` |
| 22 | Deleted Theme's reassurance sentence; `Theme` heading still names the radio group. | `src/routes/(app)/settings/+page.svelte` |
| 23 | Deleted the Categories intro paragraph and its wrapper; `Categories` h1 kept. | `src/routes/(app)/categories/+page.svelte` |
| 24 | Deleted `No Target yet.`; the Target heading plus `Add Target` stand alone. | `src/lib/components/budget/category-inspector.svelte` |
| 25 | Settings `Your data` intro is now `Download CSV or JSON.`; export dialog text (backup, token omission, scope, status) unchanged. | `src/routes/(app)/settings/+page.svelte` |
| 26 | Empty Budget side-panel prompt is now `Select a Category.` | `src/routes/(app)/+page.svelte` |

Feature map updated for the changed strings: `.agents/skills/verify-budge/features/budget.md` (prompt) and `targets.md` (remove recipe now requires `Add Target` instead of `No Target yet`). No journey asserted any removed string; no tests added (small reversible copy cuts).

### Verification (app stopped for static checks)

- `prettier --check`, `eslint`, `eslint --config eslint.ui.config.js` on the five Svelte files: pass. `bun run typecheck`: 0 errors.
- `bun run app up/doctor/login/seed budget-with-accounts`: all exit 0; readiness via Budget heading + `Assigned for Groceries`.
- `bun run app verify categories/manage targets/monthly inspector/move-money export/files shell/navigate settings/later-start --run copy-cuts`: all pass (summary at `test-results/verify-budge/copy-cuts/summary.json`; recorded commit is the baseline with uncommitted changes, i.e. this diff).
- Manual copy check `test-results/verify-budge/copy-manual/copy.ts` at 1280×800 and 320×640: sign-in, Budget empty inspector (desktop; phone has no side panel), Groceries inspector Target (`Add Target`, no `No Target yet`), Categories, Settings and Export dialog. Asserts the removed strings are absent, new strings present, accessible names intact, no horizontal page scroll. Screenshots + ARIA in `test-results/verify-budge/copy-manual/`, `log.txt` = `RESULT pass`.
- `bun run app down`: exit 0; `.local-app/running.json` gone.

### Pending integration work (parent)

- Merge with the Budget/Categories slice: both touch `src/routes/(app)/+page.svelte`, `categories/+page.svelte` and possibly `category-inspector.svelte`; expect textual conflicts near the Categories header and inspector, resolve by keeping both slices' intent.
- Full suite, local code review, corrections, three-judge UI review, shipping.

## Integration (Opus 5.5 integration implementer)

Commits on `feat/ux-efficiency`: `f821979` (cherry-pick of `52e699e`, conflicts in `features/budget.md` and `category-inspector.svelte` resolved keeping items 1–12 and copy 21–26: no `No Target yet.`, prompt `Select a Category.`); `17bbcc5` (integration fixes, hooks + `gitleaks --staged --redact`: no leaks); records commit after it. Work done only in `/home/lomzem/proj/budge`.

### Finding dispositions

| Finding | Disposition | Change | Proof |
| --- | --- | --- | --- |
| Search P2 (`search.ts` capture before convergence) | Fixed | `datesOnceListed` polls until the list holds `SAMPLE BOOKSHOP 0193` (never a Gifts row) and an out-of-range date; after `Last 30 days` it requires a non-empty list, all in range | Probe through `pausableSync`: old capture `[]` while paused vs 53 converged rows; old `every()` passes vacuously on 0 rows, new guard does not (`search-p2-probe.log`, exit 0) |
| Spec P2 #1 overspent exclusion on table Target button | Fixed | `budget-table.svelte`: shows when `target.needed > 0` | 320/390/1280 evidence: `Assign $987,564.32 to <long name>` visible on an overspent Category, fully in viewport, funds it, focus to the name |
| Spec P2 #2 / S1 inline-name resets unsubmitted draft | Fixed (C1) | Draft opens only on the explicit not-editing → editing transition; late failure restores the submitted name only if not typing another | `categories/late-rename` red on `f821979` source (typed-draft step), green after |
| Spec P2 #3 / S2 reorder edge scroll, touch, cancel, teardown | Fixed | `reorder.ts`: pointer capture, rAF edge autoscroll (only once the pointer moves toward that edge), pointercancel / lostpointercapture / Escape / detach cancel without `onmove` and clear transforms, `data-dragging`, rAF and listeners | `categories/reorder` real CDP touch step red on `f821979`, green after; probe: touchCancel and Escape leave 0 dragging/0 transforms and order unchanged after reload; detach mid-drag near the edge: scrollY constant over 30 frames, no drag left (`evidence-all.log`); edge gating red (235 px scroll with pointer held still) → green (0) (`probe-red.log`/`probe-green.log`) |
| S3 add-category-dialog reads live fields after await | Fixed (C1) | Submission snapshotted before `dialog.run` | `categories/manage` held-createGroup step red on `f821979` (received `Sample Edited Afterwards`), green after |
| S4 manage negative needs a valid Name; exact cover | Fixed | Group-name negative fills a valid Name and asserts `valueMissing` on Group name, `valid` on Name; cover asserts exact prefill = shortfall, Available 0, donor − shortfall exactly | Mutations: removing `required` → manage fails at the Group-name step; prefill `+100` → cover fails `Expected 5421 / Received 5521` (`red-mutations.log`, exit 1); restored |
| S5 month-jump depends on the calendar; map text | Fixed | `showYear` drives years from the grid label; boundary and keyboard steps derive month names; map rewritten | Passes in focused and full runs |
| Group-success / Category-failure retry | Answered: intended | Retry reuses the created group (`created`/`groupId`); now a journey step: one group after reload, Category in it | `categories/manage` |
| Deletion destination claim | Fixed proof | Delete step asserts Coffee's Activity = Coffee + Dining Out after reload | `inspector/cover-and-manage` |
| Risk: 320 px Assigned wrapping | Fixed | Below `xs` (22rem) Available folds under Assigned; roomy layout unchanged; Assigned column/input widened below `xs` only, so $999,999.99 fits | Clip assertion red with old widths (`999,999.99` clipped, `clip-red.log`), green after; `expectNothingPastTheRightEdge` at 320 and 390; screenshots `budget-{1280,390,320,320-row,320-large-assigned,320-funded}.png` |
| Risk: collapsed-group move focus | Fixed | `+page.svelte` expands the destination group when the selected Category changes group | `inspector/cover-and-manage` collapsed step red on `f821979` (aria-expanded), green after |
| Risk: SelectField `onclosed` callers | Answered | Only caller is Add Category (focuses Group name after choosing a new group); prop optional | Source grep; `categories/manage` |
| Found in integration: month grid lost an arrow move made straight after reopening | Fixed | Bits FocusScope remounts while open (close-autofocus to trigger, then reopen focus); `month-picker.svelte` keeps focus inside the grid and returns focus to the trigger itself only once closed | Probe red: 4/10 reopen rounds lost ArrowLeft (`probe-red.log`); green 0/10 with focus returned to the trigger after each pick and Escape (`probe-green.log`); `budget/month-jump` failed 3/6 before, passes after |
| Journey flakes found | Fixed | manage waits for the server-backed handle before reloads; reorder polls order, scrolls handles into view, scopes `groupOrder` to `main` | Focused 26/26 (`focused-5.log`) |

### /correct decisions

- **C1 async completion ownership** (`9db39a9`, `92837d3`, `8b632af`, `4702f1d`, now S1/S3): local, explicit editor transitions and submitted snapshots in each component (`inline-name` open transition + latest ticket; Add Category snapshot). No shared abstraction: `DialogSession.run` already owns dialog staleness; the remaining cases are per-editor draft ownership.
- **C2 scenario readiness** (`789022e`, `b1d8bdf`, Search P2): wait at the existing journey boundary on an independently expected row set; no sleeps, no generic settle helper, no production test flags, no lint claiming semantic enforcement.

### Checks

- Focused journeys `categories|budget|inspector|search|targets` ×2: 26 passed (`focused-5.log`).
- `bun run check`: codegen, format, lint, lint:ui, typecheck pass; `bun run test` 58 files / 929 tests pass; `capacity:check` **not run**: refuses because this checkout's backend is a local non-anonymous deployment and `bun run app up` refuses here. No Convex source changed on this branch's integration commits (`final-check.log`, exit 1 from capacity only).
- `bun run test:e2e:local` once at the end: 61 passed, exit 0 (`final-e2e.log`).
- Evidence: `test-results/ux-integration/` in this checkout (ignored). Scratch probe specs deleted; no `/tmp/budge-e2e-*` left; no app session started.

### Limitations

- App CLI refuses in this checkout, so journeys ran through `test:e2e:local` isolated anonymous backends rather than `bun run app verify`.
- Inline-rename server-failure path has no natural fixture failure: unproven in a browser (late-success path proven).
- Native touch `pointercancel` from a real OS gesture not exercised; CDP `touchCancel` was.
- At 390 px (roomy layout, unchanged by this branch) seven-digit group totals crowd each other; six-digit amounts fit. Pre-existing, not in the 26 items.
- Judge scores: none yet; independent three-judge gate still pending.

### Status of all 26 items

Items 1–12 implemented (`f821979`) and repaired (`17bbcc5`), proven by `budget/*`, `categories/*`, `inspector/*`, `targets/monthly`; 13–20 from `c7d354b`, proven by `search/*`, `transactions/*`, `splits/*` in the full run; 21–26 from `3374532`, proven by the copy journeys. All 26 implemented; independent judges pending.

## Final review repairs (Opus 5.5, isolated checkout `t3/integration-review-repairs`)

Base `6f4fe2f` (last code `17bbcc5`), worktree `/home/lomzem/.t3/worktrees/budge/t3-70d3dfa3-145e8cc7c58da72e`. Findings from the final Standards review, `/home/lomzem/proj/budge/test-results/ux-efficiency/reviews/integration-standards.md` (Standards items 1–3; "IS-n" below). No Convex, copy or other behavior changes; the 26 items are untouched apart from these repairs.

### Dispositions

| Finding | Disposition | Change | Proof (user boundary, persisted) |
| --- | --- | --- | --- |
| IS-1 (P2) failed rename takes another row's newer editor | Fixed | `inline-name.svelte`: a failed save while this name is open shows the error in place (unchanged); otherwise it keeps `{ name, error }` and asks its owner to reopen it. The Categories owner (`editing(id)` setter) now only grants a reopen when no other name is open (`renaming ??= id`); user opens (click, Rename) still set `renaming` directly. If refused, the failure is shown beside the persisted name (`role="alert"`), and the next open of that name restores the failed name and error to retry. The inspector's single editor always grants, so its recovery is unchanged. | New `categories/failed-rename` (320 px): first `categories:rename` / `categories:renameGroup` call failed at the Convex WebSocket with a plain server error (`failFirstCallTo` in `e2e/heldResponse.ts`; the request never reaches the server, nothing is saved, no success is fabricated). Red on prior code (`red-1`): Groceries' editor reopened (`textbox "Category name": Sample Refused Groceries`) and Coffee's unsubmitted draft was gone. Green after: Coffee keeps `Sample Typed Coffee` and focus, Groceries shows the alert beside its name; Coffee saves; Groceries reopens with the failed name and error and saves; reload shows both saved names and the group's old name. Also proves the existing no-other-editor recovery (group reopens with draft, error as the field's description) and no page overflow at 320. |
| IS-2 (P2) a foreign pointer's cancel/lost capture ends the owned drag | Fixed | `reorder.ts`: `pointercancel` / `lostpointercapture` go through `interrupt`, which ends the drag only for the owning `pointerId` (as move/drop do). Escape and attachment teardown still call `end()` unconditionally (transforms, `data-dragging`, rAF, Escape listener and capture cleared, no `onmove`). | `categories/reorder` step "a second finger tapping Coffee's handle mid-drag leaves the first finger to drop it" with real CDP touch: finger 2 on the dragged handle lifts (`touchEnd` with only that finger fires its `lostpointercapture` on the handle; event order recorded below). Red on prior code (`red-2`): order unchanged (`Coffee` first), the drag silently ended. Green after: Coffee dropped two rows down, persisted through the journey's reload and Budget order. |
| IS-3 (P3) feature map overstated `categories/reorder` | Fixed by adding retained proof and narrowing the rest | Journey gained own-cancel steps at 320 px: a CDP touch drag ended by `touchCancel` and a mouse drag ended by Escape each move nothing, the row returns to its resting position (bounding box), order unchanged. Map corrected: touch steps are 320 px (not 390); lists exactly the retained steps; states that the owning pointer's own `lostpointercapture`, leaving the page mid-drag, and native gesture cancel are not in the journey (one-off probes only). `categories/failed-rename` added to the map. | `featureMap.test.ts` passes in `bun run test`. |

Second-finger CDP behaviour (probe `test-results/verify-budge/second-finger-probe/probe-finger.ts`, run from the checkout root while the app ran; output observed in-session): omitting a finger from a `touchMove` does not lift it (both lift on the final `touchEnd`), while `touchEnd` listing only finger 2 gives `pointerdown 2, gotpointercapture 2, pointerdown 3, gotpointercapture 3, pointerup 3, lostpointercapture 3 …` on the handle — the foreign-pointer event IS-2 needs. The journey uses that form.

Design decision (IS-1): the decision "may this name reopen?" belongs to the owner of the shared editor slot (Categories page), not to `InlineName`, which has no view of other rows. No new prop or global: the existing bindable `editing` setter expresses the refusal, and `InlineName` reacts to whether it actually opened (its `failed` value either initialises the draft on open or stays as the in-row alert). Rejected: re-opening A after B closes (would steal focus from whatever the user did next), and a page-level message (detached from the row, off screen on phones).

### Checks (app stopped for static checks)

- Launch (verify-budge): no `.local-app/running.json` before start; `bun run app up` → `starting the local anonymous backend…`, `up at http://127.0.0.1:5173 (backend http://127.0.0.1:3210)`; worktree `.env.local` written by the CLI holds `CONVEX_DEPLOYMENT=anonymous…` (values not printed); `doctor` all ok; `login`, `seed budget-with-accounts` exit 0. Parent checkout and its env untouched.
- Runs (`test-results/verify-budge/` in this worktree, `summary.json` records base `6f4fe2f` + uncommitted repair diff): `red-1` (prior production code: `categories/failed-rename` FAIL at step 3, `categories/reorder` pass because the first second-finger form lifted the wrong finger), `red-2` (corrected form: `categories/reorder` FAIL at the second-finger step), `green-1` (failed-rename, reorder, late-rename pass), `green-2` (failed-rename at 320 pass), `final-focused` 12/12: `budget/{assign,assign-back,month-jump,needs-you,phone-groups}`, `categories/{failed-rename,late-rename,manage,reorder}`, `inspector/{cover-and-manage,move-money}`, `targets/monthly`; `final-repeat` reorder + failed-rename pass. Only comment lines changed after `final-focused` (lint `local/no-comments`).
- `bun run app down` exit 0; `running.json` absent afterwards; evidence directories kept.
- `codegen:check`, `format:check`, `lint`, `lint:ui`, `typecheck` (0 errors/warnings), `bun run test` 58 files / 929 tests: pass. Full E2E (61→62 journeys) and `capacity:check` not rerun (scoped change; capacity independently checked by the parent).
- Local `code-review` skill not run here (it fans out to sub-agents, out of scope for this checkout); the parent runs fresh review rechecks.

### Changed files

`src/lib/reorder.ts`, `src/lib/components/categories/inline-name.svelte`, `src/routes/(app)/categories/+page.svelte`, `e2e/heldResponse.ts` (`failFirstCallTo`), `e2e/journeys/categories.ts` (`failed-rename`; reorder interruption steps and order expectations after them), `.agents/skills/verify-budge/features/categories.md`.

### Test-audit gate

- `categories/failed-rename`: contract = a failed rename never discards another row's draft/focus, the failure stays visible on its own row and retryable, persisted names correct. Regression = unconditional reopen (red-1). Existing `late-rename` only covered successful responses on the same row. The failure is injected at the existing production transport boundary (Convex WebSocket), labelled; real server refusal of a rename needs a deleted row, which would remove the row under test.
- Reorder steps: contracts = own cancel/Escape commit nothing and restore rows; a foreign pointer cannot end the owner's drag. Assertions are user-visible geometry and persisted order, not handler calls or transforms. Regression = unconditional cancel (red-2). No algorithm mirroring, no global event harness.
- No production test-only flags or exports.

### Principles that changed a choice

- **Model the Domain / Separate Before Serializing Shared State:** the shared `renaming` slot has one owner; the fix puts the reopen decision there instead of giving `InlineName` knowledge of other rows.
- **Experience First:** failure shown beside the failed name and restored on reopen, rather than a later focus-stealing reopen or a detached page message.
- **Prove It Works / Fix Root Causes:** the first second-finger step passed on broken code; instrumenting the actual pointer events showed CDP lifted the wrong finger, so the step was corrected and then shown red before the fix.
- **Test Behavior, Not Implementation:** journeys assert focus, drafts, alerts, row positions and reloaded order.

### Remaining

- Not retained in a journey: the owning pointer's own `lostpointercapture`, leaving the page mid-drag, native OS gesture cancel (probe-only, labelled in the map).
- A failure alert stays beside a name until that name is opened again (by design; a reload clears it).
- Fresh review rechecks and three judges at the final SHA remain with the parent.

## Parent completion record

Implementation, local Standards/Spec review, test-audit, correction dispositions, feature verification and three-judge review completed at `417d273986dc93485e7e762a32ed3efed964b20f`. Each judge independently approved 9/10 with full scoped coverage and no open major or blocker; see issue 08. Earlier sections are historical handoffs. Localized follow-ups are in issue 09; PR, CI, CodeRabbit, merge and deployment verification remain ticket 04. Record individual confirmations for the final documentation-only head in shipping evidence and the PR description before external review.
