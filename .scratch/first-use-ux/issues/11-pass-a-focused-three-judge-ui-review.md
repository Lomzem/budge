# 11: Pass a focused three-judge UI review

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 01–10 — use the maintained workflow to review the complete first-use UX on one integration revision after feature checks and corrections.

Deliver: complete the maintained three-judge UI review for the agreed first-use and review journeys: start-this-month onboarding, Account/balance confidence, repair preview/confirmation on synthetic data, searchable inline Category/Transfer choices, explicit Category memory, multiple selection, Payee groups, undo, and Sync feedback. Evaluate desktop, keyboard, and phone behavior, including the narrow phone layout. Keep the scope on these journeys and their dependencies.

Acceptance: the maintained protocol's final-revision approval gate passes for this complete focused scope. Record each judge's independent report, evidence, and the disposition of every finding using its template. Opus owns UI/production fixes; Sol coordinates reviews.

Proof: use verify-budge with synthetic fixtures and managed authenticated sessions. The judges' browser observations and reports are the acceptance evidence; retain the deterministic tests' separate role. Pass any new regression tests through test-audit; use existing journeys rather than creating duplicate suites for individual judges.

Workflow: use the [maintained protocol](../../../docs/quality/ui-review/README.md), its rubric, and its report template. This ticket supplies the first-use scope; the maintained protocol owns the reusable review and session rules.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Round-1 correction: one focus resolver for every dialog (Opus 5.5, 2026-11-14)

Source: recommendation 2 of `reviews/11/round-1/fix-review.md`, accepted. Ticket Status is unchanged.

**Decision.** `src/lib/focusReturn.ts` exports `restoreFocus(destinations, opened)`, the one resolver. It tries the opener (the element focused when the dialog opened), then the caller's `continuation`, then the caller's `fallback`. It never focuses `<body>`, and it leaves focus alone when the page already moved it outside every dialog before the content unmounted (removing a connection, closing the inspector). The `Dialog.Content` and `AlertDialog.Content` wrappers own it: they capture the opener in `onOpenAutoFocus` and call the resolver in `onCloseAutoFocus`. Their props omit `onCloseAutoFocus` and require `returnFocus: FocusReturn`, whose `fallback` is required, so a dialog can't skip the resolver or a stable destination. `mainRegion` (`#main`, the skip-link target) is the shared fallback. DialogSession isn't the owner: several dialogs don't use it, and it owns async run ownership, not focus.

`FocusReturn.opener` is an optional override that receives the captured opener. A caller whose old code put its own destination before bits' default uses it to keep that order. Three callers need it: the transaction table (the edited row, found by id, or nothing once deleted), the removal confirmation (the opener counts only when no row came next), and the Bank page (the opener counts only outside setup and confirm). The fourth is the cutover date field, which returns to its date field. Without the override, the opener wins while it is still connected but already on its way out, and focus then falls to `<body>`. transfers/pair caught this on the first green run. The override restores each caller's old destinations.

**Callers migrated (all 18 dialog files):**
- Fallback only (opener first, then `#main` where bits used to leave `<body>`): account, reconcile, rename-account, add-category, target, delete-category, delete-group, categories rename, export, home-screen and import dialogs; the inspector dialog on the Budget; the account page's starting balance.
- Callers with their own destinations:
  - the Bank page's held and starting-balance dialogs (`afterSetup`, a pure value that replaces `focusAfterDialog`, which had side effects);
  - connection removal (continuation: the actions button);
  - the transaction dialog and its four confirmations;
  - the table's removal confirmation;
  - the later-cutover preview.

The four confirmations return to their trigger while the Edit dialog stays open; otherwise they resolve like the Edit dialog.

Two related changes:
- The later-cutover preview's `onclosed` callback is gone. `cutover-date` now asks the dialog `isOpen()` in place of its own `previewing` flag. The flag was cleared after focus returned, which ate the Escape that settings/later-start presses next.
- `bank/+page.svelte` no longer resets `settingUp`/`landed` inside a focus callback. `setUp()` and `check()` already reset them.

