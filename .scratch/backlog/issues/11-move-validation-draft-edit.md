# 11: Clear stale Move refusal on relevant draft edits

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

Assess clearing validation when Amount is corrected; currently Clear or resubmit recovers.

Current code: category-inspector.svelte clears moveError/moveInvalid in submit and Clear, rather than every Amount edit. Source inspection only; historical browser findings need reproduction before implementation.
