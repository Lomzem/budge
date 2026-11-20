# Budget-first UI and copy guard

Status: in progress (Opus, worktree `/home/lomzem/proj/budge-ui`, branch off `main` 2c45ac0)

## Owner requests (2026-11-18)

1. Remove the Categories tab; manage Categories from Budget.
2. A context menu on Budget rows (right-click on desktop, long-press on touch).
3. Rename the Accounts tab to Transactions.
4. Remove copy the owner rejects. `docs/quality/copy-review.md` lists every example.
5. No "Add to home screen" on a laptop.
6. No "Select a Category." placeholder panel.
7. Upcoming must not say Funded and No for one fact.
8. Tighter density and text size (Ready to Assign).
9. A click anywhere on a Budget row selects it.
10. Picking a Category on a Transaction approves it.
11. Moving between tabs should not flash "Loading…".
12. Prevent the copy from returning, using lint rules with useful diagnostics, plus a focused review round for judgment calls.
13. Sol never edits UI. Opus owns UI. Sol does research, CI, lint rules, and PR babysitting.

## Decisions

- Budget rows: each group and Category row is a `ContextMenu.Trigger` (bits-ui). Its menu entries come from `src/lib/components/menu/`, shared with the group ⋯ button and the inspector. The Category menu holds Rename, Move up, Move down, Move to group, Hide, and Delete…. The group menu holds Add Category, Rename, Move up, Move down, Hide, and Delete…. A row click selects; while the menu is open, a click does not select. Touch long-press opens the menu without selecting.
- Category state and mutations live in `src/lib/categoryActions.svelte.ts` (one owner). Hidden rows live in `hidden-categories.svelte` under a "Hidden" heading on Budget.
- With nothing selected, the Budget side panel shows Upcoming. Upcoming shows one status, `Not funded`, and only on rows due this month that are short. There is no Funded or No column.
- Export moves from a dialog to buttons in an `Export` region on Settings (`export-buttons.svelte`). The export dialog and the home-screen dialog are deleted.
- Cutover date: the "moved from" history and the Undo move control are removed from the UI. Backend removal of `undoLaterCutover`, `lastMove` and `cutoverMoves` is a follow-up and needs a Sol scout first.
- Categorize approves: `transactions.categorize` approves on a Category or Transfer choice. Uncategorized leaves approval alone. `categorizeMany` and agents approve only when asked (GLOSSARY "Unapproved"). Focus follows to the next Unapproved row, as in Approve.
- Target text is terse (`$59.98, due 1st`, `$600 by Dec, monthly`).
- Tab switches: the app layout owns a `ShellQueries` context (`src/lib/shellQueries.svelte.ts`). It holds `settings.get`, `transactions.unapprovedCount`, `transactions.bankChangeCount`, `categories.list` and `payees.list`, and pages read those from it, so a tab switch reads live results instead of resubscribing. Cold entry and the Transaction table's pagination are unchanged. Authenticated SSR and intent warming are deferred; Sol's research covers both.
- Picking the Category a Transaction already has still saves when the row is Unapproved, so it approves (`changeOf` in `transaction-table.svelte`).
- Copy cuts from Sol's inventory:
  - the inspector's all-clear card-payment note;
  - the Bank empty-state helper;
  - the Bank card's two explanation lines under the held and ignored headings;
  - the held-account waiting note, which now shows only the count;
  - the hint for an empty "Remember";
  - the "Approve them too" hint;
  - "No bank changes wait on you.", which is now "No bank changes."
- Copy guard has three parts:
  - `local/banned-copy` covers phrasings.
  - `local/no-heading-lede` covers structure: a muted line under a page or section heading.
  - `docs/quality/copy-review.md` covers judgment calls (Sol reports, Opus decides).
  - A "muted prose" rule was rejected: too many legitimate consequence lines in confirm dialogs.

- Copy guard, final shape:
  - `local/no-heading-lede` flags only a muted `<p>` holding a sentence directly under an `h1`–`h3`. Dialog descriptions and value lines like `Net balance {amount}` pass.
  - The target dialog's `Each month` legend is now `Funding`.
- `local/shell-queries` takes its query list from `src/lib/shellQueries.svelte.ts`, so the two can't drift.
  - It flags only unscoped calls (`{}`, or `'skip'`), so the Account-scoped counts in `transaction-table.svelte` stay page-local.
  - Every dialog now reads these queries from `getShellQueries()`.
