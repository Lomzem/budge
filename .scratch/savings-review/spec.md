# Savings and transaction review

Requested: include Savings in Ready to Assign, default Remember on during transaction review, investigate Checking↔Savings transfers, and apply principles/correct. User explicitly requires Sol exclusively (overrides model ownership and Opus reviewer slot for this task).

## Decisions

- Savings is already Cash and its Starting Balance feeds Ready to Assign. Prove through public API and UI rather than adding its balance twice. Owner's specific discrepancy remains unconfirmed; optional clarification pending.
- Default Remember on in transaction Category pickers and Add/Edit dialog; preserve explicit opt-out and backend opt-in semantics. Transfers must stay selectable while Remember is checked; only Category choices remember.
- Investigate transfer usability and recommend a focused improvement; do not build a transfer redesign without request.

## Work / evidence

In progress. Base HEAD: 35aa11d. Working tree initially clean. Read principles, correct, Convex, verify-budge, test-audit, code-review. Read-only Sol investigations cover transfers and repeated correction classes. Application changes and verification handled by parent Sol.

## Correct audit

| Recurring class | Evidence | Level and disposition |
| --- | --- | --- |
| Deferred UI actions affect newer selection | bb6bbbc (rename), f310971 (Hide) | Architecture already fixed: capture operation identity, Budget owns inspector selection. No further change needed. |
| Verification prose overclaims retained checks | Historical ux-efficiency issue 10 Standards finding plus its correction analysis of manual probes drifting into journey claims | Judgment/documentation: current feature map distinguishes manual checks. Semantic equivalence of prose and assertions cannot be enforced by a source-text lint. Keep claims scoped to actual checks. |

No new repeated defect class established in this feature. Remember off was an intentional previous policy (4654a23, f29238b, e1e41e3, 8e9b5c2), now changed by the owner. Backend remembering remains explicit. Savings already routes its Cash Starting Balance into Ready to Assign; arithmetic unchanged to avoid double counting.

## Transfer investigation

Current workflow: Checking → Add Transaction → Outflow, date/amount → Category or Transfer → Transfer: Savings → Save once. The Savings inflow is automatic. Reverse by starting in Savings. For imported sides, edit the withdrawal and choose Transfer: destination; if both imports exist, select the offered Other side to link them rather than creating another manual pair.

Transfers exclude spending-category Activity and leave Ready to Assign unchanged. Opposite imported amounts within ten days can link. No automatic transfer recognition. One date and memo are shared; linking adopts the edited side's date/memo. New manual transfers do not offer imported counterparts, so edit an import when both already exist.

Suggested feature: visible Transfer money action using From Account / To Account / Amount / Date, backed by the existing linked pair. Explain that it creates both account entries and leaves Ready to Assign/Category balances unchanged. Later, offer confirmed possible-transfer links for imported counterparts; do not auto-link ambiguous amounts.

## Verification and review

- Focused tests: 64 passed (transaction editor, Payees API, feature map); transfer investigator ran 31 passing transfer/imported-transfer tests.
- Typecheck: app and Convex passed, zero Svelte warnings/errors.
- Local code-review: Standards 0 findings; Spec 0 defects, with actual Transfer selection identified as a browser-proof gap to cover.
- Parent `app up` refused because checkout .env.local targets local deployment. Configuration untouched; `app down` confirmed already down.
- Three independent Sol browser inspections commissioned in prepared isolated T3 checkouts, per explicit Sol-only instruction. Includes default-on baseline failure, final feature journeys, direct Transfer selection, Edit dialog, keyboard and phone checks. Results pending. This is review of uncommitted changes; final clean-SHA shipping gate remains pending. No publish/PR/merge requested.

Full `bun run check`: codegen, formatting, lint, UI lint, both typechecks and all 972 tests in 59 files passed. Final capacity check refused this checkout's non-anonymous local deployment, matching app startup refusal. No configuration changes made. Isolated browser reviews still running and will wake parent on completion.

## Owner screenshot diagnosis

Owner's Bank screen shows two distinct bank feeds (Checking and Savings) mapped into the single Cash Account shown in the sidebar. Savings is connected, not held or ignored. This supersedes the earlier missing-account/setup hypothesis: the missing separate Savings account is a many-to-one mapping problem, not Ready to Assign exclusion.

Code confirms mapping permits already-fed Accounts (held-account dialog displays Already fed by but still permits selection; heldAccounts.map/mapTo accepts existing accountId). One Account has one Starting Balance; startingBalanceSource chooses a single mapped source. Multiple distinct feeds can therefore mix transaction histories while a starting-balance suggestion uses one bank source. Actual source/history/balance reconciliation remains unverified in the owner's deployment.

Existing Stop syncing → Bring back → setup into new Account changes future routing, retains old imported history in its old Account (historyElsewhere warning); not a complete historical repair. Proposed recovery feature: Change linked Account with a preview of bank-source-specific historical Transactions to move, refusal/manual resolution for mixed-source matches, reconciled or conflicting Transfers, and separate Starting Balance confirmation for each real account. Preserve Bank Rows, Category choices and approvals; do not duplicate or silently reimport. Need separate design/verification before any owner-data migration. Original transfer UX advice assumes separate Cash Accounts; current merged mapping explains why that workflow was confusing.

Browser review B completed: 9/10, no scoped findings. Parent inspected `/tmp/budge-savings-ui-b.md`, actual journey summary (`result: passed`), 9 nonempty journey screenshots and 14 nonempty final manual screenshots; checkout running marker absent after teardown. Explicit Edit opt-out, keyboard, phone, and actual row→Transfer selection with Remember checked passed, preserving Payee memory and saved pair after reload. Evidence is in the report. Approves observed uncommitted patch only; final clean-SHA shipping gate remains pending. Owner's merged feed mapping is separate and unresolved.

