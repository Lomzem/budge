# 12: Verify phone readability across admitted money values

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

Proven envelope is 999999.99 Assigned and seven-figure Group totals. Server-valid values up to 10B remain uncertified and may clip; determine a supported display policy.

Current code: src/lib/domain/money.ts and the budget table admit a broader money range than the historical phone evidence. Source inspection only; historical browser findings need reproduction before implementation.
