# 19: Warn when the first budget start is in the future

Status: needs-triage

Source: `.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md`).

Extend the later-move warning to the first-set path. The first date currently saves directly.

Current code: src/lib/components/settings/cutover-date.svelte only previews when cutoverDate is non-null. Source inspection only; historical browser findings need reproduction before implementation.
