# Which aggregator syncs Capital One and Discover for at most $25 a year?

Type: research
Status: resolved
Blocked by: 

## Question

Which bank-data aggregators (for example Plaid, Teller, SimpleFIN Bridge, MX, Akoya, Finicity) can sync a personal Capital One checking/savings account and a Discover credit card, for a single personal user, for at most $25 a year? For each viable option: cost and tier limits for personal use, whether Capital One and Discover are supported today, how the connection is authorized and how long it lasts, transaction data available (pending vs posted, history depth, IDs stable for de-duplication), webhooks vs polling, and sandbox availability. Recommend one.

## Answer

**Plaid's free Trial plan is the provider, with SimpleFIN Bridge ($15/year + tax) as the fallback.**

- Plaid Trial is $0 for new US teams (created on/after 2026-04-15), includes Transactions and OAuth, and caps at 10 Items created over the account's lifetime (deletes don't refund). Expect 1–2 Items. Approval requires identity verification and the MSA, but is usually automatic.
- Plaid's coverage list includes both Capital One (`ins_128026`) and Discover (`ins_33`) with Transactions.
- Capital One supplies **no pending transactions** through Plaid; plan for posted-only from Capital One. Consent lasts one year, then renewal through Link update mode.
- Discover cardholders are being migrated to Capital One logins (notice dated 2026-07-06). Which connector the card needs depends on whether it has migrated; a migration can change external IDs.
- Sync via `/transactions/sync` with a stored cursor and the `SYNC_UPDATES_AVAILABLE` webhook; Plaid refreshes 1–4 times a day. `transaction_id` is stable within one connection only; pending→posted swaps IDs, linked by `pending_transaction_id`.
- Teller lists Capital One but not Discover; MX, Akoya, Finicity, and Yodlee have no established route within $25/year.

Findings: `docs/research/bank-sync-provider.md` on branch `research/bank-sync-provider` (commit `a54bd80`).