- `local/exception-terms` requires every exception to the guarded rules to read `-- <reason>; expires YYYY-MM-DD; approved by <owner>`. Lint fails once the date passes.
- Sol UI guard: `scripts/ui-owner.sh` runs as the first lefthook pre-commit job. In a Codex session, it refuses staged UI paths.
  - A stronger guard is the owner's Codex permission profile with `src/**` set to `read`. Only the owner can set it.
- AGENTS.md's `## Rules and their enforcers` replaces `## UI copy`. The copy review is now step 4 of Every ticket.

## Changed files

See `git status` on the branch. Main areas:

- Budget: `budget-table.svelte`, `upcoming-list.svelte`, `hidden-categories.svelte`, `menu/`, `ui/context-menu/`, `rowClick.ts`, `categoryActions.svelte.ts`.
- Routes: `/accounts` becomes `/transactions`; `/categories` is deleted.
- Shell: `views.ts`, `tab-bar.svelte`, `account-sidebar.svelte`.
- Copy: `connection-card.svelte`, `bank/+page.svelte`, `cutover-date.svelte`, `status.ts`, `settings/+page.svelte`.
- Convex: `categorize` approves.
- e2e journeys: categories (rewritten), shell, budget, inspector, export, settings, transactions, payees, search, targets.
- verify-budge feature maps are being updated by Sol; Opus reviews the diff.

## Verification

- Done: `bun run lint`, `bun run lint:ui`, and `svelte-check` pass.
- Done: `bun run test` (1111 passed). An earlier run that timed out 5 tests ran beside Playwright; it passes alone.
- Pending:
  - e2e journeys (rerun on the live worktree after the six fixes);
  - verify-budge in the browser;
  - code-review;
  - the copy review;
  - the three-judge UI review;
  - gitleaks.

- Proofs against past mistakes, using files from `main` linted in place:
  - banned-copy flags:
    - `Budge tracks`;
    - `moved from`;
    - `Budge checks`;
    - `Nothing needs you` and `right now`;
    - `each month` ×3 and `due on the` in `status.ts`;
    - `Each month` in `target-dialog.svelte`.
  - no-heading-lede flags the Bank subtitle, the cutover helper, and Settings `Your data`.
  - shell-queries flags the `main`-era `settings.get`, `categories.list` and `payees.list` subscriptions.
  - `ui-owner.sh` exits 1 with `CODEX_THREAD_ID` set and 0 without it.
- The categorize-bulk journey's last step re-picks Groceries on Unapproved SAMPLE HARDWARE. It proves that row is approved and that the bulk Undo retires.
- The local Playwright suite ran on the dirty worktree snapshot at `be2cbf8`: 58 passed, 6 failed, 0 skipped. The same-Category re-pick passed. The live worktree received further edits after the snapshot was copied.
- Failures to resolve: waiting-count punctuation, Category management reading before Budget loads after reload (reproduced in isolation), a hidden uncovered card-debt warning on Budget, an ambiguous Savings Goals button locator, stale Remember announcement copy, and a phone Transaction locator that changes rows after approval.
- Evidence and runner commands are in `/tmp/budge-ui-journeys.q2fupf/`. The isolated runner initially omitted two Clerk values from Playwright's environment. A process-local handoff used the existing development credentials.

### Live-worktree Playwright rerun (2026-11-18)

