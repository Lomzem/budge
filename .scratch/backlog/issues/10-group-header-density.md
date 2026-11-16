# 10: Refine Group header wrapping with large phone amounts

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

Reduce heavy label wrapping without losing names, amounts, controls or financial readability.

Current code: src/routes/(app)/+page.svelte retains wrapped Group names beside large totals. Source inspection only; historical browser findings need reproduction before implementation.
