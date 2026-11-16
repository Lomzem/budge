# 16: Keep single-row approval Undo reachable during selection

Status: needs-triage

Source: `.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md`).

Approving one row while others are checked hides the visible result and Undo. Preserve access without clearing selection.

Current code: transaction-table.svelte shows selecting before its else-if undo branch. Source inspection only; historical browser findings need reproduction before implementation.
