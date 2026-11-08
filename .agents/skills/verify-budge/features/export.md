# Export and backups

Download invented budget source data as JSON or one CSV per table, excluding private provider tokens and rebuildable totals.

## Sub-features

- `export-json`, `export-csv`: complete saved downloads and privacy exclusions.

## How to get to it (user POV)

- `Settings` → Your data → `Export…` → Download JSON / Download CSV.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/export.ts`, also run by `bun run test:e2e:local`):

- `export/files`: JSON matches the journey’s independent source-table inventory and omits `bankConnections.provider`; CSV filenames match that inventory past ten files. Actual JSON/CSVs are kept under the journey’s `downloads/` evidence folder.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **JSON (manual checks beyond `export/files`, which checks its table inventory, provider omission, filename and Checking):** `/settings`, button `Export…`, scope dialog Export. Register `page.waitForEvent("download")` before clicking Download JSON; `download.saveAs()` into evidence directory. Parse the actual file, require Checking in Accounts, every source table, no `monthlyTotals`, `webhookKeys`, `webhookKeyLookups`, or `bankConnections.provider`. Avoid printing exported contents.
- **CSV (manual content checks beyond the journey):** collect download events before Download CSV; require filenames for every table in JSON, not just Chromium’s first ten. Save all files under evidence and inspect headers, invented names, row counts. Compare table coverage against JSON; wait up to 15 seconds for paced downloads. Capture action and completed dialog on desktop and 320 px.

## Gotchas

- **Manual drive:** while fetching, download buttons are disabled; dismissing and reopening resumes the pending export. During `Downloading… Keep this page open until every file has started.`, dismissal is blocked. Failure shows `Budge couldn't export. Try again.`; retry and inspect the completed downloads.
- **Manual drive:** an empty table still downloads a CSV, whose contents are empty (no header).

- Downloads are paced to avoid Chromium’s ten-file burst limit; the first download is insufficient proof. Export is real data access even on a test path; use only invented seed.
- Sources: ticket 13; public `export.tables/page`.
