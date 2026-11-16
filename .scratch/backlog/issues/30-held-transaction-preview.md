# 30: Assess a preview of held bank Transactions

Status: needs-triage

Source: `.scratch/bank-sync-ux/issues/12-review-round-5.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/bank-sync-ux/issues/12-review-round-5.md`).

The held Account dialog shows counts rather than Transactions. Triage demand before adding a scoped query and preview.

Current code: src/lib/components/shell/held-accounts.svelte uses counts and account setup choices, not a row-preview query. Source inspection only; historical browser findings need reproduction before implementation.
