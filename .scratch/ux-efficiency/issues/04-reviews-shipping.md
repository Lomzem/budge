# 04 — Review, ship, and verify deployment

Status: ready-for-agent

Parent Sol owns local review coordination and analysis-only corrections, independent fresh three-judge review, CI/CodeRabbit monitoring, merge, deployment observation and read-only production verification. Fresh Opus owns fixes and Opus judge slot. Use the spec delivery gates; record all finding dispositions and exact final-SHA approvals. Do not infer approval from a skipped review or successful status alone.

## Shipping preparation

Source reviews, corrections, feature verification and all three UI judges pass at `417d273`. Recorded proof includes 933 unit tests and 63 E2E journeys before the focused final Escape fix, its passing affected journeys, and 32 capacity calls against unchanged backend code.

This report archive, enforcement-table entry and ticket closeout change documentation only. Obtain individual confirmations for that final head, then create one integration PR. Keep CodeRabbit quiet until CI is green; request one prepared review and batch any repairs. No PR, push, merge or deployment has happened at this record. Live status and exact final-head confirmations belong in the PR description and local shipping evidence.