Browser review A completed: 9/10 provisional, no product findings. Parent read report `/tmp/budge-savings-ui-a.md` and actual red/green summaries. Original production default failed at expected unchecked Remember control; patched accounts/savings-budget, payees/remember, transfers/pair, transfers/import-link all passed. Manual Add/Edit/row opt-out and memory persistence plus checked-Remember Transfer selection passed at desktop and phone; teardown marker absent. Final clean-SHA approval pending; no commits/pushes or owner-data repair.

Browser review C completed: 9/10, no blocker/major. Parent read `/tmp/budge-savings-ui-c.md`, verified actual journey summary passed and cleanup marker absent; nonempty journey/manual screenshots retained. All three independent Sol patch reviews now score 9/10 with scoped feature checks complete; final clean-SHA shipping gate remains open.

C-1 (minor wording) disposition: deferred as a follow-up. Existing label Remember for later imports understates that remembered Categories also prefill manually entered Transactions. Behavior is correct and current-memory hint/explicit opt-out are present; retain the label requested by the owner in this focused default change. A future wording clarification should mention both imports and manual entry, with the corresponding accessible-copy and UI checks. This is not a rejection of the finding or a final-SHA approval.

Remaining: no owner-data migration or mapping repair performed; account routing/history repair feature proposed, not implemented. No commit/push/PR/merge requested or performed. Capacity check blocked in parent checkout as recorded. Before shipping, commit the reviewed implementation under repository workflow, run capacity on an anonymous local backend, and obtain same-final-SHA approvals. No remaining background judges.

## Further explanation requests: targets and credit cards

Owner now shows separate Checking and Savings accounts matching bank cash balances; no claim that parent repaired data. New question: category-row Funded versus Upcoming Yes/No and card debt versus payment funds.

Reproduced with computeBudget using two synthetic $30 monthly targets: both November rows Funded, but December 1 Upcoming is Yes for refill and No for setAside when no December assignment exists. Row target uses viewed month; Upcoming target uses due month. This is confirmed behavior with confusing shared label. Proposed wording: This month's target met versus Due-month target met; Upcoming should expose month/mode/remaining requirement rather than an unexplained Yes/No. No UI change requested/performed in this explanation phase.

Credit Card Account balance is recorded debt; its Budget Payment Category Available is cash reserved for payment. Card purchases shift category money to payment category; payments are Cash→card Transfers. Starting debt requires explicit payment-category funding. Budget assignment does not repair incorrect card-account balance. Owner's screenshots show a debt discrepancy but do not establish which Starting Balance/import/payment/snapshot is responsible; need Discover register and bank basis before a data correction. Existing budget-domain and credit-card tests passed: 50 tests in 2 files; read-only investigator also ran 8 credit-card tests. No owner data changed.

## Export audit and card UX recommendation

Read owner-supplied export in place, without copying it into the repository or creating financial-data artifacts. Read-only arithmetic located the debt discrepancy in an extra uncleared card-payment side. The paired source transaction contradicts its attached Bank Rows' sign; export separately contains the matching real Cash-to-Cash transfer. Parent independently verified these assertions. Exact personal transaction details remain in the private export and conversational answer, not this task record. Removing the pair alone changes another Account that currently matches the bank, so coordinated source/import/starting-balance repair must be previewed before owner data changes. No such repair executed.

Recommendation (not yet approved implementation): do not silently assign Ready to Assign to existing card debt. Continue automatic reservation for categorized card purchases. Add an explicit Set aside $X for payment action, showing debt, already reserved funds, remaining shortfall, and Ready to Assign impact; offer partial funding when cash is insufficient. Explain budget assignment does not send a bank payment. Route waiting-on-category funding to covering the overspent Category rather than funding the same purchase twice. Show cleared and working balances plus uncleared payment totals; show imported amount/direction beside edited transaction values and surface discrepancies. Principles: Experience First makes funding explicit and legible; Model the Domain separates debt, reserved money and actual payment; Fix Root Causes prevents using assignment to hide a wrongly recorded transfer.

## Card debt Assign button (Opus)

Owner rejected explanatory copy ("This budgets money; it doesn't pay your card" and similar) and switched to Opus for this. Supersedes the recommendation above: no new explanatory text, no debt/reserved/still-needed panel, no partial-funding mode.

Built: the Target `Assign $X` button now also appears on a Credit Card Payment Category with uncovered debt, in the Budget row and in the inspector's Card payment section. One rule, `neededOf` in `src/lib/domain/budget.ts` (payment → `uncovered`, otherwise Target `needed`), feeds both the UI and the renamed `budget.assignNeeded` mutation (was `assignTarget`; all callers migrated). `uncovered` already excludes money waiting on overspent Categories, so Assign never funds a purchase twice; those stay with Cover. Payment Categories can't hold Targets, so the rule is unambiguous.

Evidence: `convex/creditCards.test.ts` new test (assigns 20_000 starting debt only, leaves 5_000 waiting, RTA −20_000, second call 0); full suite 973 passed; typecheck, lint, UI lint, format clean. Browser in worktree `/home/lomzem/proj/budge-verify-cc` (this checkout's `.env.local` refuses `app up`): journeys `credit-cards/debt` (extended), `targets/monthly`, `budget/assign` pass; 320 px manual check: no horizontal overflow, inspector button funds and keeps waiting-on notes. Evidence under that worktree's `test-results/verify-budge/card-assign-2` and `card-assign-phone`.

Remaining before shipping: local `code-review`, three-judge UI review, commit. Discover data repair (the uncleared $300 pair) still not done.
