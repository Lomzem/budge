# 03: Check native From and To date readability

Status: needs-triage

Source: `.scratch/ux-efficiency/issues/09-ui-polish-followups.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/ux-efficiency/issues/09-ui-polish-followups.md`).

At 320 px the last year digit was clipped. Verify native rendering, including a physical phone; preserve the accessible range chip and URL.

Current code: src/lib/components/transactions/transaction-filters.svelte still renders native date Inputs. Source inspection only; historical browser findings need reproduction before implementation.
