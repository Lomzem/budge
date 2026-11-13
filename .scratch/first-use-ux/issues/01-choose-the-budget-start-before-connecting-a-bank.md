# 01: Choose the budget start before connecting a bank

**Status:** landed — review pending

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: a fresh user sees the first of this month as the proposed start, can choose another valid date, and connects/imports against the saved boundary. Pre-start bank history does not become a review backlog. The routine Account view gains no persistent start-date label. Reuse current date enforcement and import filtering rather than adding a parallel concept.

Proof: the primary new contract is the onboarding journey's default, save, and import handoff, including month-boundary behavior under a controlled clock. Existing import-owner tests retain responsibility for filtering before the boundary. Add filtering cases only for an independently missing contract.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Implementation (Opus 5.5, 2026-11-12)

**Decisions**

- The owner of the start date is the existing **cutover date** (`settings.cutoverDate`, `convex/settings.ts`, read by `requireCutoverDate`). No new concept: file imports (`decodeBankFile`/`requireBankRow`), Plaid sync (`syncRowsOf`) and held Accounts already drop rows before it, and Starting Balances are dated on it.
- The one change is the proposal: `src/lib/components/settings/cutover-date.svelte` now proposes `dayOfMonth(monthOf(localToday()), 1)` (the first of the browser's local month) instead of today. The same component is the fresh Budget's setup card and the Settings control, so both entries propose the same default, and Change still starts from the saved date.
- The card now states the consequence at the decision: earlier bank transactions aren't brought in, and each Account's starting balance is its balance on this date. No Account view label was added.
- Considered and left out: embedding the date choice on the Bank page (its blocker still links to Settings, which now proposes the same default), and renaming the "Cutover date" heading (it is shared by Account dialog, Starting Balance and import copy; out of this ticket's scope).

**Changed files**

- `src/lib/components/settings/cutover-date.svelte`: default and explanatory copy.
- `e2e/journeys/settings.ts`: new journey `settings/start`.
- `.agents/skills/verify-budge/features/settings.md`, `.agents/skills/verify-budge/features/README.md`: `cutover-default` sub-feature and the `settings/start` journey.

**Test added**

- `settings/start` (E2E + `bun run app verify` target, fixture `empty-budget`). Contract: a fresh budget proposes the first day of the local month containing the browser clock, on both sides of a month boundary (fixed clock one minute before and after local midnight on the 1st); saving the proposal and importing a bank file into a new Account previews and imports only the row on the start, leaving `Accounts 1 Unapproved`. Regression it catches: the old today default (proposes the last day of the month a minute before it turns) or an import that does not use the saved start. Expected dates come from Node `Date` constructors, not the component. No test-only seam: the clock is Playwright's `page.clock`. Existing filtering owners (`src/lib/domain/bankFiles.test.ts`, `src/lib/domain/plaid.test.ts`, `convex/imports.test.ts`) keep the before-start filtering cases; no filtering case was added.
- Red: before the fix, step 1 failed with `Expected: "2026-10-01" Received: "2026-10-31"` (`bun run test:e2e:local -g settings/start`). Green after the fix; `settings/cutover` passes alongside (36.5 s for both).
- Limit: the clock follows the browser's time zone, which the journey cannot set. A month computed in UTC rather than local time is caught only where that zone is not UTC (it is on the PST dev machine; a UTC CI runner would not catch it).

**Checks**

- `bun run check` in the main checkout: codegen, format, lint, lint:ui, typecheck and `vitest` (58 files, 856 tests) passed; `capacity:check` refuses there (its `.env.local` targets a non-anonymous local backend), so it ran in a detached worktree with `bun run app up`: passed (`maxFileRows` 250).
- `bun run test:e2e:local -g settings/` passed (2); full `bun run test:e2e:local`: 45 passed.
- `bunx vitest run scripts/app/featureMap.test.ts`: passed.

**verify-budge evidence** (worktree run copied to the main checkout, gitignored)

- `bun run app verify settings/start settings/cutover --run first-use-01`: both pass; `test-results/verify-budge/first-use-01/` (per-step PNG/ARIA, traces, `summary.json`).
- Manual 320×640 phone check (fresh `empty-budget`, real clock): proposal is 2026-11-01, Enter in the date field saves it, the card shows "Budge starts on Nov 1, 2026" with Change focused, and Settings shows the saved date after reload; `test-results/verify-budge/first-use-01-manual/01-phone-proposal.png`, `02-phone-saved-keyboard.png`, `03-phone-settings.png`.

**Not run here (per the shared brief):** local `code-review` and `/correct`; the parent commissions them. The `principles` skill is not installed; the principles README and the required references were read directly.
