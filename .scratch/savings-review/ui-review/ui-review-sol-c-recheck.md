# UI review — inspector Assign status, Sol C re-check

- **Reviewer:** GPT-6.1-Sol, xhigh; independent fresh-context review, without other judges’ reports. No subagents.
- **Reviewed SHA:** `c1506a519c47c63397a5c67103f12664505a5027` (`c1506a5`), re-checking the diff from `40c7865`.
- **Checkout/session owner:** Sol C, `/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298`; local branch `t3/review-inspector-assign-status`, reviewing the coordinator’s `feat/card-assign-and-remember-default` revision. HEAD matched and the tree was clean before launch and throughout checks.
- **Scope:** resolve Sol-C-1 for inspector Card/Target Assign; check keyboard focus, exact funding effects, reload, table-row Card Assign, and shared Cover/manage behavior. Owner decisions about explanatory copy, partial funding, and the pre-existing inspector focus outline remain outside findings.
- **Readiness:** dependencies installed with `bun install --frozen-lockfile`; verify-budge Launch followed with `app up`, `doctor`, `login`, and `seed budget-with-accounts`, all exit 0. No port collision. Authenticated Budget heading and Assigned for Groceries confirmed. Only this checkout’s backend was seeded/stopped.

## Tasks and evidence

Every task used the synthetic `budget-with-accounts` fixture. Manual cases were independent fresh-seed scenarios driven through UI controls with authenticated Playwright; Card inspector entry and assignment used keyboard, including real Tab traversal to Assign followed by Enter. Each manual case retains before/action, after, and reload PNG/ARIA evidence alongside its summary.

| Task / entry point | Viewport and input | Observed result | Absolute evidence path | Result |
| --- | --- | --- | --- | --- |
| `credit-cards/debt` | 1280×800; inspector Assign with Enter | Correct status, region focus, uncovered action/note removed, Ready to Assign −$612.48, reload persists | [Journey trace](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck/credit-cards/debt/trace.zip) | Pass |
| `targets/monthly` | 1280×800 and 320×640; table Assign, phone Upcoming | Monthly Target funded; table focus return and reload pass; phone Upcoming reachable | [Journey trace](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck/targets/monthly/trace.zip) | Pass |
| `inspector/cover-and-manage` | 1280×800 and 320×640; pointer, keyboard and touch | All 10 steps pass on retry: move/Cover amounts, announcements, stale-state coverage, rename refusal/recovery, mobile rename, regroup, hide and delete | [Retry summary](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-retry/summary.json); [trace](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-retry/inspector/cover-and-manage/trace.zip) | Pass on retry |
| Card inspector Assign | 1280×800; keyboard | Assign reached after 2 Tabs; exact status; region focused; next Tab reaches Close Card; Escape returns to Card name; balances persist after reload | [After-action ARIA](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-manual/card-inspector-1280/02-assigned-status-and-focus.aria.yml) | Pass |
| Card inspector Assign | 320×640; keyboard | Assign reached after 4 Tabs; action wholly in viewport without horizontal overflow; same status, focus, exact deltas and reload result; waiting-on notes retained | [After-action ARIA](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-stable/card-inspector-320/02-assigned-status-and-focus.aria.yml); [settled action screenshot](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-stable/card-inspector-320/01-before-keyboard-assign-viewport.png) | Pass |
| Target inspector Assign | 1280×800; Target setup by pointer, Assign by keyboard | Exact Emergency Fund status; region focused; Funded; Assigned +$25.00 and Ready to Assign −$25.00 after reload | [After-action ARIA](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-manual/target-inspector-1280/02-target-assigned-status-and-focus.aria.yml) | Pass |
| Target inspector Assign | 320×640; Target setup by pointer, Assign by keyboard | Same exact status, focus, Funded and persisted money changes; action reachable by Tab/Enter | [After-action ARIA](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-stable/target-inspector-320/02-target-assigned-status-and-focus.aria.yml); [settled result screenshot](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-stable/target-inspector-320/02-target-assigned-status-and-focus-viewport.png) | Pass |
| Table-row Card Assign | 1280×800; pointer | Correct funding, action disappears, Card name receives focus, reload preserves balances | [After-action ARIA](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-manual/card-table-1280/02-table-assigned-card-name-focused.aria.yml) | Pass |
| Table-row Card Assign | 320×640; pointer | Same funding/focus/reload result; button fits screen and measures 113×24 px | [After-action ARIA](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-manual/card-table-320/02-table-assigned-card-name-focused.aria.yml) | Pass |

**Measured money effects:** independent Card cases changed Ready to Assign from $15,154.42 to $14,541.94 and Card Assigned from $0.00 to $612.48. Independent Target cases changed Ready to Assign from $15,154.42 to $15,129.42 and Emergency Fund Assigned from $500.00 to $525.00. Every case reloaded and reasserted the result. Card’s $88.29 waiting on Dining Out and $46.73 waiting on Coffee remained.

