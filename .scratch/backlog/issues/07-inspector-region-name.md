# 07: Keep the inspector region named during Rename

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

The heading is replaced by the name input while renaming. Retain a stable accessible name through rename and refusal states.

Current code: category-inspector.svelte references inspector-heading, supplied inside InlineName children. Source inspection only; historical browser findings need reproduction before implementation.
