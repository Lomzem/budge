# 04: Keep held Move and Cover feedback reachable after leaving

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

Decide an app-level owner for completion feedback when a held operation finishes after its keyed inspector unmounts. Preserve the new inspector draft and focus.

Current code: src/lib/components/budget/category-inspector.svelte owns done/error locally. Source inspection only; historical browser findings need reproduction before implementation.
