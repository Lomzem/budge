# Monthly totals are a rebuildable cache

Budge stores only Transactions and Assigned amounts as source data, yet it also keeps a `monthlyTotals` table: one row per (month, Account, Category) holding the sum of those Transactions in cents, updated by the same mutation that writes a Transaction. Available carries forward and Ready to Assign is global, so without it every budget-screen query reads the whole Transaction history, and every edit or sync re-runs that read; by year five that alone approaches the Convex free tier's 1 GB of database I/O a month, where writes fail. The table is a cache, not a record: a rebuild function recreates it from Transactions, a test asserts the rebuild equals the incrementally kept rows, and no rule may read it as a source of truth.

## Considered Options

- No cache: simplest, fits for about two years of data, then at risk.
- One document per month holding a map of totals: fewer reads, but each write rewrites a larger document and per-key updates are harder to keep correct.
