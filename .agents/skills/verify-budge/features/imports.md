# CSV/QFX import, matching, Unmatch and approval

Preview invented bank files before saving; match existing Transactions, retain entered details, and review imported rows.

## Sub-features

- `import-format`: Capital One CSV/QFX and Discover CSV, cancel and invalid input.
- `import-match`: new, unique Match, ambiguous pick, duplicate skip and Unmatch.
- `import-approve`: approve one/all or approve by editing; counts and balances.

## How to get to it (user POV)

- All Accounts or a named Account → `Import file`; Account selection inside `Import a bank file`.
- Imported Transaction edit dialog → Bank Text / Unmatch; row Approve and list Approve all.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/imports.ts`, also run by `bun run test:e2e:local`):

- `imports/approve`: a one-row invented Capital One CSV previews, saves Unapproved, and Approve clears it.
- `imports/late-save`: an import save that finishes after the dialog was cancelled leaves the reopened dialog alone.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Preview/save:** click `Import file`, scope `getByRole("dialog", { name: "Import a bank file" })`, select `Account`, and `getByLabel("File").setInputFiles(...)` with an invented file. Use only synthetic files from `src/lib/domain` fixture directories (locate with `rg --files src | rg synthetic`), or the invented Capital One CSV in `e2e/journeys/imports.ts` with today’s date. Require Preview and expected new/Match counts; Cancel must leave no rows or balance effect. Reopen, Save, require Cleared/Unapproved row, Account balance change and sidebar count, then reload. Repeat for each supported format and both list entry points.
- **Match/ambiguous:** first create same-amount manual Transaction within ten days using Transaction UI, with an invented Payee/Category/memo. Import the corresponding invented row; require Match preview and a single Cleared Transaction retaining manual fields and read-only Bank Text. With two candidates require `Match with` selection; choose each candidate and `None, add as new` in separate seeded runs. With twelve same-amount candidates, require the visible `Match with` (the outcome renders twice, one hidden by width, so filter `{ visible: true }`) to list `Pick one`, the ten nearest by date with the earlier date first on a tie, then `None, add as new`.
- **Duplicates/cutover/errors:** re-import the same QFX FITID; require duplicate skip and no balance/count change. Two identical coffee purchases with distinct IDs must remain two. Import pre-cutover-only file and require the explicit nothing-after-cutover status. A malformed invented file must show an error and save nothing. A 251-row file must show the alert `Import at most 250 rows at a time; download a shorter date range.`; 250 rows must preview.
- **Unmatch:** reopen a matched Transaction, click `Unmatch` (scope to dialog), require two separate Transactions and the original manual fields preserved; verify balances and Bank Text search now belongs only to the imported row.
- **Approve:** click `getByRole("button", { name: /^Approve SAMPLE/ })`; require it gone but Transaction and balances unchanged after reload. Repeat via editing/categorizing and via `Approve all`; require counts disappear only in the selected Account scope. Capture action, preview, saved detail and counts.

## Gotchas

- Existing synthetic fixture dates may precede the cutover; use invented current dates rather than silently accepting an empty import.
- This is browser parsing, not an upload endpoint. A preview is not saved evidence. QFX identity differs from CSV matching rules.
- Sources: ticket 14; public `imports.preview/commit/unmatch`, `transactions.approve/approveAll`.
