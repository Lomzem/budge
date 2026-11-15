# 11 — CodeRabbit repair UI review

Status: ready-for-agent

Reviewed clean `3dc077bef9431feae75fc24983c3b2d01bf5206f`. This round does not pass the gate: a required keyboard recovery failure is open. No repair batch has been pushed, and PR 32 remains unmerged.

## Independent results

- Sol B High: approves at 9/10, ten maintained journeys and fresh manual checks; report `/home/lomzem/.t3/worktrees/budge/t3-c11db5b2-85a750b1a1e43ac4/test-results/ux-efficiency/ui-review-coderabbit/sol-b.md`. Parent read report and exact clean-SHA summary; all ten pass, running record absent, ownership released.
- Sol A High: changes required at 8/10, eleven maintained journeys pass. Report `/home/lomzem/.t3/worktrees/budge/t3-71af0dd9-16c169f833321bef/test-results/ux-efficiency/ui-review-coderabbit/sol-a.md`. Parent inspected the reproduced focus observations and recovery counts. Own app/browser stopped, clean SHA, ownership released.
- Opus 5.5: pending, task `d39f7ef8-64ee-41a1-aaa6-f89b8c7bd626`. Do not share the other judgments with this pending independent reviewer.

## Open finding and assignment

**sol-a-CR-A1 — major:** at desktop keyboard, focus Move Everyday or Move Coffee, press ArrowUp, and refuse the first reorder mutation at the existing WebSocket boundary. Immediate optimistic order/focus are correct; refusal restores order and shows the truthful error but drops focus to BODY. Group retry takes 17 Tabs and Category retry four. Correct persistence does not satisfy keyboard recovery.

Parent verified `rollback-focus-group.json` (`tag: BODY`, `tabsToRetry: 17`) and the report's before-refusal focused-handle observations. Raw reproduction is under that Sol A checkout's `test-results/verify-budge/sol-a-cr/`, including Category and Group captures, active-element JSON and retained failed focus assertions. Evidence is local and synthetic.

Assigned to the existing Opus implementation child as an implementation continuation, run 3, task `node:delegated-task:command%3Amcp%3A07edffa5-346f-4f35-a8b7-bb6acf6ba886%3Athread-send%3A1aa16528-7616-4dcf-ab9c-ca6f8dcf9f2b`. Existing checkout `/home/lomzem/.t3/worktrees/budge/t3-85cb338f-512f3e2cb4e9425e`, requested source base `3dc077b`; preserve evidence and supported app lifecycle. Repair must restore correct keyboard context without stealing deliberately moved focus or another operation's focus. Opus decides the implementation, demonstrates red/green for both reorder kinds and retry, checks held replay/touch cancellation dependencies, commits with normal hooks and releases the environment. No source change by Sol.

After the repair, inspect decisive artifacts and integrate, run fresh local Standards/Spec/test-audit and analysis-only corrections, then commission NEW affected reviews from all three judges at one clean final SHA. No old approval silently covers changed source. Keep raw/new reports local and record final approvals in PR/shipping evidence without a gratuitous subsequent metadata commit. Every finding needs a disposition, not an average score.
