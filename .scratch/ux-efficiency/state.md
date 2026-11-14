# Resume state

Baseline: `6bdc864175d0abdb100ce41343a38c2e8c4287f6` (main and origin/main).
Integration branch: `feat/ux-efficiency`.

User explicitly authorized all 26 audit proposals, fresh Opus implementors/reviewer, three-judge audit, PR, babysitting CI/CodeRabbit, merge, deploy, and live verification. Sol-only was for the earlier audit and is superseded. No further production confirmation is needed for this authorized delivery through the existing integration. Identify and announce the actual production target before mutation/merge triggers deployment. No production data seeding or configuration changes are authorized.

Read /home/lomzem/.agents/PR-WORKFLOW.md, implement skill, principles router and relevant references, issue-tracker rules, triage-label rules, and three-judge protocol. Prior thread cfd65258-67e8-48fa-a1fc-ed90edf83391 was read: past implementation used isolated judge worktrees and Vercel's main integration, frontend plus Convex deploy; owner-only signed-in production coverage was unavailable and must not be claimed. Historical waivers do not override this task's current gates.

Plan: two isolated Opus slices (01 Budget/Categories, 02 Transactions); cherry-pick to integration; fresh Opus integrates and implements copy (03); parent verifies source/evidence, local Standards/Spec review and corrections; fresh Sol A High/Sol B High/Opus 5.5 UI judges; Opus repairs and fresh rechecks until all >=9 final revision; draft integration PR, green CI, one CodeRabbit request; batch repairs, incremental review only after CI; merge then deployment/live read-only verification. Parent must link PR immediately after create/push and use watch_pull_request for waits, never polling. Delegate completions wake parent; follow next and do not poll/wait on async children.

Current phase: two isolated fresh Opus 5.5 implementation agents running from spec commit b1537fa. No app session owned by parent. Do not poll children; completion wakes this thread. Tool functions store also holds structured child handles under 01-budget-categories.md and 02-transactions.md.

- Budget task: node:delegated-task:command%3Amcp%3A3b488d9c-bba3-4e99-817f-ef86db429e81%3Adelegate-task%3A85078bef-79fb-461a-8f0a-2a8d4fe958c3
- Transactions task: node:delegated-task:command%3Amcp%3A3b488d9c-bba3-4e99-817f-ef86db429e81%3Adelegate-task%3A599a6a8f-4ef5-40a4-9c29-6d0682dadeb3
- Both use provider claudeAgent / claude-opus-5-5 with inherited defaults; no further delegation permitted. They own only their slice and their ticket. They must commit, verify in their own app, clean up, and return hashes and evidence. Parent then integrates; fresh Opus integration/copy agent still to be commissioned.
