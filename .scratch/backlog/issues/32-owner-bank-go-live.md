# 32: Confirm owner bank setup and real sync outcomes

Status: ready-for-human

Source: `.scratch/v1/issues/23-production-go-live.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/v1/issues/23-production-go-live.md`).

Owner verifies the existing Item webhook, mapped Accounts and Starting Balances, absence of pending/pre-cutover rows, and post-move real sync. Never create another Item or record private data in Git. Read-only smoke does not prove these writes.

Current code: convex/bankConnections.ts setup and bank sync paths exist; production smoke explicitly excludes writes/sync. Source inspection only; historical browser findings need reproduction before implementation.
