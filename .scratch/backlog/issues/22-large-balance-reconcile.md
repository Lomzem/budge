# 22: Check Reconcile at seven-figure phone balances

Status: needs-triage

Source: `.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md`).

At 320 px a 1234567.89 Cash Account balance pushed Reconcile to 321px. Reproduce and fix layout if still present.

Current code: src/routes/(app)/accounts/[accountId]/+page.svelte retains header balance beside Reconcile; no new range proof found. Source inspection only; historical browser findings need reproduction before implementation.
