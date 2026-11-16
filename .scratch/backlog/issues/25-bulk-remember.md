# 25: Assess explicit bulk Remember choices

Status: needs-triage

Source: `.scratch/first-use-ux/issues/07-select-transactions-and-categorize-or-approve-them.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux/issues/07-select-transactions-and-categorize-or-approve-them.md`).

Decide whether bulk Remember is useful. If added, name affected Payees and resolve conflicting choices per Payee; never infer memory from bulk categorization.

Current code: transaction-table.svelte bulk picker only opts into approval; memory remains per-row. Source inspection only; historical browser findings need reproduction before implementation.