- **62 passed, 2 failed, 0 skipped** in 11.8 minutes at `be2cbf8` with the uncommitted edits in `/home/lomzem/proj/budge-ui`. This completes the pending E2E rerun above. The held-card count, card debt, inspector, Remember, and phone Categorize journeys passed. Category management passed the first post-reload assertion and failed at a later one.
- Ran the full Playwright registration against the worktree-local Vite and anonymous Convex started by `bun run app up`. The stock `test:e2e:local` wrapper copies the checkout. Its Playwright environment filters inherited Clerk and E2E settings and omits `CLERK_JWT_ISSUER_DOMAIN` and `E2E_CLERK_USER_ID` at `e2e/run-local.ts:65–73`. The live launcher passed the existing Clerk settings to the test process only.
- `accounts/setup-check`, “its basis names the bank Account and calls what Budge cannot know unknown” — **test issue**. The assertion at `e2e/journeys/accounts.ts:436` expected “Check your balance at the start of”. The dialog renders “Check your bank statement for the balance at the start of” at `src/lib/components/accounts/starting-balance-step.svelte:277`. Update the assertion to the approved wording. [Failure screenshot](/tmp/budge-ui-live-journeys.LtaE4A/results/journeys-accounts-setup-ch-280e7--basis-says-what-is-unknown/test-failed-1.png).
- `categories/manage`, “a new group needs its own name, and a Category the server refuses is retried into that same group” — **test issue**. At `e2e/journeys/categories.ts:121` the direct read expected `["Smoke Test Category"]` and got `[]` while the page displayed `Loading…`. `reloadOnceSaved` at `e2e/journeys/journey.ts:206–209` waits for navigation. Budget renders the table once the view is ready at `src/routes/(app)/+page.svelte:335–337`. Poll the scoped group assertion after reload as the preceding step does at `e2e/journeys/categories.ts:91–94`, and apply the same wait to the immediate reads at lines 152 and 205–207. [Failure screenshot](/tmp/budge-ui-live-journeys.LtaE4A/results/journeys-categories-manage-f7a0e-t-menu-and-the-changes-last/test-failed-1.png).
- [Playwright JSON report](/tmp/budge-ui-live-journeys.LtaE4A/full.json) and [redacted terminal log](/tmp/budge-ui-live-journeys.LtaE4A/full.log). Authenticated Budget and the Groceries Assigned field were visible before the suite. `bun run app down` completed and both recorded services stopped.
- **Prove It Works** led to the authenticated browser readiness check and a direct check of the stopped process IDs. **Guard the Context Window** kept the full logs on disk while failure diagnosis used the two Playwright error contexts and the relevant source lines.

### Live-worktree Playwright rerun after review fixes (2026-11-18)

- **Playwright: 62 passed, 2 failed, 0 skipped** in 12m 36s, one worker, on the live uncommitted `/home/lomzem/proj/budge-ui` worktree at `be2cbf8`. The live launcher used the worktree-local Vite and anonymous Convex and passed the Clerk settings to the Playwright process. Verified the authenticated Budget heading and Groceries Assigned field before running the suite. The previous Accounts wording and Category post-reload assertions cleared. The shell’s new no-`Loading…` check passed. [Full Playwright log](/tmp/budge-ui-review-rerun.UxXrMX/full.log) · [JSON report](/tmp/budge-ui-review-rerun.UxXrMX/full.json).
- **`bun run check` passed** with the app up, including 1,121 Vitest tests and the capacity contracts. [Check log](/tmp/budge-ui-review-rerun.UxXrMX/check.log) · [Capacity summary](/home/lomzem/proj/budge-ui/test-results/capacity/2026-11-18T13-13-04.822Z/summary.json).
- **`bun run test` passed** with 1,121 tests across 67 files, after `bun run app down`. Both recorded process groups and children were gone, the ports were closed, and the running record was removed. [Unit log](/tmp/budge-ui-review-rerun.UxXrMX/unit.log) · [Shutdown log](/tmp/budge-ui-review-rerun.UxXrMX/down.log) · [Service verification](/tmp/budge-ui-review-rerun.UxXrMX/stopped.log).

- `categories/manage`, “a right-click on a row opens its menu; Rename edits in place, refuses an empty name, and Escape keeps the old one” — **test issue**. [The click](/home/lomzem/proj/budge-ui/e2e/journeys/categories.ts:46) expected a single Rename item for the group. Playwright found both the group dropdown’s Rename and the Category context menu’s Rename. [The group helper call](/home/lomzem/proj/budge-ui/e2e/journeys/categories.ts:148) follows the row rename, and [the context menu](/home/lomzem/proj/budge-ui/src/lib/components/ui/context-menu/context-menu-content.svelte:26) has a 100 ms exit animation. Scope the helper to the open group dropdown before clicking Rename. [Screenshot](/tmp/budge-ui-review-rerun.UxXrMX/results/journeys-categories-manage-f7a0e-t-menu-and-the-changes-last/test-failed-1.png) · [Playwright error context](/tmp/budge-ui-review-rerun.UxXrMX/results/journeys-categories-manage-f7a0e-t-menu-and-the-changes-last/error-context.md).
- `inspector/cover-and-manage`, “on a phone, a name left by tapping Next Category goes to the Category it was typed for, and the next one opens untouched” — **likely product bug**. [The focus assertion](/home/lomzem/proj/budge-ui/e2e/journeys/inspector.ts:406) expected Dining Out’s Assigned field to be focused. After 5 seconds there was no Dining Out dialog and the Sample Grocer dialog remained open with the updated name. [InlineName commits on deferred blur](/home/lomzem/proj/budge-ui/src/lib/components/categories/inline-name.svelte:140). [Next relies on a click](/home/lomzem/proj/budge-ui/src/lib/components/budget/category-inspector.svelte:329) to [select the new Category and focus Assigned](/home/lomzem/proj/budge-ui/src/routes/(app)/+page.svelte:280). Confirm touch event delivery to Next, then keep the touch target stable through the blur or coordinate the rename and navigation in the same activation. The failure artifacts do not establish which event was lost. [Screenshot](/tmp/budge-ui-review-rerun.UxXrMX/results/journeys-inspector-cover-a-69c43-letes-its-Category-in-place/test-failed-1.png) · [Playwright error context](/tmp/budge-ui-review-rerun.UxXrMX/results/journeys-inspector-cover-a-69c43-letes-its-Category-in-place/error-context.md).

