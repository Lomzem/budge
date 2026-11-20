# UI review: budget-first UI, round 2

Use [the protocol](../../docs/quality/ui-review/README.md) and [the rubric](../../docs/quality/ui-review/rubric.md). Each judge copies the "Independent judge report" section of [the template](../../docs/quality/ui-review/report-template.md) into their own report file.

## Coordinator brief

### Spec and intended outcomes

[spec.md](spec.md), "Owner requests" 1–11. The owner should be able to:

1. Manage Categories and groups from Budget, with no Categories tab. That means add, rename, move up and down, move to a group, hide, show, and delete.
   - On desktop, right-click a row. On touch, long-press it.
   - A group also has a ⋯ button. The inspector has the same menu.
   - Hidden Categories sit under "Hidden" on Budget, each with its Available and a Show button.
2. Find the Transactions tab (formerly Accounts) in the sidebar and in the phone tab bar.
3. Not meet the copy the owner rejected. [The copy review](../../docs/quality/copy-review.md) lists every example.
4. On a laptop, not be offered "Add to home screen".
5. With no Category selected, see Upcoming in the side panel, not a "Select a Category." placeholder.
6. See Upcoming show one status: `Not funded`, only on short rows due this month. There is no Funded or No column.
7. Read Target text tersely: `$59.98 monthly, due 1st`, not "Set aside $59.98 each month, due on the 1st".
8. Select a Category by clicking anywhere on its row that is not a control. While a row menu is open, a click only closes the menu.
9. Approve a Transaction by picking a Category or a Transfer for it, from its row or its dialog. Picking Uncategorized in its row leaves it Unapproved. Saving it from its editor approves it, as any edit does ([GLOSSARY](../../GLOSSARY.md), "Unapproved").
10. Switch tabs without a "Loading…" flash.
11. See a tighter Budget: density, and the size of Ready to Assign.

### Scope

- **In scope:** Budget (table, row menus, group ⋯ menu, inspector, Hidden, Upcoming), the Transactions tab and register, Bank, Settings (Export buttons, cutover date), and the sidebar and phone tab bar.
- **Excluded:**
  - Plaid live sync, because the local server can't reach Plaid.
  - Home-screen install on a real phone.
  - Unrelated redesign ideas. Record those as follow-ups.

### Revision

Branch `feat/budget-first-ui`, checkout `/home/lomzem/proj/budge-ui`. Review the clean commit it is at when you start, and record its SHA (`git rev-parse HEAD`).

### Features, journeys and fixtures

- **Fixture:** `budget-with-accounts`, plus `bank-sync` where a journey asks for it. All data is synthetic.
- **Journeys:**
  - `categories/manage`, `categories/touch-menu`, `categories/only-group`, `categories/held-rename`, `categories/failed-rename`
  - `inspector/move-money`, `inspector/cover-and-manage`
  - `targets/monthly`
  - `shell/navigate`, `shell/cold-start`, `shell/failed-query`, `shell/phone-pages`
  - `imports/approve`
  - `transactions/categorize`, `transactions/select-categorize`, `transactions/approve-phone`
  - `plaid/status`, `plaid/consent`, `export/files`, `budget/assign`

### Matrix

- **Viewports:** desktop 1280×800, phone 320×640 with touch, and phone 390×844.
- **Desktop keyboard:**
  - Tab and Shift+Tab through Budget.
  - Open a row menu with the keyboard (Shift+F10 or the context-menu key on a focused row, or the group ⋯ button).
  - Rename with Enter and Escape.
  - Reach Hidden → Show.
- **Touch:** long-press a row and a Category name, tap outside the open menu, then use the phone inspector's Previous/Next Category.
- **States:**
  - Nothing selected (Upcoming), and a long Category name.
  - A hidden group whose members are listed under Hidden.
  - Empty Upcoming: it should show nothing, not an empty-state sentence.
  - An empty Category Group at 320 and 390 px.
  - Renaming a Category from the inspector.

### Expected observable outcomes

