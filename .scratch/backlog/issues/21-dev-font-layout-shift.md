# 21: Diagnose development-only font layout shifts

Status: needs-triage

Source: `.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md`).

A held bulk save can shift a chevron 9px under Vite dev serving; earlier tab-label races also occurred on dev full load. Preserve the guard and distinguish production evidence.

Current code: src/routes/+layout.svelte and app.css retain optional font loading; app verify uses dev serving. Source inspection only; historical browser findings need reproduction before implementation.
