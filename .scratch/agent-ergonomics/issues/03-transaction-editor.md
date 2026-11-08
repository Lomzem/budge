# 03: A Transaction editor module behind the dialog

**Status:** done

**Spec:** [Agent ergonomics](../spec.md), scope 3

**Blocked by:** 01 (the dialog uses the new opening module)

## Problem

`src/lib/components/transactions/transaction-dialog.svelte` is ~837 lines. One string holds the selection: a Category id, `'transfer:'…`, `'split'`, or unresolved (`const TRANSFER = 'transfer:'; const SPLIT = 'split';` ~106-107). A loading or failed lookup has collapsed into a valid Uncategorized save at least 3 times. Editing rules (Payee recall, manual override, switching to split, direction change, Transfer) can only be exercised through Playwright.

## What to build

- A framework-free editor module (pure TypeScript; Svelte runes only in the adapter) that owns the draft: date, amount and direction, Payee, memo, the selection as a discriminated union (loading · failed · resolved · chosen Category / Transfer / split), split lines, and the derived "ready to save" and save payload.
- Encode it so an unresolved selection cannot produce a save payload.
- The dialog becomes a thin adapter: it renders state, feeds query outcomes and user events into the editor, and sends the payload. Server validation stays authoritative.
- Unit tests own the transition rules. Browser tests keep only wiring, a11y, and the end-to-end save. Delete E2E assertions that only re-prove transition rules the unit tests now own, if any.

## Acceptance

- [x] The selection type cannot represent "save while loading/failed"; a test proves the editor yields no payload in those states.
- [x] `transaction-dialog.svelte` holds no editing rules beyond wiring (line count reported).
- [x] `e2e/transactions.test.ts`, `e2e/splits.test.ts` and the other dialog E2E pass; `bun run check` passes.

## Comments

Implemented on `ergo/a-dialogs-editor`, on top of ticket 01.

**Decisions**

- `src/lib/transactionEditor.ts` is plain TypeScript. It imports only `$convex` types (erased at build) and `src/lib/domain`. The dialog holds the one `$state` draft and feeds the editor its query outcomes as `Lookup<A>` values (`loading`, `failed`, `loaded`, plus a `stale` flag), through `lookupOf(useQuery(...))`.
- The draft holds the user's `Choice`: Uncategorized, Category, Transfer or split, plus whether it was picked by hand. The displayed `Selection` is derived (`selectionOf`): a Payee recall still loading or answering for an earlier Payee is `recalling`, and a failed lookup or failed Categories is `recallFailed` with the original message. `resolvedChoice` maps those two to `undefined`, and `view` returns `payload: { kind: 'waiting' }` without calling `payloadOf`. A payload needs a `Choice`, and an unresolved `Selection` cannot be one, so the type rules out "save while loading or failed".
- Transitions are functions from draft to draft: `openDraft`, `followSaved`, `choose`, `addLine`, `removeLine` and `chooseLink`. The text fields stay directly bindable (`bind:value={draft.payee}`). `choose` takes an option value from the select (`optionOf` encodes it). Picking split seeds two lines: the first gets the size of the amount and, if the previous selection was a Category, that Category. Picking a card payment sets the Direction.
- `view` derives the rest: the selection, Transfer Accounts, card payment, split remainder and blank line, link candidates and link, and the payload. Payload validation keeps the original order and messages (Account, amount, split lines, Transfer Account). The server stays authoritative.
- `recallQuery` and `linkQuery` give the `useQuery` arguments, so the editor decides when the dialog asks for a Payee's last Category or for import link candidates.
- Behavior is unchanged, with one exception: switching to split from a still-unresolved selection now seeds an empty first-line Category (`''`) instead of the internal `'unresolved'` value. Both render as "Pick a Category" and both refuse to save. The split line keys also restart at 0 on each opening.
- E2E assertions kept: the Payee recall and override steps in `e2e/transactions.test.ts`, and the remainder text in `e2e/splits.test.ts`, also prove adapter wiring the unit tests cannot reach. They check that the `useQuery` arguments track the Payee, that the select's setter routes through `choose` (so a manual pick sticks), and that `view` reaches the rendered text. Nothing was deleted.