- **Prove It Works** led to checking authenticated page controls and directly checking stopped process IDs and closed ports. **Guard the Context Window** kept complete command output on disk and focused failure analysis on the relevant reports, screenshots, and source lines.

### Dispositions for the second rerun (Opus)

- Both failures had the same product bug, not a test issue.
  - A menu, select, or popover that was closing stayed in the page during its 100 ms exit animation.
  - bits-ui gives the closing content an inline `pointer-events: auto`, and its floating wrapper also catches hits. So the closing popup swallowed the next tap (the phone Next Category) and left a second set of menuitems in the accessibility tree (the duplicate Rename).
  - A probe showed the lost tap landing on the closing dropdown's content.
  - `data-closed:pointer-events-none` lost to the inline style. Its `!` variant moved the hit to the wrapper.
- Fix: the menu, select, and popover content components drop their `data-closed:` exit animations, so a closed popup unmounts at once. Dialogs and alert dialogs keep theirs, because their overlay blocks the page on purpose. The group-menu helper in the journey was left unscoped: the duplicate items were the bug.
- The new dismissal step exposed a second bug. Right-clicking a row on its Assigned field selects that field's text. `clickedTheRow` read `getSelection().toString()`, which in Chromium reports text selected inside an input, and so it ignored the next row click. It now checks `getSelection().isCollapsed`: a drag across row text is a Range, while an input's selection is collapsed at document level.
- With nothing animating out, Escape removes a menu one frame later. The categories journey now asserts that the menu is gone before it opens the group menu.
- `categories/` and `inspector/` journeys: 6 passed after these fixes.
- Guard: `bun run lint:ui` refuses a `data-closed:` exit animation in menu, select, and popover content, so a shadcn re-add can't bring the bug back (`eslint/rules/popup-exit-config.test.js`). Proof: it flags the be2cbf8 dropdown, popover, and select content and the context menu as shadcn generates it. The two sub-content files joined the owned list in `eslint/ui-ownership.js`, so they are linted. `dropdown-menu-sub-content`'s `min-w-[96px]` became `min-w-24`.

## Code review dispositions (Sol reported 14 findings, Opus decided)

1. Keyboard reorder: fixed. The inspector's actions menu and the row's context menu now share `categoryMenu` (`src/lib/components/menu/category-menu.ts`), so Enter on a Category opens the inspector, and its menu offers Move up and Move down. The categories journey drives that keyboard path.
2. Duplicate group names: fixed. Sub-menu items carry a `key` (the group ID).
3. Dismissal click: fixed. The `clickClosingAMenuOnlyClosesIt` attachment reads the menu state on `pointerdown` and swallows the click that closes it. The journey clicks another row's name while the menu is open.
4. Separate inspector menu: fixed. The inspector uses `CategoryActions` and the shared entries. Hidden groups stay valid destinations on both surfaces.
5. Hidden group balances: fixed. Each member of a hidden group lists its Available balance under the group's single Show button.
6. Transfer handoff focus: fixed. After a successful save, focus moves to the next Unapproved row in the order captured before the handoff. Cancel keeps the opener.
7. Register counts: fixed. The all-Accounts register reads both counts from `getShellQueries()`. It subscribes locally only with an `accountId`.
8. Exception rule: fixed. `exception-terms` runs in its own pass with inline config off. It refuses blanket, block and inline-config exceptions and non-calendar dates.
9. `shell-queries` binding: fixed. It resolves `useQuery` to the `convex-svelte` import, follows aliases, ignores local functions, and reads block-bodied argument callbacks.
10. Starting-balance assertion: fixed in the journey and the feature map.
11. Heading guard: fixed for literal mustaches, `class:text-muted-foreground`, and sentences ending in a digit. Kept: `Net balance {amount}.` counts as prose. A value line under a heading carries no full stop.
12. Literal expressions: fixed. `literalText` reads string and expression-free template literals in markup.
13. Journey gaps: fixed in four of five.
    - Dismissal uses a real click.
    - Ordering runs both directions and compares the full order after reload.
    - Focus lands on the expected next Unapproved row.
    - A MutationObserver fails the tab step on any `Loading…` status.
    - Upcoming asserts that short and funded rows carry no second status word.

    Deferred: the short Target due next month inside the 30-day window. The journeys run on the real clock, so the case exists only late in a month. `src/lib/domain/budget.test.ts` (“lists Targets due in the next 30 days…”) covers an unfunded Target due next month inside the window.
