# 28: Assess duplicate warning on bank-fed file imports

Status: needs-triage

Source: `.scratch/bank-sync-ux/issues/19-review-round-12.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/bank-sync-ux/issues/19-review-round-12.md`).

Decide whether importing a file into a bank-fed Account should warn of possible duplicates, based on matcher semantics. Exact deduplication alone does not answer the interaction question.

Current code: src/lib/components/transactions/import-dialog.svelte previews duplicates but has no bank-fed warning. Source inspection only; historical browser findings need reproduction before implementation.
