# 02: Confirm Account setup and explain balance uncertainty

**Status:** landed — review pending

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: after connecting, the user can check where each bank account goes, correct a mapping/type choice through supported flows, and establish its Starting Balance before being directed to categorize. A short unresolved problem remains visible; details explain available bank/Transaction inputs and their limitations. Never call a connection or a derived estimate proof of a correct balance. Missing freshness or history coverage is unknown, not invented evidence. Keep the date and long explanations in the decision/details flow.

Proof: extend account-setup journeys for the distinct incomplete/confirmed presentation and correction path. Existing balance/suggestion owner proof remains primary for arithmetic. Extend fixed bank-fixture cases at that owner only if a missing/partial-data contract is absent. Do not replay the same arithmetic in browser assertions.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Implementation (Opus 5.5, 2026-11-12)

Commits: `9c19182` (server and owner tests), `a49d47b` (Bank card, dialogs, journeys, feature map), `142bea4` (layout fix found by verify-budge), and this record.

**Decisions**

- Confirmation is stored per mapping: `startingBalanceConfirmed` (optional literal `true`) on the mapped `connectionAccounts` row. A new mapping is unconfirmed; `setStartingBalance` confirms every mapped feed of its Account (`confirmStartingBalance` in `convex/lib/accounts.ts`). Re-mapping a bank Account makes it unconfirmed again.
- One evidence owner: `bankImportsSince` (`convex/lib/accounts.ts`) returns `{count, total, first, last}` of linked bank rows since the cutover date. Both `suggestStartingBalance` (now also returning `bankBalance` and `imported`) and the new public query `heldAccounts.startingBalanceEvidence` use it, so ticket 03 can reuse it.
- The Bank card lists "Where {connection} goes": each feed shows its Account link, the bank Account label, and while unconfirmed the short problem "Starting balance not confirmed" with a "Check balance" button. The card's all-clear check and the nav "needs you" count include unconfirmed feeds.
- The cutover date and the long explanation live only in the Starting Balance dialog. Its closed "What it’s based on" disclosure lists the bank Account, the bank's balance or "Unknown. reason", "When the bank measured it: Unknown", the imported count and date span, their net amount, and "Every Transaction since … arrived?: Unknown". It also says that neither an estimate nor a working connection proves the balance. Credit cards are labelled "Amount owed on {date}".
- After a confirm on the Bank page, the status line offers "Categorize its Transactions", linking to Accounts filtered to that Account and Uncategorized.
- Corrections reuse the supported flows: card actions, then "Stop syncing {Account}", then Bring back, then Set up (map or a new Account with its type). No new correction mutation was added.
- `142bea4`: the step takes its date from `settings.get`, which is cached on the Bank page, and renders the disclosure from the start, showing "Counting…" until the evidence loads. Without this, the late evidence moved the dialog without user input.

**Changed files:** `convex/{schema,bankConnections,accounts,heldAccounts,owner.test,heldAccounts.test}.ts`, `convex/lib/{accounts,sync}.ts`, `src/lib/bankConnections.svelte.ts`, `src/lib/components/accounts/starting-balance-{step,dialog}.svelte` (dialog is new), `src/lib/components/bank/{connection-card,held-account-dialog}.svelte`, `src/routes/(app)/bank/+page.svelte`, `src/routes/(app)/accounts/[accountId]/+page.svelte`, `e2e/journeys/accounts.ts`, `.agents/skills/verify-budge/features/{README,accounts,plaid}.md`.

**Tests**

- T1 `convex/heldAccounts.test.ts`, "says which bank Account feeds each Account, and that its starting balance is unconfirmed until the owner sets it, again after it's mapped anew".
  - Contract: the feed list gives the bank label and confirmation state; setting the balance confirms it, and re-mapping resets it.
  - Regression caught: a setup the owner never checked shows as done.
  - Red: the feeds lacked `bankName`, `mask` and `startingBalanceConfirmed`. Green after the change.
  - Limit: the reset clause was written with the feature and has no separate red.
- T2 (same file): the suggestion `toEqual`s now include `bankBalance` and `imported`, with independently written values.
  - Contract: the estimate's inputs come from the one owner.
  - Red: the suggestion had neither field.
- T3 (same file): `startingBalanceEvidence` returns the cutover date and the imported rows; `owner.test.ts` registers it for the owner gate.
  - Red: the export was missing.
- Journey `accounts/setup-check` (bank-sync): the problem shows on the Savings feed; Check balance opens the dialog, whose description carries the cutover date; the details show "Unknown." for bank balance, freshness and coverage, plus the connection-not-proof text; Cancel keeps the problem and returns focus; Confirm shows the categorize status, and the problem stays gone after a reload.
- Journey `accounts/setup-correct`: map Sample Savings Plus into Savings and Skip, so the problem shows; Stop syncing, Bring back, then Set up as the new Account "Savings Plus" and Confirm, so the problem clears; the categorize link opens Accounts filtered to Savings Plus and Uncategorized.
- Journey red/green: `setup-check` and `setup-correct` went red on a real defect: a page error "Cannot read properties of null (reading 'mapped')" because the dialog session was read after `close`. They turned green after the fix. They have no pre-feature red, since the UI did not exist yet. `held-new-card` and `held-unknown-kind` now expect the "Amount owed on" label.
- The journeys assert no arithmetic. The amounts stay at the owner.

**Checks**

- `bun run check` (main checkout, at `142bea4`): codegen, format, lint, lint:ui, typecheck and vitest (58 files, 858 tests) passed. `capacity:check` refuses there (backend not anonymous).
- In the worktree after `bun run app up`, `bun run capacity:check` passed (`maxFileRows` 250).
- `bun run test:e2e:local -g "accounts/|plaid/"`: 16 passed.
- Full `bun run test:e2e:local`: 47 passed.

**verify-budge** (worktree runs copied into the main checkout, gitignored)

- `test-results/verify-budge/first-use-02/`, at `a49d47b`: `accounts/held-map` FAILED on the layout-shift guard, because the dialog form moved when the evidence arrived. That failure led to `142bea4`.
- `test-results/verify-budge/first-use-02b/`, at `142bea4`: `accounts/setup-check`, `setup-correct`, `held-map`, `held-new-card` and `held-unknown-kind`, plus `plaid/stop-and-bring-back` and `plaid/attention`, all passed. The capacity log is in the same folder.
- `test-results/verify-budge/first-use-02-manual/` (bank-sync; 1280×800 and 320×640):
  - The card and the dialog with details open were checked by keyboard: Enter on Check balance opens the dialog, and Escape closes it and returns focus to Check balance, with the problem still shown.
  - There is no horizontal scroll.
  - The evidence is PNG and ARIA files, plus `notes.txt` and `manual.ts`.

**Not run here (per the brief):** local `code-review`, `/correct`, and the three-judge UI review. All are pending.

**Open questions**

- Every existing mapping, live or seeded, starts unconfirmed, so after this lands each feed asks once. Is that wanted, or should a migration confirm Accounts that already have a Starting Balance?
- Should changing the cutover date un-confirm the feeds? Today it does not.
- Stop syncing keeps wrongly mapped Transactions in the old Account, so the corrected Account starts empty. Moving them is not a supported flow.
- "When the bank measured it" is always Unknown. Plaid's balance timestamp isn't stored.
- The card menu's "Stop syncing {Account}" is ambiguous when two bank Accounts feed one Account.
