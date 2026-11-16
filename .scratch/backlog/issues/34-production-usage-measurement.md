# 34: Measure real document sizes and ongoing free-tier usage

Status: ready-for-human

Source: `.scratch/v1/issues/23-production-go-live.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/v1/issues/23-production-go-live.md`).

Measure getDocumentSize and actual database I/O, review first-month usage, and decide whether a yearly Available checkpoint is needed. Earlier shared-team October egress exceeded the Free allowance; no subsequent resolution is recorded.

Current code: monthlyTotals cache and README usage pointers exist; code cannot establish actual provider usage. Source inspection only; historical browser findings need reproduction before implementation.
