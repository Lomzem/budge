# 29: Assess per-row import skip and duplicate override

Status: needs-triage

Source: `.scratch/bank-sync-ux/issues/10-review-round-3.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/bank-sync-ux/issues/10-review-round-3.md`).

Design an intentional per-row skip/override action beyond exact-duplicate skipping and ambiguous matching. Preserve preview/commit agreement and deduplication.

Current code: import-dialog.svelte exposes existing matcher decisions and candidate choices, not an arbitrary per-row skip control. Source inspection only; historical browser findings need reproduction before implementation.
