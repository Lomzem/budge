# 24: Offer an explicit Forget Remembered Category action

Status: needs-triage

Source: `.scratch/first-use-ux/issues/06-change-remembered-categories-only-when-requested.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux/issues/06-change-remembered-categories-only-when-requested.md`).

Design an explicit action that changes future imports without rewriting historical Transaction Categories. Uncategorized and Transfers must not silently clear memory.

Current code: convex/payees.ts exposes list/lastCategory/rename; no forget mutation or corresponding UI exists. Source inspection only; historical browser findings need reproduction before implementation.
