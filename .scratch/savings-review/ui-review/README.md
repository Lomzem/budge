# UI review — card debt Assign and Remember by default, round 1

Protocol: [docs/quality/ui-review/README.md](../../../docs/quality/ui-review/README.md). Owner override: three GPT-6.1-Sol xhigh judges, no Opus judge.

## Coordinator brief

- Changes: `b41883f` (Remember checked by default; Savings counts toward Ready to Assign) and `40c7865` (card debt `Assign $X` in the Budget row and the Card payment inspector section; `budget.assignTarget` renamed `budget.assignNeeded`).
- Owner decisions, not findings: no added explanatory copy; no partial funding.
- Initial SHA: `40c7865`. Final SHA: `c1506a5`.
- Journeys: `credit-cards/debt`, `targets/monthly`, `budget/assign`, `payees/remember`, `accounts/savings-budget`, `transfers/pair`, `transfers/import-link`, plus `inspector/cover-and-manage` on re-check. Fixture `budget-with-accounts`.
- Each judge ran its own worktree, backend, and evidence; reports are in this folder.

## Coordinator disposition and final gate

| Finding ID | Disposition | Evidence | Re-check result and SHA |
| --- | --- | --- | --- |
| Sol-A-1, Sol-B-1, Sol-C-1 (inspector Assign left its status empty) | Fixed | `c1506a5`: the inspector's `role="status"` reads `Assigned $X to <Category> from Ready to Assign.`, as Cover and Move do. `credit-cards/debt` presses the inspector Assign with Enter and asserts it. | Approved by all three at `c1506a5` |
| Sol-A-1 (inspector region focus has no visible outline) | Deferred | Predates this change; Cover focuses the same region. Not in this ticket's scope. | — |

| Judge | Model / reasoning | Final SHA approved | Overall | Report | Coverage complete; no open blocker/major |
| --- | --- | --- | --- | --- | --- |
| Sol A | GPT-6.1-Sol, xhigh | `c1506a5` | 9/10 | `ui-review-sol-a.md`, `ui-review-sol-a-recheck.md` | Yes |
| Sol B | GPT-6.1-Sol, xhigh | `c1506a5` | 9/10 | `ui-review-sol-b.md`, `ui-review-sol-b-recheck.md` | Yes |
| Sol C | GPT-6.1-Sol, xhigh | `c1506a5` | 9/10 | `ui-review-sol-c.md`, `ui-review-sol-c-recheck.md` | Yes |

- Carry-forward: the Remember, Savings, and Transfer tasks were unchanged by `c1506a5`, so their round-one evidence stands. Commits after `c1506a5` touch only `.scratch/`.
- Not exercised: real Plaid sync, screen-reader speech, physical devices.
- Gate: **pass** (every judge ≥ 9/10 on `c1506a5`, no open blocker or major).
