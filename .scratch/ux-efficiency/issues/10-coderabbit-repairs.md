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

## Follow-up: the `categories/manage` failure in `cr-focus-affected`

Base `0afbc8c` (the parent's integration of `f7538f4`). The Add Category dialog does not lose its refusal. A full page reload removed it, and an edit to a Markdown file triggered that reload.

- **Evidence in the preserved trace** (`cr-focus-affected/categories/manage/trace.zip`). The `categories:create` refusal arrives at 42284 ms. `[vite] connecting…` follows at 42361 ms and Clerk loads again at 42685 ms, which only happens on a fresh document load. The screencast still shows the dialog at wall time 22:33:19.291 and only "Loading…" at 22:33:19.378. The session transcript shows this agent rewriting this issue file at 22:33:19.27, while that run was going. The empty group Sol saw is the `createGroup` that had already landed before the reload.
- **Cause.** Tailwind v4 scans the whole repository for class names, including `.scratch/`, `docs/` and `.agents/`, and watches what it scans. A change to a scanned file of a kind Vite has no module for, such as `.md`, makes `@tailwindcss/vite` send `full-reload` to every open page. So an agent's doc edit during a `bun run app verify` run reloads the journey's page. The dialog, its draft and its error go with it. Pointer and keyboard submits are equally exposed, because only the timing of the edit decides.
- **Fix (`src/app.css`).** `@import 'tailwindcss' source('.')` limits the scan to `src/`, where every class lives. The production CSS loses only 16 utilities that came from doc text alone (such as `overflow-auto`, `container` and `visible`), none of them used in `src/`. No component or dialog code changed. The dialog's recovery (the reason, the made group kept as the choice, the hidden group field, retry into the same single group) was already right and already asserted by that step.

### Red → green

Evidence is under `test-results/verify-budge/`:

- `dialog-reload-probe`: 5 of 5 pointer submits at 320 px show "Enter a name." when nothing is edited. That is why the reruns passed.
- `dialog-reload-doc-touch` (base): a doc `touch` 30 ms after the submit loses the dialog 2 of 2 times. Vite sends `{"type":"full-reload"}`, and `beforeunload` fires from `@vite/client`.
- `dialog-reload-kbd-red` (base, Enter in the Name field): the same reload in both tries. The dialog was lost in 1 of 2, because the other refusal landed first.
- `dialog-reload-doc-touch-fixed2` and `dialog-reload-kbd-fixed` (fixed, after a clean `app up`): no reload, and the alert is shown in 3 of 3 pointer and 2 of 2 keyboard tries. `dialog-reload-doc-touch-fixed` stayed red only because the running Vite kept the old watch list until it restarted.
- At journey level, with a doc touched every 100 ms throughout: `dialog-doc-edits-red` (base) fails at step 1 because the page keeps reloading. `dialog-doc-edits-green` (fixed) passes all 10 `categories/manage` steps.

Test-audit gate: no journey changes. The failing step already asserts the observable recovery, and it went red for an environment reason, not a product one. A test that pins `source('.')` would be a source grep. The scripted probe is kept at the evidence path above as the re-runnable check.

### Checks

- `dialog-reload-affected` (fixed, clean `app up`): these journeys pass: `categories/manage`, `categories/reorder` (which keeps the `f7538f4` refused-reorder focus proof), `categories/failed-rename`, `categories/late-rename`, `budget/phone-groups`, `budget/assign`, `shell/navigate`, `search/phone`, `settings/later-start` and `transactions/approve-phone`.
- `bun run format:check`, `lint`, `lint:ui` and `typecheck` pass, `bun run test` passes 933 tests (59 files), and `bun run build` succeeds.
- The feature map is unchanged, because no behavior changed.

### Corrections (analysis-only `/correct`, decided by the Opus implementor)

- **C1, focus ownership recurs** (`cec8434` failed rename, `f7538f4` rollback): **answered.** Each fix gives focus to the thing that owns it: the moved item restores its own focused descendant, and only when its move dropped focus to the document. The journey's focus-away step already proves that a newer control keeps focus. These are two owners with different triggers, so a shared focus framework would add indirection without removing a fault.
- **C2, layout-shift guard causality recurs** (`fe03b0a`, `f060acb`, and the routed `WebSocket` class in `f7538f4`): **deferred**, with a concrete proposal. A maintained positive/negative check needs a browser, and this repository has no place to run one outside a journey. The Vitest CI job installs no browser, and every Playwright test seeds a fixture and signs in with the owner's Clerk credentials. Giving it a place means adding a Playwright-browser step to the Vitest job or a credential-free Playwright project. That is a CI and dev-environment change, which AGENTS.md sends straight to `main`, not to this integration branch. Once that exists, the check is about 40 lines, using `routeWebSocket` on a `setContent` page:
  - an unprompted shift fails, natively and routed;
  - a refusal shift answered after a held routed request is credited.

  Native crediting stays covered by every journey's real-socket mutations. Until then, the probes recorded under "Harness gap found and fixed" above are the evidence.
- **Cheap signal for next time** (fix-root-causes): `bun run app verify` could report any document load a journey did not ask for, which would have pointed to this cause at first look. It is not done here because it is harness work outside this repair.

## Follow-up: a name being typed when its row's move is refused (sol-a-RF-A1)

Base `848edfc`. The finding: at 320 px, the user focuses Move Coffee or a group's handle, presses ArrowUp while the first save is held, then clicks the moved item's name and types a new name without submitting. When the move is refused, the rollback closes the field, saves the draft as the name, and drops focus to `<body>`. A reload and the Budget then show a rename nobody asked for. Both independent observers reproduced it for a Category. Only one of them saw it for a group.

- **Event order** (instrumented probe, wrapping the keyed `{#each}` DOM moves and logging focus events and Mutation sends):
  - When a keyed row moves, Svelte calls `before()` on it. Chromium fires `blur`/`focusout` on the focused input synchronously inside that call, with `relatedTarget` null and `activeElement` BODY, while the input is still connected.
  - `InlineName`'s blur handler treated that blur as the user leaving. It committed at once: the field closed and `categories:rename` / `categories:renameGroup` was sent.
  - `keepFocusWhenMoved` (`src/lib/reorder.ts`) runs one microtask later and only restores a focused element that is still connected. By then the input had been removed, so focus stayed on BODY.
- **Why the group case varied.** Only the node Svelte moves loses focus.
  - Coffee ArrowUp, then rollback, moves Coffee, so it blurs.
  - The last group (Bills, after `reorder`'s earlier steps) ArrowUp, then rollback, moves that group, so it blurs.
  - Everyday ArrowDown, then rollback, moves the neighbor instead, so Everyday never blurs.
  - The two observers moved different groups, so this is a real group fault, not a Category-only one.
- **Premise attacked.** The `f7538f4` repair assumed focus lost to a move can be put back afterwards. That holds only if nothing acts on the spurious blur first. The commit-on-blur editor acted on it.
- **Owner and fix** (`src/lib/components/categories/inline-name.svelte`). The editor owns the question "has the user left this field?", so it now answers it only after focus has settled. The blur handler waits one task. Then it commits only if the field is still open and focus is not back on the input, or the window itself lost focus (`document.hasFocus()` false).
  - A move-caused blur is now repaired by the existing `keepFocusWhenMoved`, because the input is still connected, and the editor sees it focused again and does nothing.
  - Enter (commit) and Escape (abort) stay synchronous. Tab, a click elsewhere and a window switch still commit, one task later.
  - The `latest` ticket still owns rename errors, and the `failed` reopen is unchanged.
  - `reorder.ts` is unchanged and still needed for the handle and name-button repairs. No workaround became obsolete. No shared focus layer was added, and the C1 answer above still holds, with this owner now named.
- **Journey** (`categories/reorder`, new last step, real Convex transport through `failFirstCallTo`):
  - Category: type "Morning Coffee" in Coffee's field while its held move is refused. Coffee goes back, the reason shows in its row, the field keeps focus and the draft, and Escape leaves the name as Coffee.
  - Group: the same for the last group with "Rainy Day Fund". The order goes back, the reason shows in that group, and the field keeps focus and the draft. Tab out of the field then renames it, which proves the deferred commit still runs on a real leave (no journey asserted a blur commit before).
  - The reload and the Budget show the group rename and Coffee unrenamed in place.

### Red → green

Evidence is under `test-results/verify-budge/`:

- `editor-rollback-red` (base source with the new step): steps 1–12 pass. Step 13 fails in its Category half. The snapshot shows `Move Morning Coffee` with no field.
- `editor-rollback-red-group` (base source, with the Category half temporarily removed from the step; both files restored right after): fails in the Group half. The snapshot shows `Move Rainy Day Fund` and the reason, but no field. Bills was renamed without Enter.
- `editor-rollback-green` (fixed): the Category half passes. The Group half failed only on the step's own locator, which matched the page's empty live-region alert too. The locator was scoped to the edited group.
- `editor-rollback-green-2` (fixed, Enter in the Group half): all 13 `categories/reorder` steps pass.
- `editor-rollback-green-3` (fixed, the Group half committed by Tab): all 13 steps pass.
- Probe on the fixed source:
  - Coffee ArrowUp: blur inside `before()`, then focus is back on the INPUT, with no rename sent.
  - Savings Goals ArrowUp: the same.
  - Everyday ArrowDown: no blur at all.
  - In all three, focus ends on the INPUT with the draft kept.

Test-audit gate: the step asserts only what a user sees (order, reason, focused field and its value, the name after reload and on Budget). It uses the existing `failFirstCallTo` real-socket hold, with no production flag and no source grep. It does not duplicate step 12, which covers focus on the name button, not an open field.

### Checks

- `editor-rollback-affected` (fixed): these journeys pass: `categories/manage` (create and its refusal, Enter renames), `categories/reorder` (stacked presses, held replay, first refused then retried, touch cancel, second finger, autoscroll), `categories/late-rename`, `categories/failed-rename`, `inspector/cover-and-manage` and `inspector/move-money` (the Budget inspector also uses `InlineName`), `budget/phone-groups`, `budget/assign` and `shell/navigate`.
- `bun run format:check`, `lint`, `lint:ui` and `typecheck` pass, and `bun run test` passes 933 tests (59 files).
- The feature map's `categories/reorder` entry names the new step and the window-switch commit as not in the journey.
- **Limits.**
  - Not in a journey: a blank-click commit and the window-switch commit (same deferred rule as the Tab commit the step asserts), and a refusal that moves a row while its field is open and the first of two quick presses is refused. Both follow from the same rule and were not separately probed.
  - The fix relies on the browser's own focus order (blur, then the microtask repair, then the task), which was observed in Chromium only.

## Follow-up: a typed name dropped by opening another name (after `ddefe31`)

The reviewers raised a conditional risk: `ddefe31`'s deferred blur skipped when `!editing`, while a name button's `onclick` sets `renaming` to its own id at once. A draft in A could then be closed by B's opening before A's timer ran, and dropped instead of saved. I probed it before changing anything.

- **Probe** (`blur-switch.ts` in the agent scratchpad). It seeds `budget-with-accounts`, types "Draft A" into A, moves to B with a real input, then reads the Mutation sends, the open fields, focus and the names after a reload. There are 13 scenarios: fast mouse click, a 90 ms held click, CDP touch tap at 320 px, keyboard focus-and-Enter, Category↔Group in every direction, a click or tap on the Budget nav link, and a click or tap on blank space.
  - `blur-switch-base-848edfc.json` (the synchronous editor before `ddefe31`): 13 of 13 saved, one rename each.
  - `ddefe31` (printed lines; the run stopped at the probe's own reload wait before writing its file): fast mouse Category→Category, Category→Group and Group→Category, and tap Category→Category, Group→Category and Category→Group all sent nothing, and the draft was gone after a reload. The 90 ms held click and keyboard Category→Category saved. The regression was real for ordinary fast clicks and every tap. In a fast click and in a tap, the click lands in the same task as the blur or before the timer, so `renaming` moved to B first.
  - `blur-switch-fixed.json`: 13 of 13 saved, one rename each, with B's field open and focused.
- **Cause.** Deferring the decision changed what `!editing` meant. Checked during the blur, it means Enter or Escape already closed this field. Checked a task later, it also matches "another name opened", which is an ordinary leave whose draft must be saved.
- **Fix** (`inline-name.svelte`). The `!editing` check runs during the blur again. The deferred step asks only whether focus came back to the input in a focused window (the move rollback). It acts for the opening that blurred, through an `openings` count, so a stale timer never commits or closes a newer opening of the same field. It commits even if another opener already closed the field. The page's `editing(id)` setter clears `renaming` only when it still names this row, so A's late commit cannot close B. Navigation and unmount: a click or tap on the Budget link saves the draft before the page leaves.
- **Journey** (`categories/manage`, at 320 px, real transport).
  - The Category rename now ends with a fast mouse click on the group's name. The group field must open focused with its own name, and Escape must leave "Smoke Test Renamed" saved.
  - The group rename ends with a CDP touch tap on the Category's name. The Category field must open focused, and "Smoke Test Shelf" must be saved through a reload.
  - Enter-commit stays covered by the empty-name check, `late-rename` and `failed-rename`. Tab-commit is covered by the `reorder` rollback step.
  - Red/green:
    - `blur-switch-red` (`ddefe31` editor): fails at the Category step because the name is not saved.
    - `blur-switch-red-group` (`ddefe31` editor, with the Category step temporarily committing by Enter; both files restored after): fails at the group step because "Move Smoke Test Shelf" is never attached.
    - `blur-switch-green`: all 10 steps pass.
- **Checks.**
  - `blur-switch-green` also passes `categories/reorder` (the Category and Group rollback-with-open-field step, Tab, Escape), `categories/late-rename`, `categories/failed-rename`, `inspector/cover-and-manage`, `inspector/move-money`, `budget/phone-groups`, `budget/assign` and `shell/navigate`.
  - `format:check`, `lint`, `lint:ui` and `typecheck` pass, and `bun run test` passes 933.
- **Limits.**
  - A reopening of the same field inside the blur's task cannot be reached by user input. The `openings` guard covers it by construction, and no probe drives it.
  - Window-switch commit is still unprobed.

### Firefox: a moved focused node loses focus without `focusout` (deferred)

A judge reported that in Firefox, when End or a refused rollback moves the focused item itself, focus goes to BODY with no `focusout` event, so `keepFocusWhenMoved` never runs. Repeated ArrowUp keeps focus, because the neighbour moves.

- **Probe** (Firefox 1555 from the local Playwright cache, fixed source, the editor-order probe): a refused Coffee move and a refused Savings Goals move with the name field open send no rename and keep the field and its draft, but focus is BODY. So the data-integrity part of RF-A1 holds in Firefox. Only focus is lost, as on the handle.
- **Disposition: deferred.**
  - The repo's maintained verification is Chromium only (CI runs `playwright install --with-deps chromium`, and journeys and `verify-budge` use Chromium), so a Firefox repair would have no check to keep it.
  - In Firefox the loss comes with no event at all. A repair needs a second detection path in `reorder.ts`, such as remembering the focused descendant and watching the list with a `MutationObserver`, alongside the `focusout` path Chromium needs. That is the shared focus machinery this scope rules out.
  - Restoring focus where the order is set (`saveMove`) would not cover moves that arrive from the server.
  - If Firefox joins the supported matrix, add a Firefox journey project first, then replace `keepFocusWhenMoved` with one engine-neutral owner and prove it there.

## Follow-up: a phone editor or refusal left under the tab bar (sol-a-EF-A1)

An observer found two phone recovery cases at 320 px with touch where focus, draft and data were right but the user could not see them:

- **A.** Moving the last group up with its name field open and refused, the order came back with the field, draft and focus intact, but the field sat behind the Sections tab bar (field 565–609, bar 575–640), with the refusal under it.
- **B.** A refused Everyday rename grew its multi-line failure above a Groceries field being typed, which pushed that field behind the bar (field 580–624).

- **Reproduced first** (`ef.ts` in the agent scratchpad, 320×640, touch and coarse pointer, real Convex transport through `failFirstCallTo`, rename sends counted). `ef-base-9c2755e/results.json`:
  - A, group: field 565–609, refusal 613–641, bar 575–640.
  - A, Coffee: clear.
  - B, group fails above the Category being typed: field 524–568 before and 580–624 after.
  - B, Category above Category and Category above group: clear.
  - Every case kept focus and the draft, and sent no rename.
- **Cause.**
  - A: the rollback moves the focused row itself. `keepFocusWhenMoved` in `reorder.ts` (added in `f7538f4`) restored focus with `preventScroll: true`, so nothing brought the field back into view. Nothing revealed the row's refusal either.
  - B: a failure appearing above the focused field grows the page, and no scroll keeps the user's field in view. Chromium's scroll anchoring did not hold it here, and iOS Safari has no scroll anchoring at all.
  - The same `preventScroll` also leaves a keyboard-moved handle off-screen. Measured with `ef-end.ts` at 320 px: Home on the last group put its focused handle at −281 to −237, and End on the first group at 777–821.
- **Ownership and fix.** Each change sits with the code that changes what the user sees. Nothing generic watches focus.
  - `reorder.ts`: restoring focus scrolls as an ordinary focus does (`preventScroll` removed). The browser then honours the phone's `scroll-padding-bottom` above the tab bar.
  - `src/lib/refusalInView.ts` is a single attachment on a refusal message, used where the message appears: the page's move refusal, and `InlineName`'s failure beside a closed name.
    - If focus is still in the message's row, or on nothing, it reveals the whole row (the field with its reason) with `block: 'nearest'`.
    - If focus is elsewhere, it reveals only the focused control. B's field stays in view, and the old A failure is never shown at B's expense.
    - When everything is already in view, `nearest` scrolls nothing.
  - Not added: the same reveal on the error inside an open editor ("Enter a name."). `ef-edit.ts` measured that error clear of the bar without it (field 495–539, error 543–567, bar from 575), because opening the field already scrolls it above the padding.
- **Journeys** (real transport, 320 px).
  - `categories/reorder`:
    - The no-op "End moves the Savings Goals group last" step (it was already last) became "Home moves the Savings Goals group first and End moves it back last, its focused handle clear of the tab bar each time". This leaves the later group order unchanged.
    - The rollback-with-open-name step now runs at 320 px under `useATouchScreen`. The group half reopens the page, presses ArrowUp on the last group, and opens the name with a CDP tap (`tap`, now shared with `manage`). It then checks the Category and group fields, both refusals and the moved handle with `expectClearOf` against the Sections bar.
  - `categories/failed-rename`: a new step fails a second Everyday rename while a CDP-tapped Groceries field is being typed. It requires the group failure, the Groceries draft and focus, and the field clear of the bar.
- **Red → green.**
  - `ef-red-final-2` (`9c2755e` source, final journeys):
    - `reorder` fails at the Home/End step: the focused handle is at viewport ratio 0.
    - `failed-rename` fails at the new step: the bar overlaps the Category field.
  - `ef-red-only-focusfix-touch` (the `preventScroll` removal only, run before the Home/End step was rewritten): `reorder` fails at the open-name step, where the bar overlaps the group refusal.
  - `ef-red-only-reveal-2` (the reveal only, with `preventScroll` kept): `reorder` fails at the Home/End step.
  - `ef-green-final`: all 9 affected journeys pass.
  - Geometry after the fix, from `ef-final-{320,390,1024,1280}/results.json`:
    - A, group at 320: field 487–531, refusal 535–563, bar 575–640.
    - B, group above Category at 320: field 524–568, unmoved, with the group failure 443–515 also in view.
    - Every case at 390, 1024 and 1280 keeps the field and its reason in the viewport, with focus and the draft, and sends no rename.
- **Checks.**
  - `ef-green-final`: `categories/manage`, `categories/reorder`, `categories/late-rename`, `categories/failed-rename`, `inspector/cover-and-manage`, `inspector/move-money`, `budget/phone-groups`, `budget/assign` and `shell/navigate` pass. That covers stacked presses, held replay, touch cancel, the second finger, autoscroll, Enter, Tab and click commits, Escape, the fast A→B switch, late and failed renames, and the Budget inspector's `InlineName`.
  - `format:check`, `lint`, `lint:ui` and `typecheck` pass, and `bun run test` passes 933.
- **Limits.**
  - A refused touch drag, where focus is on nothing, now reveals the dragged row with its reason. That path is by construction and was not probed.
  - Firefox stays deferred as above. When Firefox loses focus to BODY on a moved row, the reveal should still show the row, because focus is on nothing. That follows from the code and was not probed.


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