- Every menu action persists after a reload.
- Ready to Assign changes only when money moves.
- Closing a menu, whether a row menu or a group's ⋯ menu, never selects a row or opens the inspector.
- A tap or right-click in an Assigned field edits that field and opens no row menu.
- Tab switches between Budget, Transactions, Bank and Settings never show `Loading…` once the app has loaded. Before the shared data loads, the main region shows one `Loading…` beside the sidebar, and no Section opens on its own `Loading…`.
- Import file opened from an Account opens on the File field.
- Picking a Category drops the row from the Unapproved count.
- Showing a hidden Category or group from the keyboard leaves focus on it, and showing a Category opens its group if it was collapsed.
- Hiding a Category or group, or moving a Category to another group, from the keyboard leaves focus in Budget: on the next Category or group, or on the moved Category.
- Deleting a Category from the inspector or from its row menu leaves focus on the Category beside it: the next one in its group, else the previous one, else its group.
- On a 320 px phone a row menu and its "Move to group" submenu stay on screen, with 44 px items.
- At 320 px a long hidden name wraps at word boundaries on its own line.
- An Escape while the inspector's Delete or Target dialog is open closes only that dialog; the inspector and an unsaved Move money amount stay.
- In a ⋯ menu, End pressed right after Enter focuses the last item, and focus stays on the item the keyboard reached while the menu is open.
- While a row menu or ⋯ menu is open, a click, tap or right-click anywhere outside it only closes it. Nothing under the press changes, and no row is selected. This holds over a dialog too: on a phone, Move, Clear, Close, Previous and Next in the inspector dialog do nothing until the menu is closed. Once the menu is closed, the next click acts at once, also after a right-click.
- If one of the shared queries (Settings, the counts, Categories, Payees) fails, the app shows the server's message in place of every Section, or `Budge couldn't reach its server. Try reloading the page.` when the server gives none, as it does for a failed owner check or Accounts query. No Section opens with part of its data.
- Deleting a group that has one Category speaks of one Category: `Its Category moves to the group you pick, with its history.` If no other group can take its Categories, the dialog says only `Add another Category Group to take over this Category and its history.` (or `these Categories and their history.`) and offers no Delete.

### Checks already completed (on `b13f082`, the dev-branch commit with this branch's code)

| Check                                             | Exit code | Result                                                     |
| ------------------------------------------------- | --------- | ---------------------------------------------------------- |
| `bun run check`                                   | 0         | Includes lint, lint:ui, typecheck and 1,145 Vitest tests   |
| Full live journey suite with `bun run app verify` | 0         | 67/67 in run `r2-b13f082`, clean tree                      |
| `gitleaks` on each commit's staged changes        | 0         | Clean                                                      |

A judge re-checking round 1 gets their own findings and dispositions in their task. Read no `ui-review-round-1*` file and no other judge's report or evidence.

### Known limits

- Plaid sync and reconnect against a real bank are unverifiable here, so they're excluded.
- The seeded Bank Connection has no bank login.

### Sessions

The judges run one at a time in the single checkout `/home/lomzem/proj/budge-ui`, as the protocol allows. Each judge starts the app, logs in, seeds, judges, runs `bun run app down`, and records release before the next judge starts. The coordinator moves each finished report out of the checkout before the next judge starts, so no judge sees another's report.

| Judge | Model and reasoning effort | Report file                                           |
| ----- | -------------------------- | ----------------------------------------------------- |
| Opus  | claude-opus-5-5, high      | `.scratch/budget-first-ui/ui-review-round-2-opus.md`  |
| Sol A | gpt-6.2-sol, xhigh         | `.scratch/budget-first-ui/ui-review-round-2-sol-a.md` |
| Sol B | gpt-6.2-sol, xhigh         | `.scratch/budget-first-ui/ui-review-round-2-sol-b.md` |

Each judge writes their report file and returns its full text.

## Results

The final SHA is `ad595d8`. Its code is identical to `b13f082`, where the full journey suite passed 67 of 67.

| Judge | Last full review | Result on the final SHA |
| ----- | ---------------- | ----------------------- |
| Sol A | [`5f7a76d`, 9/10](ui-review-round-2-sol-a-final-2.md) | 9/10, approve, no open findings ([report](ui-review-round-2-sol-a-final-4.md)) |
| Sol B | [`c77b70e`, 9/10](ui-review-round-2-sol-b-final.md) | 9/10, approve, B3-1 resolved, no open findings ([report](ui-review-round-2-sol-b-final-2.md)) |
| Opus | [`9b1012b`, 9/10](ui-review-round-2-opus-recheck.md) | Not run. The Opus provider reached its weekly limit. |

The owner chose to merge without the Opus re-check of the final SHA. Every change after `9b1012b` is a fix that the Sol judges re-checked, and each fix has a journey that failed before it.

## Dispositions

| Finding | Judge | Severity | Disposition |
| --- | --- | --- | --- |
| O2-7 | Opus | — | Fixed in 2903219: hiding a Category from the inspector leaves focus on the Category beside it (next, else previous, else group header, else main). `inspector/cover-and-manage` checks it; red o27-red-b, green o27-green-b. |
| O2-8 | Opus | — | Kept: bits-ui closes both menus on Escape and focus returns to the row; low impact. |
| O2-9 | Opus | — | Fixed in 2903219: the feature map states that Upcoming shows in the empty side panel at lg and after the table below lg. |
| A1 | Sol A | Major | Kept (accepted by Sol A in round 2). |
| A2 | Sol A | Major | Fixed (pass in round 2). |
| A3 | Sol A | Minor | Fixed (pass in round 2). |
| A4 | Sol A | Nit | Kept (accepted by Sol A in round 2). |
| A5 | Sol A | Minor | Kept: phone rows stay about 85 px tall so the Assigned input keeps its 44 px touch target; the month stays on one line at 320 px. |
| A2-1 | Sol A | Blocker | Fixed in 4578e5a: the editor offers a saved Transaction only the Transfers that keep its Direction, as its row picker does. Unit table in transactionEditor.test.ts (2 red without the fix). |
| A2-2 | Sol A | Major | Fixed in 4578e5a: while any menu is open, a click in the table only closes it. `inspector/move-money` checks it; red a2-red, green a2-green. |
| A2-3 | Sol A | Minor | Fixed in 6e8e541. The 4578e5a guard was not enough: a probe still reached Rename in about 3 of 96 normal-speed trials, because bits-ui remounts the menu focus scope after End and refocuses the first item. The shared dropdown now keeps focus on the focused item while the menu is still open. Probe: 96/96 normal and 24/24 at 6× reach Delete. No journey can force the timing. |
| A2-4 | Sol A | Minor | Fixed in 4578e5a: Escape after a right-click on a row's empty cell returns focus to that Category or group. `categories/manage` checks both. |
| B1–B6 | Sol B | — | Round-1 dispositions; Sol B passed all six in round 2 and accepted B1 Kept. |
| A3-1 | Sol A (re-check) | Major | Fixed in 6e8e541: the inspector ignores an Escape while its Delete or Target dialog is open. `inspector/move-money` step 'an Escape still inside the inspector as Delete opens closes only Delete, and the started move stays'; red a31-red, green a31-green. Probe kept the draft in 120 of 120 trials. |
| A4-1 | Sol A (re-check 2) | Blocker | Fixed in 5505d72: while a dropdown or context menu is open, a dialog under it takes no pointer input (`src/app.css`). `inspector/move-money` step 'on a phone, a click on Move with the inspector ⋯ menu open only closes the menu, and the started move stays'; red a41-red, green a41-green. Touch probe at 320 and 390 px: Move, Clear, Close, Previous and Next each only close the menu. |
| A5-1 | Sol A (re-check 3) | Minor | Answered, not fixed. At 390 px a tap on Previous Category close to the open menu's left edge went to the menu, because Chromium's touch adjustment moves a tap onto a nearby clickable element. The menu stays open, nothing changes, and a second tap closes it. Sol A scored 9/10 and approved 9b1012b with this open. |
| B2-1 | Sol B | Minor | Fixed in 08ff85e (judge branch 0db8941): after a click or tap outside any ⋯ dropdown, focus returns to its ⋯ button (shared dropdown wrapper). `categories/touch-menu` checks touch and desktop; red b21-red, green b21-green-2. |
| B2-2 | Sol B | Minor | Fixed in 08ff85e: the Bank card reads only `Feeds no Budge Account yet.` `plaid/attention` checks the sentence is gone. |

Checks on 08ff85e: `bun run check` exit 0 (1,131 tests); full suite 64/64, run r2-full-08ff85e-b, clean tree. Judge branch HEAD df09dd3.
Scores before re-check: Opus 9 (b7d5afc), Sol A 7 (3c69476), Sol B 9 (d8cea0b).

### Final round items (after three 9/10 approvals on 9b1012b)

| Finding | Source | Severity | Disposition |
| --- | --- | --- | --- |
| O3-1 | Opus re-check | Minor | Fixed in 2903e9a: Delete from the inspector leaves focus on the Category beside it, as Hide does. `inspector/cover-and-manage` requires Coffee focused after Dining Out's Delete; red o31-red, green o31-green. |
| O3-2 | Opus re-check | Nit | Fixed in 2903e9a: `features/inspector.md` Gotchas gives the beside-focus order for Hide and Delete. |

### Local code-review (main...HEAD at 2903e9a), Standards axis

| Finding | Kind | Disposition |
| --- | --- | --- |
| S1 local E2E credentials | Hard | Fixed in 927f652: `e2e/run-local.ts` forwards CLERK_JWT_ISSUER_DOMAIN and E2E_CLERK_USER_ID. Before: globalSetup threw in loadCredentials; after: `bun run test:e2e:local -g navigate` 1 passed. |
| S2 exception-terms accepts -line and several rules | Hard | Fixed in 927f652: only `eslint-disable-next-line` with one named rule passes. Two new RuleTester cases, red then green (231/231). |
| S3 hooks and lint tooling on the feature branch | Hard | Answered: the copy lint rules enforce the copy this branch cuts and fail on main's copy, so they land with it; the owner asked for the rules and the UI-ownership hook in this same request. Splitting now would rebase 40 commits for no review gain. |
| S4 shell journey matched only `Loading…` | Hard | Fixed in 927f652: any role=status whose text starts with `Loading`, on added nodes and text changes. Probe caught both; `shell/navigate` passed (run shell-loading). |
| S5 duplicated optimistic reorder | Judgement | Fixed in 927f652: one `reorderOptimistically` updates both caches. `categories/manage` passed. |
| S6 duplicated approve predicate | Judgement | Fixed in 927f652: `changeOf` returns `approves`. `transactions/categorize` passed. |
| S7 `No Categories yet.` | Judgement (copy Q1) | Fixed in 927f652: removed; `categories/manage` checks the empty group stays with no Category rows and the phone table keeps its width. |

### Local code-review (main...HEAD at 927f652), Spec axis

| Finding | Kind | Disposition |
| --- | --- | --- |
| P1 hidden rows offer only Show | Missing (partial) | Deferred: a hidden Category is managed by Show, then its row menu. The spec names the menu on Budget rows; the Hidden list is a restore list. Follow-up recorded for menu actions on hidden rows. |
| P2 first tab switch can show Loading… | Wrong (unconfirmed) | Fixed in 4cba62c: the layout shows a Section only once the owner check, the Accounts, the Bank Connections, the current Budget month and the shell queries have each loaded or failed, so no Section opens on its own Loading…. 3d3fdb0 extends the `shell/navigate` Loading watch to first visits. `shell/navigate`, `shell/phone-pages`, `settings/start` and `settings/cutover` passed (run shell-gate). No red run: the local backend answers the race inside one sync message. |
| P3 Transfer filter for saved Transactions | Scope creep | Answered: this is the fix for blocker A2-1 (4578e5a). The editor offers a saved Transaction only the Transfers that keep its Direction, as its row picker does. A saved Checking inflow cannot be a card payment without a Direction change, because a card payment leaves Checking. |
| P4 row-menu Delete focus | Wrong (unconfirmed, confirmed by probe) | Fixed in 2950929: the row menu's Delete puts focus on the next Category in the group, else the previous one, else the group, as the inspector's Delete does. The dialog no longer tries the removed row. `categories/manage` requires Transit focused; red row-delete-red-3 (`getByRole('button', { name: 'Transit' })` not focused), green row-delete-green-4 and -5. |
| P5 progress bar lost its dollar shortfall | Wrong (spec stale) | Answered, spec updated in 3d3fdb0: the bar reports a percentage, and the status beside it gives the shortfall (`$25.00 more needed`), which `targets/monthly` asserts. A funded Target shows no `Funded` word (Q4). |
| P6 copy rules miss conditional text | Missing | Fixed in ff136f6: banned-copy and concise-copy check each text a conditional, a `&&`/`??`/`||` fallback or a template literal can render. A phrase in the fixed text is reported once, not per variant. Six RuleTester cases, red then green. The stricter rule cut the group Delete description by one word and shows the Starting balance hint only once the cutover date is known (approved wording kept). `accounts/setup-check` and `categories/manage` passed. |
| P7 shell-queries checks only top-level returns | Wrong | Fixed in ff136f6: the rule reads returns in nested blocks, not in nested functions. A scoped return in an `if` with a final `'skip'` passes; an all-unscoped one still fails. Two RuleTester cases, red then green. |

### /correct (Sol analysis at 4cba62c, report correct-r2-sol.md), Opus decisions

| Item | Decision |
| --- | --- |
| HEAD issue: `imports/approve` withholds `settings:get`, which the shell gate now waits for | Accepted. The gate makes the dialog's wait-for-Settings focus path unreachable, so it is deleted; the journey drops the hold and keeps the preset Account, File focus, missing-date-message-hidden, import and Approve checks. |
| C1 menu dismissal layer | Deferred to a follow-up. A shared dismissal layer across bits-ui portals and touch is a redesign of every menu at the end of a judged round. Each of the four occurrences has a fix with journey proof (A2-2, A4-1 red/green). |
| C2 anonymous backend startup | Deferred to a follow-up on `main`: CI and launcher tooling, no UI. AGENTS.md sends dev-environment changes straight to `main`. S1 is fixed on this branch. |
| C3 shell gate cold-start proof | Accepted: a journey step withholds `settings:get` on a cold load, switches to Settings, and requires no Settings content or page-level Loading… until release. Red with the old predicate. |
| C4 Category removal focus | Partly accepted: `focusAfterDelete` and `focusAfterRemoval` lose their `mainRegion` default, so svelte-check rejects a caller that names no destination (red: the 927f652 row call). The capture-function refactor is deferred; both callers already share `firstVisible`. |
| C5 bare `page.reload()` in journeys | Accepted: `no-restricted-syntax` in `e2e/journeys/**` except `journey.ts`, naming `reloadOnceSaved(page)`. Red on the 776df1c bare reload. |
| C6 copy-guard escapes | Accepted: past the variant bound, every branch is still checked once in context instead of being dropped; `no-heading-lede` reads conditional branches through the shared reader. RuleTester cases red then green. |
| T1 phone pages never check scroll end | Accepted: assert the page reached its end. |
| T2 Upcoming after the table on a phone | Accepted: assert vertical order. |
| T3 progress value | Accepted: assert the bar's value before funding is below 100. |
| T4 Delete credits destination Assigned | Accepted if the journey's numbers allow a direct check. |
| T5 popup-exit-config suite name | Answered: ESLint over `src` is the enforcer; the suite tests the rule's selectors. No change. |

### /correct implementation results (Opus)

| Item | Commit | Evidence |
| --- | --- | --- |
| HEAD import issue | d522452 | The wait-for-Settings focus path is deleted. `imports/twin`, `imports/approve` and `imports/late-save` pass (run correct-2). |
| C3 | d522452 | `shell/cold-start` withholds `settings:get`, waits until the `owner:whoami` and `accounts:list` results reach the browser (`resultsReachBrowser` in `e2e/heldResponse.ts`), then switches to Settings. With the old predicate it fails at "Settings heading hidden" in 3 of 3 runs (cold-start-red4..6). With the gate it passes 3 of 3 (cold-start-green1..3). The first draft passed on the old gate because the click came before the owner and Accounts results arrived. |
| T1 | d522452 | `shell/phone-pages` polls that each page scrolled to its end. Passes (correct-2). |
| C4 | 8ada483 | Both props are required. Red: svelte-check reports "Property 'focusAfterRemoval' is missing" when the `+page.svelte` caller drops it. |
| C5 | 8ada483 | Red: the rule reports 5 bare reloads in `accounts.ts` at 0634fb0^ (the commit that replaced them; 776df1c in the decision was the wrong SHA). The tree lints clean. |
| C6 | 8ada483 | Three RuleTester cases (banned phrase in the first of six conditionals, 14 words across seven conditionals, a conditional lede). Red: 3 failed without the fix. Green: 243 rule tests pass. The repo lints clean under the stricter rules. |
| T2, T3 | 02de368 | `targets/monthly` checks the bar is under 100 before funding and that Upcoming starts below the table's bottom edge at 320 px. Passes (correct-3). No red run: these assert behaviour the branch already has. |
| T4 | 02de368 | `inspector/cover-and-manage` checks Coffee's Assigned gains Dining Out's Assigned after the delete and a reload. Passes (correct-3). No red run. |

`bun run check` at 02de368: 1,145 tests pass, svelte-check 0 errors.

### Sol A final re-check on 59d945c (8/10, changes required), Opus decisions

| Finding | Severity | Disposition |
| --- | --- | --- |
| A5-1 | Major | Fixed in 9619b6e (dev branch). Sol A showed that the near-edge tap can activate Move down, which saves a change, so the Answered disposition no longer holds. A fixed dismiss layer (`src/lib/components/menu-dismiss-layer.svelte`, z-55 under menus at z-60) now catches every click or tap outside an open dropdown or context menu, so the press only closes the menu. It replaces the Budget table's click guard (A2-2) and the 5505d72 dialog pointer-events rule (A4-1). `inspector/move-money` step 'on a phone, a tap just outside the inspector ⋯ menu, level with Move down, only closes the menu' taps 2 px left of the settled menu: red edge-tap-red2 (Groceries moved below Dining Out), green layer-5. |
| A6-1 | Major | Fixed in 54db675: a failed shell query (Settings, counts, Categories, Payees) fails the app like a failed owner check or Accounts query, with the centered `Budge couldn't reach its server.` screen. Settings, the cutover date and the Transactions filters drop their own Loading and error branches. New journey `shell/failed-query` turns every `settings:get` result into a query failure: red failed-query-red, green failed-query-green (with `shell/cold-start` and `shell/navigate`). |
| A6-2 | Minor | Fixed in 0bb08e3 (journey guard, no app change). The trace screencast shows the shift at `stopTouching()` in the phone Next Category step: turning touch emulation off switches `pointer: coarse` and `hover`, and the Budget rows behind the dialog change height. The guard counted it when the switch came more than 500 ms after the last tap and the rename's result. The guard now counts a pointer-type switch as input. Probe `debug-cls/pointer-switch.ts` (load at 320×640, touch on, touch off, no tap): red before (shifts 0.2506 and 0.2346), green 3 of 3 after. `inspector/cover-and-manage` passed 4 of 4 (cls-probe-1..4). |
| A6-3 | Nit | Fixed in aed2e9f: a one-Category group's Delete says `Its Category moves to the group you pick, with its history.` and labels the field `Move its Category to`. `categories/manage` checks both: red group-copy-red2, green group-copy-green2. |

### Local code-review of 02de368..0bb08e3 (Sol), Opus decisions

| Finding | Disposition |
| --- | --- |
| P1 outside right-click | Fixed in b5a66e8. bits-ui's dismissable layer ignores a press with `button > 0`, so a right-click on the dismiss layer left the menu open. The layer now passes a non-main press on as a main-button `pointerdown`. `categories/touch-menu` desktop step right-clicks the Coffee name with the Bills ⋯ menu open: red p1-red-touch (menu count stayed 1), green p1-green. |
| P2 press held across a window blur | Fixed in b5a66e8: a window `blur` clears the pressed state. No journey: Playwright can't blur a headless window mid-press; the change is one listener with its cleanup. |
| P3 unreachable branches | Fixed in 3deabe6. The shell gate already waits for Settings, counts, Categories and Payees and fails the app if one fails, so Budget, Bank and Import file no longer re-check them, and the Transactions filter alert is gone. `features/search.md` points to the shell failure instead. |
| S1 guard excused shifts before an input | Fixed in 31b06fb and a64f414. Real input excuses shifts from 50 ms before it to 500 ms after it. The 50 ms is one frame with slack: Chromium times a shift at the start of the frame that handles the input, and `splits/lines` failed 2 of 3 with a zero lower bound (shifts 1.7–1.9 ms before the typed input; runs ac514fd-splits-since-1..3), then passed 3 of 3 (ac514fd-splits-frame-1..3). A pointer-type switch excuses the shifts since the last look that saw no switch, through 500 ms after it was seen. Probe pointer-switch: green 3 of 3. |
| S2 corner check coupled to the layer selector | Fixed in 9a173c5: the check now asserts by geometry that no open menu covers the tapped corner. |
| S3 ambiguous no-choice copy | Fixed in b448e7a: `Add another Category Group first, to take over this Category.` / `these Categories.` |
| S4 duplicated query-set parse | Fixed in ac514fd: one `querySetChanges` helper; `failQueryResult` stops failing a query after a `Remove`. |

`bun run check` at a64f414: 1,145 tests pass, svelte-check 0 errors, capacity check passes.

Full suite at 0bb08e3 (r2-0bb08e3): 65 of 66 passed. `transactions/payee-groups` got a dev-server `500 Internal Error` on a reload while I edited files in the checkout during the run (Vite logged a failed dynamic import at that time). Alone it passed (r2-0bb08e3-payee-rerun).

Full suite at ac514fd (r2-ac514fd): 64 of 66. `budget/assign` hit `net::ERR_NETWORK_CHANGED` on its first `goto` and passed alone (ac514fd-assign). `splits/lines` was the S1 regression fixed in a64f414.

### Sol A final re-check on 5f7a76d (9/10, approve), Opus decisions

Sol A resolved A5-1, A6-1, A6-2 and A6-3 and approved. Opus fixed both new Minor findings.

| Finding | Severity | Disposition |
| --- | --- | --- |
| A7-1 | Minor | Fixed in 051524e (dev branch). A right-click fires `contextmenu`, not `click`, so the layer stayed pressed until its 600 ms timer ended, and a left-click 184–233 ms later landed on the layer and was lost. The layer's `contextmenu` handler now ends the press, as a `click` does. `categories/touch-menu` desktop step right-clicks Coffee with the Bills ⋯ menu open, then raw-clicks Coffee at once and requires the Coffee inspector: red a71-red-3, green a7-green. A first red attempt used `locator.click()`, which waits until the layer leaves, so it passed before the fix (a71-red-2); `features/inspector.md` now says so. |
| A7-2 | Minor | Fixed in 09727af. The round 2 brief said the failure screen shows the server's message, and the app showed only the fixed text. The app now shows the public error's message when the failure has one, and `Budge couldn't reach its server. Try reloading the page.` otherwise. `failQueryResult` can send `errorData` with the query failure. `shell/failed-query` keeps the fixed-text step and adds a NOT_FOUND public error on Bank: red a72-red, green a7-green. |

`bun run check` at 051524e passes (svelte-check 0 errors, lint, tests, capacity check).

### Final three-judge re-check on c77b70e (code = dev 051524e)

| Judge | Score | Verdict | Report |
| --- | --- | --- | --- |
| Sol A | 9/10 | Approve. A7-1 and A7-2 resolved, no new findings. | `ui-review-round-2-sol-a-final-3.md` |
| Sol B | 9/10 | Approve. B2-1 and B2-2 still resolved. B3-1 (Minor) open. | `ui-review-round-2-sol-b-final.md` |
| Opus | Not run | | |

### Sol B finding on c77b70e, Opus decision

| Finding | Severity | Disposition |
| --- | --- | --- |
| B3-1 | Minor | Fixed in b13f082 (dev branch). With no other ordinary group, Delete group said `Its Category moves to the group you pick, with its history.` above the instruction to add a group, and there was no picker. Now the dialog's only description is `Add another Category Group to take over this Category and its history.` (or `these Categories and their history.`). The `concise-copy` rule refused the first wording at 13 words, so `first` is gone. New journey `categories/only-group` on `empty-budget`: red b31-red, green b31-green-2, and `categories/manage` green in b31-green. Opus fixed it before the Opus judge ran, so Opus judges the final SHA. Sol A and Sol B re-check only this change on the same SHA. |

### Results on ad595d8 (narrow re-checks after B3-1)

| Judge | Score | Verdict | Open findings | Report |
| --- | --- | --- | --- | --- |
| Sol A | 9/10 | Approve | None. A7-1 and A7-2 stay resolved. No A8 findings. | `ui-review-round-2-sol-a-final-4.md` |
| Sol B | 9/10 | Approve | None. B3-1 resolved in `f83e0a7`. No B4 findings. | `ui-review-round-2-sol-b-final-2.md` |
| Opus | blocked | | The `claudeTeam` provider hit its weekly limit (reset Nov 24, 11am PT). | |
