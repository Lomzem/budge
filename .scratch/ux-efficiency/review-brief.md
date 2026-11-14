# Independent UI review brief — UX efficiency

Draft: do not launch judges until the coordinator pins the clean integrated SHA and completed checks below. Judge reports must not be read by other judges before their own verdicts.

## Sources and revision

- Spec: [spec.md](spec.md), all items 1–26.
- Tickets: [01](issues/01-budget-categories.md), [02](issues/02-transactions.md), [03](issues/03-integration-copy.md), [04](issues/04-reviews-shipping.md).
- Protocol/rubric/template: `docs/quality/ui-review/{README,rubric,report-template}.md`.
- Clean review SHA: `feat/ux-efficiency` HEAD after `17bbcc5` (last code commit; the next commit is records only). Pin the exact HEAD when launching.
- Checks at `17bbcc5`: `bun run check` all pass except `capacity:check` (refused in the integration checkout: non-anonymous backend; no Convex changes); unit 929/929; `bun run test:e2e:local` 61/61. Dispositions and red/green proofs: [ticket 03](issues/03-integration-copy.md#integration-opus-55-integration-implementer). Local code review rerun on the integrated diff: pending parent.
- Journeys for the judges: `budget/*`, `categories/{manage,reorder,late-rename}`, `inspector/*`, `targets/monthly`, `search/*`, `transactions/*`, `splits/*`, plus copy journeys `export/files`, `shell/navigate`, `settings/later-start`. Synthetic extras worth sampling by hand: a long Category name and $999,999.99 Assigned at 320 px; touch reorder near the bottom edge; an arrow key straight after reopening the month grid.

## Required user tasks

Each judge independently completes every task below at desktop 1280x800 with pointer and narrow phone 320x640 with touch, and completes every applicable task by keyboard. Sample 390px, dark theme, long names, empty/loading/error/held states where relevant, rather than requiring the full cross-product. Assess real ease of use, not just successful automation. Use maintained journeys first, manual user-control driving for their gaps. Reload or second view must prove persisted money, Category, name, and order changes. A required uncovered item leaves the gate incomplete.

| Task | Spec items | Entry point and observable outcome |
| --- | --- | --- |
| U1 Assign money | 1, 2 | Budget: edit Assigned at 320px directly without the full inspector; fund an underfunded Target from its table action. Assigned, Available, Ready to Assign and status update correctly and persist. Keyboard/phone targets remain reachable. |
| U2 Cover and move | 3, 4, 5 | Budget overspent Category: cover from another Category with calculated shortfall, search its source/destination, inspect explicit From/To, submit and confirm both Available balances and unchanged total; exercise existing Ready to Assign shortcut and invalid amount/cancel paths. |
| U3 Add and organize | 6, 7, 8, 9, 10 | Budget and Categories: add to the chosen Group, create a missing Group inside Add Category, rename a Category/Group in place, reorder both directly by pointer/touch and keyboard, and manage a selected Category from Budget without a navigation/refind trip. Confirm persisted identity/order/name and focus after save/cancel. |
| U4 Budget navigation | 11, 12 | Budget: collapse/expand Groups, retain totals and overspending cue; jump to distant month/year from heading, use arrows/back/forward/reload and current-month return; enforce cutover boundary and show correct month's Assigned without losing values. |
| U5 Filter review | 13, 14, 15, 16 | All Accounts register: search Category and exact Payee, use common date presets and custom From/To, fold Filters and remove individual chips. Shown rows, URL and counts agree. Exact Payee identity is distinct from free-text search. Filter removal preserves other restrictions, focus stays useful, chips fit phone. Local dates include end-of-month/year/leap cases through domain proof plus representative real UI. |
| U6 Fast entry | 17, 18, 20 | Named Account: compact context, Change Account, reveal optional memo, Save and add another. New draft keeps chosen Account/date but clears Payee/amount/memo/Category and focuses Payee. Save twice/Enter while response held makes one Transaction; closing and reopening during save keeps the newer draft. Ordinary Save/cancel, All Accounts selection, editing existing Transactions and populated memo remain usable. Confirm rows/balances and reload. |
| U7 Split memos | 19 | Transaction split: reveal empty line memo, edit/persist it, reopen with saved line memos visible; add/remove/restart split lines and complete amounts. Confirm Category amounts/memos and parent total after reload, keyboard focus and scrolling. |
| U8 Concise copy | 21–26 | Sign-in has heading/controls without tagline; Settings Theme reassurance is absent; Categories introduction absent; no No Target yet beside Add Target; Settings export intro says Download CSV or JSON.; empty Budget inspector says Select a Category. At phone where desktop inspector isn't shown, check applicable entry states without inventing a requirement to show it. Preserve meaningful export/money/irreversibility guidance and accessible names. |

## Fixtures, journeys and limitations

Use only invented data through verify-budge named fixtures (budget-with-accounts, bank-sync, empty-budget or appropriate maintained fixture). Read affected feature maps: budget, categories, inspector, targets, transactions, search, splits, accounts, transfers, payees, settings, shell, auth. Final exact journey list and any extra synthetic setup will be pinned after integration.

Real Plaid Link/webhooks, owner production authentication, and production bank data are outside this local UI review; no changed behavior depends on exercising external bank delivery. Do not read or mutate real data. New/changed UI and its money/control effects remain required, not waived by this exclusion.

## Independence and session ownership

Fresh Sol A High, Sol B High, Opus 5.5; each gets an orchestrator-provisioned worktree at the pinned final SHA and owns only that checkout's anonymous backend, browser, credentials/storage state, artifacts and lifecycle. Never seed or stop another checkout. Do not create shell worktrees or share one backend across concurrent judges. Read verify-budge and authentication instructions; require authenticated heading + fixture marker. No sync/check/typecheck while an app journey runs. Close browser and app down in finally; retain screenshots/ARIA/trace evidence and explicitly release ownership.

Write each judge's independent report outside tracked source at `test-results/ux-efficiency/ui-review/<judge>.md` in that judge's checkout, using the maintained template. Report actual model/effort, exact SHA, tasks/viewports/input coverage, observed persistence, findings with severity/reproduction/evidence, all rubric scores, separate overall score and verdict, unverified gaps and cleanup. Read no other judge scores/verdicts, and do not assume approval target. Parent later copies sanitized reports and records dispositions. No source changes, commits, pushes, further delegation, PR operations, or production access by judges.