**Line counts:** `transaction-dialog.svelte` was 837 lines at `62830be`, 831 after ticket 01, and 608 now. What remains is markup, the Category option snippet, the remainder wording, Bank Row actions, lock and delete, and the write wiring.

**Proposed AGENTS.md row:** "An unresolved Category selection (recall loading, stale or failed) yields no Transaction save payload." | `resolvedChoice`/`view` in `src/lib/transactionEditor.ts`; `src/lib/transactionEditor.test.ts`.

**Test-audit gate:** `src/lib/transactionEditor.test.ts` (35 tests, `lib` project)

- *Recalling the Payee's last Category* (loading, stale or Categories-loading gives nothing to save; lookup or Categories failure asks for a pick with its message; the remembered Category saves; null or unlisted memory saves Uncategorized; a pick wins; the recall query only asks while nothing was picked).
  1. Protects the acceptance contract (no payload while unresolved) and the recall rules.
  2. Regressions it catches: an unresolved selection collapsing into Uncategorized, which happened 3 times before. Mutation check: making `resolvedChoice` return Uncategorized for `recalling`/`recallFailed` fails 5 tests, and they pass again once restored. It would also catch stale memory treated as an answer, or a pick overwritten by recall.
  3. Existing proofs miss it: E2E covers only the loaded recall path, never loading, stale or failed. Those states can only be reached reliably at this boundary.
  4. Seams: none. The test uses the same exported functions the dialog calls.
- *Splitting across Categories* (seeding from a Category, or empty from a Transfer or unresolved selection; signing lines by Direction, including a minus line; the three refusal messages; the remainder and blank line table; the line limits and unique keys; a saved split round-tripping its signs).
  1. Protects split payload signs and validation, and the lines the user starts with.
  2. Regressions it catches: a wrong line sign, a seeded `'unresolved'` Category, a remainder sign error, reused line keys, or dropping below two lines.
  3. Existing proofs miss it: `e2e/splits.test.ts` proves a Card save end to end, but not the sign table, the seeding source, or the refusal messages. Convex tests prove the server's split rules, not the dialog's payload.
  4. Seams: none.
- *Transferring between Accounts* (Direction for cash to card, card to cash and cash to cash; a Transfer payload has an empty Payee and no Category; a Transfer with its own Account is refused; import linking asks only for an imported row gaining a new Transfer, waits while sides load, defaults to the first side, and honors a chosen side or a new side).
  1. Protects the card-payment Direction rule and the Transfer/link payload.
  2. Regressions it catches: a wrong Direction flip, a Transfer saved with a Payee, or a save racing a link lookup (the duplicate-import guard).
  3. Existing proofs miss it: `e2e/transfers.test.ts` and `e2e/imported-transfers.test.ts` prove one pair and one link end to end, not the Direction table or the waiting state.
  4. Seams: none.
- *The Transaction around the Category* (Account and amount refusals; following the saved date and amount until edited).
  1. Protects the first two validation messages and the live-refresh rule for untouched fields.
  2. Regressions it catches: an edited amount overwritten by a live update, or a missing date refresh.
  3. Existing proofs miss it: no browser test changes a saved row underneath an open dialog.
  4. Seams: none.

**Checks**

