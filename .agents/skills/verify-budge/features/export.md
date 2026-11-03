# Export and backups

Download invented budget source data as JSON or one CSV per table, excluding private provider tokens and rebuildable totals.

## Sub-features

- `export-json`, `export-csv`: complete saved downloads and privacy exclusions.

## How to get to it (user POV)

- Desktop or mobile Menu → Export… → Download JSON / Download CSV.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **JSON:** Menu, menuitem Export…, scope dialog Export. Register `page.waitForEvent("download")` before clicking Download JSON; `download.saveAs()` into evidence directory. Parse the actual file, require Checking in Accounts, every source table, no monthlyTotals or provider fields/tokens. Avoid printing exported contents.
- **CSV:** collect download events before Download CSV; require filenames for every table in JSON, not just Chromium’s first ten. Save all files under evidence and inspect headers, invented names, row counts. Compare table coverage against JSON; wait up to 15 seconds for paced downloads. Capture action and completed dialog on desktop and 320 px.

## Gotchas

- Downloads are paced to avoid Chromium’s ten-file burst limit; the first download is insufficient proof. Export is real data access even on a test path; use only invented seed.
- Sources: ticket 13; `e2e/export.test.ts`; public `export.tables/page`.