## Earlier finding and new findings

| Finding | Severity | Disposition and re-check evidence |
| --- | --- | --- |
| Sol-C-1 — inspector Assign left completion status empty for Card and Target | Minor | **Verified fixed in `c1506a5`.** Card’s existing `role="status"` changes from empty to `Assigned $612.48 to Card from Ready to Assign.`; Target reports `Assigned $25.00 to Emergency Fund from Ready to Assign.` Both preserve region focus. Verified at both viewports; Card status mutation also observed directly. The code returns the server’s assigned amount to the callback rather than using the button’s displayed shortfall. See task evidence and [manual measurements](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-manual/summary.json). |

**New findings:** none in the scoped diff. No unresolved blocker or major finding. No application code was edited, committed or pushed.

## Commands, retry and limitations

- `bun run app verify credit-cards/debt targets/monthly inspector/cover-and-manage --run judge-c-recheck` — exit 1: Card and Target passed; inspector’s second step ended with `groupEnd: Target page, context or browser has been closed`. Its failed screenshot/trace could not be retained. [Original run summary](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck/summary.json) preserves the failure; it is not reported as a successful run.
- `bun run app doctor` — exit 0 after failure. Ran `app down` (exit 0), confirmed running state removed and evidence retained, then repeated Launch (`up`, `doctor`, `login`, `seed`), all exit 0.
- `bun run app verify inspector/cover-and-manage --run judge-c-recheck-retry` — exit 0, all 10 steps passed on the unchanged SHA with a retained trace. The initial browser termination remains unexplained; it did not reproduce on this retry.
- `bun test-results/verify-budge/judge-c-recheck-manual/check.ts` — exit 0, all 6 cases passed. [Runnable script](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-manual/check.ts); [summary](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-manual/summary.json).
- `bun test-results/verify-budge/judge-c-recheck-stable/check.ts` — exit 0, both phone inspector cases passed again. Supplemental viewport screenshots wait for finite animations to finish, replacing an opening-fade capture for visual inspection. [Runnable script](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-stable/check.ts); [summary](/home/lomzem/.t3/worktrees/budge/t3-0675a109-07eec3b32c5fb298/test-results/verify-budge/judge-c-recheck-stable/summary.json).
- Neither manual run recorded console errors or uncaught page errors. Status semantics/text and actual DOM focus were checked; spoken delivery in screen-reader software was not directly exercised. No required task remains unverified. This is a scoped re-check, not a new full-feature audit.

## Rubric

| Dimension | Score /10 | Supporting observation |
| --- | --- | --- |
| Task completion and trust | 9 | Both consumers assign exact amounts; balances and funded state persist after reload. |
| Discoverability and language | 9 | Amount-bearing Assign controls remain clear; completion status names amount, Category and Ready to Assign. |
| Efficiency and control | 9 | Enter completes the task in place; table and inspector paths both work; completed action disappears. |
| Feedback and recovery | 9 | Former empty-status gap resolved for Card and Target; shared Cover/manage and rename refusal/recovery pass. |
| Accessibility and input | 9 | Tab/Enter completion, existing live status, inspector focus, next Tab and Escape return checked; table focus return preserved. |
| Responsive layout and visual clarity | 9 | Required controls fit at 1280×800 and 320×640; phone action is reachable without horizontal overflow; settled screenshots inspected. |

**Overall: 9/10.** The earlier completion-feedback gap is resolved on both inspector surfaces. Exact monetary effects, persistence, keyboard continuity and unchanged table behavior are demonstrated; the shared inspector journey passes after retry. No new scoped defect warrants another fix round.

**Verdict: approve `c1506a519c47c63397a5c67103f12664505a5027` for Sol C’s re-check.** This is this reviewer’s recommendation; coordinator/Opus owns final finding dispositions and the combined gate.

**Principles that changed verification choices:** Prove It Works led to checking live status mutations, actual focus, exact deltas and reload, rather than accepting the diff or button disappearance. Experience First led to traversing the real keyboard sequence and inspecting settled phone states. Build the Lever led to retaining the runnable manual scripts and measured summaries. Test Behavior, Not Implementation kept funding assertions on user-visible Assigned/Ready to Assign and reload rather than internal database state.

**Cleanup:** browsers/contexts closed in `finally`; temporary shared-preview tab closed. Final `bun run app down` exited 0. `.local-app/running.json` is absent. All 115 evidence files across the four run directories remain nonempty, including 57 PNGs, 49 ARIA snapshots and 3 traces. Screenshots/quoted observations use synthetic data; credentials and storage-state contents were not printed. Ownership released. The only requested repository artifact is this uncommitted report; local verification scripts/evidence remain ignored.
