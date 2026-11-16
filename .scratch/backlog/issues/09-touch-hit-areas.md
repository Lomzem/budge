# 09: Measure remaining touch hit areas

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

Measure actual touch areas before changing reported 40px controls or dialog targets. Keep existing larger coarse-pointer areas.

Current code: src/lib/components/ui/button and dialog components retain variant-specific sizing; no universal measured-target proof exists. Source inspection only; historical browser findings need reproduction before implementation.
