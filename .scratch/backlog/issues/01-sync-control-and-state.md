# 01: Add safe CLI sync control and state inspection

Status: needs-triage

Source: `.scratch/agent-cli/issues/02-sync-control-and-state.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/agent-cli/issues/02-sync-control-and-state.md`).

Consider local/dev sync, daily cron, a real Sandbox webhook trigger, and redacted table summaries. Refuse production; never print provider credentials.

Current code: scripts/app.ts exposes doctor/up/down/login/reset/seed/verify only. Source inspection only; historical browser findings need reproduction before implementation.
