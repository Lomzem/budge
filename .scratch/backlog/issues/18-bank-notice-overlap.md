# 18: Keep Bank controls clear of Starting Balance receipts

Status: needs-triage

Source: `.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md`).

At 320 px the pinned receipt covers the last card Reconnect/Sync now. Add phone expectClearOf coverage.

Current code: src/routes/(app)/bank/+page.svelte retains a fixed bottom-20 receipt overlay. Source inspection only; historical browser findings need reproduction before implementation.
