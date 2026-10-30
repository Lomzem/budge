# 14: File import and the matcher

**What to build:** I can import a Capital One CSV or QFX file, or a Discover CSV file, into a chosen Account. A preview shows which rows are new, matched, need me to pick, or are duplicates before I save. Saved rows count at once and arrive Unapproved and Cleared. Rows that Match my hand-entered Transactions keep what I entered. I can Approve, Approve all, pick a Match, and Unmatch, and see each Transaction's Bank Text. The budget screen and sidebar show how many Transactions are Unapproved.

**Blocked by:** 05 (Budget screen)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 26, 66, 71, 73–75, 77, 94–99, 102–106; Domain module (matcher, decoders); File import

- [x] Test-first pure matcher. Given a Bank Row and its candidates, it decides:
  - **Skip**: the import ID is already known in this Account.
  - **Match**: exactly one candidate.
  - **Ask**: two or more candidates.
  - **New**: no candidate.

  A candidate is in the same Account, has the same amount, is dated within 10 days, is uncleared (or, for file rows, already imported by sync), and isn't yet linked to an import from the same source. Each Transaction takes at most one row, so two identical rows stay two Transactions.
- [x] Effect Schema decoders, tested against hand-written synthetic fixture files:
  - Capital One CSV.
  - Capital One QFX, with `FITID` as the import ID.
  - Discover CSV, with positive purchases read as outflows and no ID.

  Rows dated before the cutover date are dropped. Output is whole cents and ISO dates.
- [x] An `imports` (Bank Rows) table with `source`, `sourceId?`, `accountId`, `date`, `amount`, `bankText`, `transactionId?`, and `state`, plus the Account-source, by-Transaction, and connection-account-state indexes. Transactions gain `approved`, and the Unapproved-first index.
- [x] The browser parses the file with the shared decoders (no upload endpoint; the file is never stored). A preview query runs the matcher. One commit mutation validates the rows again with `v.*`, runs the matcher again, and applies them in one transaction.
- [x] Imported Transactions are Cleared, Unapproved, and count at once. The Payee comes from Bank Text for now; ticket 15 adds rename memory. The Category stays empty until ticket 15 pre-fills it.
- [x] A Match keeps the owner's Payee, Category, memo, and date, marks the Transaction Cleared, and leaves it Unapproved. Unmatch splits the Bank Row back into its own Transaction. Pick-a-Match resolves an "ask" row.
- [x] Editing or categorizing approves a Transaction. Approve and Approve all are available. The Transaction list orders Unapproved first, in bold. Detail shows the read-only Bank Text. Ticket 16 makes it searchable.
- [x] The Unapproved count appears beside the Uncategorized count on the budget screen, and beside All Accounts in the sidebar.
- [x] `convex-test`: importing the same QFX file twice adds nothing the second time. A CSV with a row matching a hand-entered Transaction Matches it. Two identical coffees stay two. Unmatch restores both.
- [x] The seed gains Unapproved Bank Rows.
