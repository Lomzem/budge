# 13: Add maintained Firefox proof for reorder focus

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

End or refused rollback can move a focused row to BODY without focusout. Draft retention was probed, focus remains open. Add a maintained Firefox project before designing one cross-browser focus owner; WebKit remains unverified.

Current code: src/lib/reorder.ts still relies on focusout; playwright.config.ts and CI maintain Chromium. Source inspection only; historical browser findings need reproduction before implementation.
