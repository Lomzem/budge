# 03 — Integrate and remove redundant copy

Status: ready-for-agent

Fresh Opus implementor integrates tickets 01/02 and implements spec items 21–26. Resolve production/UI integration issues, run full checks and feature verification, prepare neutral review tasks and known external gaps. Parent coordinates independent local code review, corrections, three judges, and shipping. Record evidence and final revisions here.

## Copy slice (items 21–26), isolated implementor

Scope: items 21–26 only, on `t3/ux-efficiency-copy-cuts` from `c7d354b`. Items 1–20 (transactions slice in baseline; Budget/Categories slice in its own worktree) and raw Luna candidates were left alone.

### Dispositions

| Item | Change | File |
| --- | --- | --- |
| 21 | Deleted the sign-in tagline; heading row and Clerk `SignIn` kept. Dropped the wrapper that only held the heading and tagline. | `src/routes/sign-in/+page.svelte` |
| 22 | Deleted Theme's reassurance sentence; `Theme` heading still names the radio group. | `src/routes/(app)/settings/+page.svelte` |
| 23 | Deleted the Categories intro paragraph and its wrapper; `Categories` h1 kept. | `src/routes/(app)/categories/+page.svelte` |
| 24 | Deleted `No Target yet.`; the Target heading plus `Add Target` stand alone. | `src/lib/components/budget/category-inspector.svelte` |
| 25 | Settings `Your data` intro is now `Download CSV or JSON.`; export dialog text (backup, token omission, scope, status) unchanged. | `src/routes/(app)/settings/+page.svelte` |
| 26 | Empty Budget side-panel prompt is now `Select a Category.` | `src/routes/(app)/+page.svelte` |

Feature map updated for the changed strings: `.agents/skills/verify-budge/features/budget.md` (prompt) and `targets.md` (remove recipe now requires `Add Target` instead of `No Target yet`). No journey asserted any removed string; no tests added (small reversible copy cuts).

### Verification (app stopped for static checks)

- `prettier --check`, `eslint`, `eslint --config eslint.ui.config.js` on the five Svelte files: pass. `bun run typecheck`: 0 errors.
- `bun run app up/doctor/login/seed budget-with-accounts`: all exit 0; readiness via Budget heading + `Assigned for Groceries`.
- `bun run app verify categories/manage targets/monthly inspector/move-money export/files shell/navigate settings/later-start --run copy-cuts`: all pass (summary at `test-results/verify-budge/copy-cuts/summary.json`; recorded commit is the baseline with uncommitted changes, i.e. this diff).
- Manual copy check `test-results/verify-budge/copy-manual/copy.ts` at 1280×800 and 320×640: sign-in, Budget empty inspector (desktop; phone has no side panel), Groceries inspector Target (`Add Target`, no `No Target yet`), Categories, Settings and Export dialog. Asserts the removed strings are absent, new strings present, accessible names intact, no horizontal page scroll. Screenshots + ARIA in `test-results/verify-budge/copy-manual/`, `log.txt` = `RESULT pass`.
- `bun run app down`: exit 0; `.local-app/running.json` gone.

### Pending integration work (parent)

- Merge with the Budget/Categories slice: both touch `src/routes/(app)/+page.svelte`, `categories/+page.svelte` and possibly `category-inspector.svelte`; expect textual conflicts near the Categories header and inspector, resolve by keeping both slices' intent.
- Full suite, local code review, corrections, three-judge UI review, shipping.
