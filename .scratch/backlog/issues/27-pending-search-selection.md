# 27: Assess selection made before a pending search applies

Status: needs-triage

Source: `.scratch/first-use-ux/issues/08-work-through-repeated-payees-as-groups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux/issues/08-work-through-repeated-payees-as-groups.md`).

A row checked inside the 300ms search pause loses its selection when the search applies. Existing behavior is intentional; triage whether applying search on check or waiting would improve it.

Current code: transaction-table.svelte retains debounced search with per-scope selection resets. Source inspection only; historical browser findings need reproduction before implementation.