**Left out:** DropdownMenu and Popover (the category picker) aren't dialogs, and bits already returns their focus to the trigger. Page-level focus moves outside dialog close (`removed()`, `closeInspector()`, `startChange`/`stopChange`) aren't dialog restoration.

**Changed files:**
- `src/lib/focusReturn.ts` (new).
- The two `ui/*-content.svelte` wrappers and the 18 dialog files and pages above.
- `AGENTS.md`: Enforced rules row.
- `.agents/skills/verify-budge/features/shell.md`: Focus-after-a-dialog gotcha.

**Evidence** (`reviews/11/round-1/focus-resolver/`):
- `typecheck-unmigrated.log`: svelte-check rejects all 18 dialog files before migration.
- `typecheck-no-fallback.log`: a caller without `fallback` fails to compile. The error is at `connection-card.svelte:562`: "Property 'fallback' is missing".
- Replay: `replay-remove-destinations.diff` removes ca0239c's Bank destinations, and `replay-probe-main.diff` retargets the four journeys' focus assertions to a probe of `document.activeElement`. In `journey-runs.txt`:
  - The original assertions fail, because the specific targets are lost.
  - The probe gets `main#main` on all four journeys (held-legacy-name, setup-check, setup-correct, held-ignore).
  - With the fallback disabled (`replay-no-fallback-control.txt`), the same probes get `body`, the round-1 failure.
- `journey-runs.txt` also has the first green run of all 56 journeys. It had two failures: transfers/pair and settings/later-start, which failed again on three reruns. After the fix, all 17 affected journeys pass.

**Checks:**
- `bun run check` passed in the worktree with identical sources (924 tests, capacity:check included).
- Typecheck, lint and lint:ui pass in the main checkout.
- `bun run test:e2e:local`: 56 passed in 8.5 minutes (`test-e2e-local.log`).

**Open questions:** both are resolved by the follow-up below.

#### Follow-up: menu openers and nested dialogs (Opus 5.5, 2026-11-14)

The coordinator ruled that both open questions were regressions against "no behavior change". Both are fixed in the resolver, with no per-caller changes.

- **Menu-opened dialogs.** The wrappers record the opener through `dialogOpener()`. When the focused element is inside a `role="menu"` content, it records the trigger whose `aria-controls` names that menu (bits sets it while the menu is open). The continuation and fallback still follow. Finding: HEAD already returned focus to the trigger on every probed path (pointer and keyboard; Starting balance and Rename). That is because bits' menu content refocuses its trigger before the dialog's focus scope registers. The mapping guards that ordering; no journey reaches it today.
- **Nested dialogs.** `restoreFocus(destinations, opened, closing)` finds the topmost dialog still open (`data-state="open"`, excluding the closing content). While one is open, every destination must lie inside it; when none does, focus goes to its first focusable control, else to the dialog itself. Unlock over Edit Transaction now stays in Edit. Other nesting: only the Target dialog over the phone inspector. It already kept focus in the inspector at HEAD (probe) and still does.
- Docs: the `AGENTS.md` rule row, the `shell.md` gotcha, and the `accounts.md` and `reconciliation.md` journey entries.

**Proof** (`followup-red-green.txt`):
- New assertions:
  - accounts/start-late-save: Escape focuses `Checking actions`.
  - accounts/setup-check: Confirm focuses `Savings actions`.
  - reconciliation/difference: focus is inside the Edit dialog after Unlock.
- Red on HEAD: only reconciliation/difference failed.
- The menu assertions were already green on HEAD. Each fails under a control that drops the account page's opener.
- Green: all 56 dialog journeys pass.
- `bun run check` passed (924 tests, capacity:check included).
- `bun run test:e2e:local`: 56 passed in 8.8 minutes (`followup-test-e2e-local.log`).