- `bunx vitest run --project lib src/lib/transactionEditor.test.ts`: 35 passed.
- `bun run check` with the app up: exit 0. Format, lint, lint:ui and typecheck were clean; 51 files and 722 tests passed; capacity ok.
- Full E2E, `timeout 590 bun run test:e2e:local`: 33 passed (4.3m).
- After renaming two adapter names: `bun run test:e2e:local e2e/transactions.test.ts e2e/splits.test.ts e2e/transfers.test.ts e2e/imported-transfers.test.ts e2e/bank-changes.test.ts e2e/reconciliation.test.ts e2e/starting-balance.test.ts` gave 13 passed (1.7m), exit 0.
- verify-budge (`budget-with-accounts`) passed:
  - A held `payees:lastCategory` update showed "Looking up the last Category…" with Save disabled, then Rent with Save enabled once released.
  - An unknown Payee went to Uncategorized, and a manual Groceries pick was kept.
  - A create persisted after a reload with Payee, amount, memo, Category and Direction.
  - The split was seeded from Groceries with the whole amount. Short lines were refused with "The lines must add up to the amount.", lines were added and removed, the save persisted, and deleting it restored the balance.
  - Transfer: Card from Checking switched Inflow to Outflow, showed the card-payment note and hid the Payee.
  - A Transfer pair appeared in Savings, and deleting it there restored Checking.

  Evidence: `test-results/verify-budge/ergo-03-editor-20261107-194810-retry/`. The first attempt failed on my driver's selector for the Savings row, and its evidence and output are kept in the directory without `-retry`. The shared `e2e/heldResponse.ts` holds only mutation and action responses, so this drive holds query updates with its own socket route.
- Review: the `code-review` skill was not run because it spawns sub-agents, which this run's brief forbids. An inline self-review compared every rule against the old dialog: recall gating, stale handling, split seeding, the card-payment flip, the Save-disabled conditions, link loading, and validation order. Its only change was renaming `v` to `shown` and `blank` to `freshDraft`.

**Open**

- verify-budge `payees.md` and `transactions.md` could gain the held-recall journey. It needs a query-update hold, which `e2e/heldResponse.ts` does not offer.


**Principles**

Three runs, each from a fresh read of `~/.agents/principles/README.md`, with every matching reference read in full. The list of matches for run 1 is in ticket 01.

- Run 1 (against the work already done):
  - model-the-domain and type-system-discipline: the Category is a `Selection` (a `Choice`, `recalling` or `recallFailed`), and only `resolvedChoice` turns it into a Choice. A Payee recall that is still loading, stale or failed therefore yields a `waiting` or `invalid` payload, never a `ready` save.
  - boundary-discipline: the editor is framework-free. `lookupOf` parses convex-svelte query state into `Lookup` at the adapter boundary, and the dialog only binds `shown` and calls the editor's functions.
  - minimize-reader-load: the derived values replaced the synced flags `prefillsCategory`, `filledCategoryId` and `categoryPicked`, so no effect writes recall into the draft. The self-review renamed `v` to `shown` and `blank` to `freshDraft`.
  - subtract-before-you-add: the dialog's inline recall, split and transfer logic was deleted, not wrapped. The dialog is 608 lines (831 after ticket 01, 837 at `62830be`). These counts are reported as sizes, not as a measured improvement (explain-the-number).
  - build-the-lever and prove-it-works: the verify-budge journey is a scripted `drive.ts` with an assertions file, kept in the evidence directory. Its query-update hold exists only there, which is a gap. Promoting it into `e2e/heldResponse.ts` changes shared E2E infrastructure outside this ticket, so it is listed under Open.
  - No code correction in this ticket's scope.
- Run 2 (before writing or changing tests): test-behavior-not-implementation. The 35 editor tests drive only the public functions (`openDraft`, `choose`, `view`, …), and their expected values come from the rules: Uncategorized for null memory, the sign table, and the remainder table. The break-the-behavior edit (forcing `resolvedChoice` to Uncategorized) failed 5 recall tests. No test reads a private helper, so the change-the-internals edit is covered by construction. No test changed in this run.
- Run 3 (before calling the ticket done): prove-it-works, sequence-verifiable-units, test-behavior-not-implementation, explain-the-number, encode-lessons-in-structure.
  - encode-lessons-in-structure: the proposed AGENTS row points at the type encoding (`resolvedChoice`/`view`) and its tests rather than at an instruction.
  - prove-it-works: the ticket 01 correction touched this dialog's `open` call. The full E2E suite after that change passed 33 tests, including transactions, splits and transfers.
  - No further changes.
