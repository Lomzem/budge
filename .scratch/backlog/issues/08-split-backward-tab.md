# 08: Review split remainder prefill on backward Tab

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

An empty split amount prefills on focus even during backward navigation. Decide intent and prove money-entry recovery.

Current code: src/lib/components/transactions/transaction-dialog.svelte still runs fillRemainder on focus. Source inspection only; historical browser findings need reproduction before implementation.
