# 26: Count applied bank changes separately from additions

Status: needs-triage

Source: `.scratch/first-use-ux/issues/09-show-useful-sync-results-without-hiding-problems.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux/issues/09-show-useful-sync-results-without-hiding-problems.md`).

Consider per-row no-op/applied/flagged/removed outcomes and thread them through sync receipts with capacity proof. Do not label changes as additions or use backlog counts.

Current code: convex/lib/sync.ts totals only added/matched/held; bankChanges helpers return no outcome counts. Source inspection only; historical browser findings need reproduction before implementation.
