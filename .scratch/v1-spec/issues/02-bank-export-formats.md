# What export files do Capital One and Discover offer?

Type: research
Status: resolved
Blocked by: 

## Question

What transaction export formats (CSV, OFX, QFX, QBO) do Capital One (checking/savings) and Discover (credit card) offer from their websites today, with column layouts or sample structure, date ranges allowed, and whether entries carry stable transaction IDs? Has Capital One's acquisition of Discover changed Discover's site, exports, or aggregator connectivity?

## Answer

**File import must handle Capital One CSV/QFX and Discover CSV, with no bank IDs in the CSVs.**

- **Capital One 360 checking/savings:** CSV export is well documented; QFX (Quicken Web Connect) is supported by strong evidence and carries OFX `FITID` transaction IDs. Separate `.ofx`/`.qbo`/`.qif` choices are unverified for US accounts.
- **Discover card still on discover.com:** CSV, Excel-labelled `.xls`, and PDF. Native OFX/QFX is no longer offered. The CSV has five columns, shows purchases as **positive** amounts (inverted relative to a cash view), and has **no transaction ID**.
- **Discover card already moved to Capital One:** managed only through Capital One's site after migration; its export menu and layout must be checked in the account itself. Migration happens in waves through 2026 into 2027, with no documented continuity of schema or IDs.
- **Date ranges:** not published. Capital One shows about two years of deposit activity, and Discover historically 24 months of viewing; neither guarantees an export span.
- **De-duplication:** CSV rows need content-based matching (date, amount, description). Where a QFX file has `FITID`, store it scoped to the Account, but don't assume it stays stable across downloads or migration.

Findings, with synthetic sample rows: `docs/research/bank-export-formats.md` on branch `research/bank-export-formats` (commit `e931f91`).
