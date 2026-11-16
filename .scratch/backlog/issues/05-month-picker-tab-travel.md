# 05: Reduce keyboard travel through the month picker

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

Assess roving tabindex while preserving arrow navigation and year selection. Twelve separate Tab stops remain.

Current code: src/lib/components/budget/month-picker.svelte renders twelve buttons without roving tabindex. Source inspection only; historical browser findings need reproduction before implementation.