14. `reorderHandle`: removed. `src/lib/reorder.ts` keeps only `moveInList`.

## Copy review dispositions (Sol reported 42 findings, Opus decided)

Cut or rewritten:

- Upcoming: empty state removed. The section renders only when it has rows.
- Budget: the `No Categories yet.` paragraph is cut. The phone menu `Edit Categories` (pencil) is now `Add Category or Group` (plus), since it holds only add actions.
- Cutover preview:
  - the description is now `Currently {date}.`;
  - the no-earlier-history line is now `Balances and Transactions stay the same.`;
  - the obsolete `Settings offers Undo move…` line is cut;
  - the button reads `Move cutover date`, matching the Settings label.
- Reconcile:
  - the description is now `Cleared Transactions lock as Reconciled.`;
  - the `It matches the cleared balance.` all-clear is cut;
  - the off-by line is now `Off by X. The adjustment goes to Ready to Assign.`
- Bank:
  - the empty Connections card is cut; the section renders only with connections;
  - the overdue status is now `Sync overdue. Try Sync now.`;
  - the history line ends at the old Account;
  - remove-connection now reads `Syncing stops and transactions waiting for setup are deleted. Imported ones stay.`;
  - ignore-held now reads `Its waiting transactions are deleted. Bring it back from its Bank card.`
- Starting balance: `Check your bank statement for the balance at the start of {date}.`
- Import formats: `Capital One or Discover CSV, or QFX.`, matching the parser's error.
- Transaction dialog:
  - the split hint is now `Use a minus sign for a line in the opposite Direction.`;
  - the starting-balance hint is now `A starting balance has no Payee.`;
  - the Bank Row overflow note is now `Only some Bank Rows are shown.`
- Transaction table: the unchecked-filters filler is cut. The alert already says what failed.

Kept:

- `No Accounts yet` on an empty Budget: it frames the setup actions.
- `All Accounts`: the heading names the table's scope.
- The Plaid-credentials notice: the owner self-hosts, and it names what to configure.
- The four bank-removal delete confirmations: destructive confirmations get cause and consequence (copy-review.md).
- The Unreconcile consequence: destructive, and Sol's claim about editable fields is unverified.
- `Approved X as Y`: already terse.
- The export statuses.
- The bank-change blocker text in the cutover preview: deferred, needs a check against the controls' names.
- Target progress: the bar reports a percentage, and the status beside it carries the dollar shortfall (`$25.00 more needed`). A Target with nothing to fund shows no `Funded` status. `targets/monthly` asserts the shortfall text.
- The assigned-input `Esc` hint: a phone can have a keyboard. Deferred.
- The account-dialog cutover-date description: the person needs the date.
- `Feeds no Budge Account yet.`: a journey covers it, and it carries the reconnect instruction.
- `Use the bank's`: width-limited; its aria-label carries the full action.
- `Took the bank's version` and `Remember for X's later imports`: scope claims unverified. Deferred.

## Verification after the popup fix (dcff540)

- Sol ran three checks, all exit 0: `bun run check` (1,128 tests and the capacity contracts), `bun run test` (1,128 tests), and the full live journey suite (64 of 64).
- Opus ran `bun run app verify` on categories/manage, categories/touch-menu, inspector/cover-and-manage, targets/monthly, shell/navigate, shell/phone-pages, transactions/categorize and plaid/status. All passed. Evidence: `test-results/verify-budge/budget-first-ui-opus/`.
- `gitleaks git --staged --redact` found nothing. Committed as `dcff540`. The UI review brief is `680e696`.

## Remaining

- Three-judge UI review, round 1, at `680e696`: Sol A, Sol B and Opus are running in separate worktrees. Brief: [ui-review-round-1.md](ui-review-round-1.md).
- Ship through a top-level Sol thread once the gate passes.
- Follow-up: a Sol scout on removing the backend cutover undo and on the Clerk variables in `e2e/run-local.ts`. Running.
