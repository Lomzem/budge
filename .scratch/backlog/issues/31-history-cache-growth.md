# 31: Plan monthly totals recovery if history outgrows one transaction

Status: needs-triage

Source: `.scratch/v1/issues/03-manual-accounts-and-transactions.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/v1/issues/03-manual-accounts-and-transactions.md`).

Account balances read Accounts × months, and rebuild remains atomic. Measure real growth before deciding scheduled batch rebuilds or a yearly Available checkpoint; retain ADR 0002 equivalence.

Current code: convex/monthlyTotals.ts rebuild and accountBalances still operate over monthly history. Source inspection only; historical browser findings need reproduction before implementation.
