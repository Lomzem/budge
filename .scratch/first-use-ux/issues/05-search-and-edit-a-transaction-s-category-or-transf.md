# 05: Search and edit a Transaction's Category or Transfer in place

**Status:** landed — review pending

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** None.

Deliver: choose a Category directly in the register without opening the full dialog, by typing to search. Include Ready to Assign with Categories and Transfer-to-Account choices in a separate section. The dialog uses the same searchable choice where applicable. Preserve existing Transfer linking and Starting Balance restrictions; do not add fuzzy vendor detection. Work deposits, transfers between budgeted Cash Accounts, and card payments retain their existing distinct accounting treatment. Support keyboard and phone use.

Proof: the primary new contract is the browser interaction through search, select, save, and reload, including keyboard and phone reachability. Reuse existing income/Transfer accounting tests. Add a delayed-response case only for a distinct save lifecycle risk, not as another replay of accounting. Use supported UI primitives; resolve any repository Select restriction coherently, without bypassing lint broadly.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Landed 2026-11-13 (commits 70cfb9f..44d4477 on `feat/first-use-ux`)

**Decisions**

- **Server.** A new public mutation, `transactions.categorize`, sets one Transaction's choice: Uncategorized, a Category, or a Transfer. It goes through `categorizeTransaction` in `convex/lib/transactions.ts`, which reuses `saveTransaction` with `{ approve: false }`, so the Transfer pairing, the card-payment rule, the Starting Balance refusals and the monthly totals all stay the existing ones.
  - It refuses a split, whose Categories live on its lines.
  - It keeps approval exactly as it was, so saving a Category alone does not approve (ticket 07).
  - A Transfer blanks the Payee, as the dialog already does.
- **One picker.** `src/lib/components/category-picker.svelte` combines the shadcn-svelte Popover and Command, using bits-ui 2.20.2 and the repo's ScrollArea. It does its own plain substring filter: every typed word must appear in the label, there is no fuzzy matching, and the DOM is never reordered.
  - The order is Uncategorized, Ready to Assign, the Category groups, then a `Transfer to or from` group.
  - The dialog's `Category or Transfer` field and split lines use it.
  - Account and the other fields stay `SelectField`.
  - The Select restriction is resolved by naming `CategoryPicker` in the `eslint.ui.config.js` message and the AGENTS.md rule row; no lint was loosened. The customised `ui/command` and `ui/popover` files are listed in `eslint/ui-ownership.js`, and their unused parts were deleted.
- **Keyboard and phone.**
  - A key typed on the closed button opens the picker with that key already searched. ArrowUp or ArrowDown opens it on the current choice, Enter picks, and focus returns to the button.
  - On a coarse pointer the search field isn't focused on open, so the on-screen keyboard doesn't cover the list. Typed keys still go to the search.
  - The list keeps clear of the tab bar by using the html `scroll-padding-bottom` (the tab bar's height, safe area included) as its bottom collision padding.
  - bits Command's first `scrollIntoView` ran before the popover was positioned and jumped the page to the top. I turned it off (`disableInitialScroll`) and centre the current choice inside the list's own viewport instead.
- **Register.**
  - Each non-split row's Category is a picker named `<Category>, Category of <Payee> on <date>` (`Saving, …` while pending).
  - It offers only the Transfers the row's sign allows (`rowTransferAccounts`): a card outflow offers none, and a Starting Balance offers none.
  - The latest pick per row wins. A superseded pick's late response neither reverts the row nor shows its error.
  - A failed save shows a fixed row error. Success is announced as `<Category> saved for <Payee>`.
  - If the row is focused but leaves the list, focus moves to the row now in its place.
  - Choosing a Transfer on an imported row whose new other Account has `transferCandidates` opens `Edit Transaction` with the Transfer preset (the new `preset` prop), so the existing link prompt still runs.
- **Delayed-response case.** It is added, because the row has a save lifecycle of its own (it doesn't go through `DialogSession`): `transactions/categorize-late`. It needed a new `landEarliest()` in `e2e/heldResponse.ts`. `releaseEarliest` releases only the response, and a mutation resolves only when the Transition after it arrives.

**Changed files**

- Server:
  - `convex/lib/transactions.ts`
  - `convex/transactions.ts`
  - `convex/transactions.test.ts`
  - `convex/owner.test.ts`
- UI:
  - `src/lib/components/category-picker.svelte`
  - `src/lib/components/ui/command/*`
  - `src/lib/components/ui/popover/*`
  - `src/lib/components/choices.ts`
  - `src/lib/components/transactions/categoryChoices.ts`
  - `src/lib/components/transactions/transaction-dialog.svelte`
  - `src/lib/components/transactions/transaction-table.svelte`
  - `src/lib/transactionEditor.ts` (and its test)
- Lint and docs:
  - `eslint/ui-ownership.js`
  - `eslint.ui.config.js`
  - `AGENTS.md` (Prettier realigned the rules table)
  - `.agents/skills/verify-budge/features/{README,transactions}.md`
- E2E:
  - `e2e/journeys/transactions.ts` (`categorize`, `categorize-late`)
  - `e2e/journeys/transfers.ts` (`import-link` now starts from the row)
  - `e2e/heldResponse.ts`

**Tests (red, then green)**

- `convex/transactions.test.ts`, "categorizing a Transaction in place": three tests, all red before the mutation existed (`scratchpad/t05/owner-red.txt`).
  - A probe with `approve: true` fails 2 of them.
- `transactionEditor.test.ts`, "$row offers in place only the Transfers that keep its amount": a sign-blind probe fails 2; 50 pass.
- `transactions/categorize`:
  - Red on the phone scroll jump: listbox viewport ratio 0.34 (`test-results/verify-budge/t05-new-2`).
  - Red with the tab-bar padding removed: the tab bar overlaps the listbox (`t05-red-tabbar`).
  - Green in `t05-new-3`.
- `transactions/categorize-late`: red without the stale-pick guard, which puts Coffee back (`t05-red-stale-2`); green.
- `transfers/import-link`: red without the dialog handoff (`t05-red-link`); green.
- Income, Transfer and card accounting reuse the existing Convex tests.

**Checks**

- `bun run check` passed in full, including `capacity:check`, in a temporary worktree: 905 tests.
- Commit ce1eccf was typechecked alone, and its dialog journeys passed (`t05-commit1`).
- `bun run test:e2e:local`: 51 passed (9.1 min).
- 14 affected existing journeys passed before any changes to them (`t05-existing-1`).
- Final evidence at 44d4477 with no uncommitted changes: `test-results/verify-budge/t05-final`. It covers categorize, categorize-late, transfers/import-link, transfers/pair, payees/last-category, splits/lines, accounts/start-edit, transactions/approve-phone and search/phone.
- The app was stopped and the worktree removed.
- `code-review` and `/correct` were not run, as the brief requires.

**Open questions**

1. Each row renders two pickers, one for the narrow layout and one for the wide one, and CSS hides one. Should it be a single instance moved by layout?
2. The dialog still offers every Transfer and refuses an invalid card direction when you save. The row hides those choices instead. Is that difference acceptable?
3. On touch, the search waits for a tap. Should it focus at once?
