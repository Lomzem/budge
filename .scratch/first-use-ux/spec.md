# First-use budgeting UX

Implementation authorized by the user on 2026-11-12 (`/implement`). Tickets: `issues/01`–`12`. Sections below record the planning state at the time they were written.

## Agreed scope — awaiting final shared-understanding confirmation

1. **Start this month.** Offer the first day of the current month as the onboarding default before import. Make the choice clear there; do not repeat the tracking date as routine Account status. No pre-start bank-history/archive feature is required. Budget history accumulates from the chosen start onward.
2. **Establish confidence first.** Help the user confirm the connected Accounts and balances before asking them to categorize the backlog. Routine views stay concise; show actionable problems and make detailed balance explanations available on request. A successful connection is not proof of a correct balance.
3. **Repair the existing setup.** Inspect the actual saved start date, mappings, imported history, and Starting Balance inputs. Then prepare a reviewable repair for a November start, with date/balance/budget effects and a recovery path. Actual cause, correctness, and repair remain unverified. No live data changes are authorized during planning.
4. **Select and categorize quickly.** Allow individual and multiple Transaction selection, including subsets of a Payee's Transactions. Edit Category directly in the list using search. Group by existing Payee identity to reduce repeated work; defer fuzzy vendor identity suggestions. Payee grouping remains a direction to validate, not an approved final layout.
5. **Make bulk actions clear.** Apply a Category to selected Transactions; optionally approve them in the same action. Also allow saving without approval. Provide undo for bulk Category/approval changes, as proposed in round 1. Imported Transactions already affect balances before approval.
6. **Remember deliberately.** Future imports use the remembered Category and remain available for review. A one-off correction changes only the selected Transactions. An explicit separate choice changes the remembered Category.
7. **Expose Transfers in search.** The picker offers Categories (including Ready to Assign) and a separate Transfer-to-Account section. Work deposits into budgeted Cash Accounts use Ready to Assign. Transfers between budgeted Cash Accounts and payments from a budgeted Cash Account to a budgeted Credit Card Account use Transfer treatment, not another spending Category. Do not apply these rules indiscriminately to outside Accounts.
8. **Keep useful Sync feedback.** Show the number of Transactions added. Other diagnostic counts may live in details. Waiting account setup, failures, and unresolved balance problems must remain visible as specific problems, not disappear behind a generic success message.

### Planned evidence before any implementation is called complete

- A fresh setup offers this month's boundary before import and does not create a pre-start review backlog.
- The existing-data repair is based on inspected inputs; previewed balance/budget changes can be checked before applying it, and later sync does not reintroduce excluded history.
- A mixed-purpose Payee supports selecting a subset, searching for a Category, saving with or without approval, and undoing the bulk action.
- A one-off Category exception does not change the remembered Category; an explicit remember choice does affect later imports.
- Work income, a cash-to-cash Transfer, and a credit card payment follow the agreed distinctions without duplicate Transfer sides or duplicate spending.
- Sync's visible additions count matches actual additions; held setup work and failures are explained accurately.
- Prove browser behavior through verify-budge when implementation starts. Follow repository test-audit, review, model-ownership, and deployment requirements at that phase.

### Scope boundary

No UI or production-code implementation, live repair, deployment, or implementation tickets have started. No glossary change is needed: agreed behavior uses existing domain terms. No ADR is warranted yet for these reversible UX choices. Product decisions above still require one final shared-understanding confirmation; technical architecture and implementation belong to Opus under repository ownership rules.

## Reported experience

- A first-time user wants to begin with the current month, rather than review earlier history.
- The imported transaction backlog feels overwhelming and categorization is slow.
- Repeated vendors require repeated work.
- Category selection needs search.
- The distinction between Bank Connections and Accounts is unclear.
- The user cannot confidently confirm that bank and credit card setup is correct.
- Sync numbers and Starting Balance suggestions are not understood or trusted; their correctness has not been established.

## Evidence and limits

- GLOSSARY.md distinguishes a Bank Connection from an Account, and Unapproved from Uncategorized. Unapproved Transactions already affect balances and the budget.
- Previous source inspection found a demo seed that starts two months back. This has NOT been confirmed as the origin of the user's saved date.
- Previous source inspection found that the Starting Balance suggestion subtracts net imported Transactions from the reported current bank balance. The user's actual calculation has NOT been reproduced or verified.
- The completed read-only investigation below records current behavior separately from desired behavior.
- Source verification: `convex/lib/payees.ts` already remembers a Payee's last category for later imports, and `convex/lib/transactions.ts` remembers category edits. This does not retroactively categorize the existing backlog. The transaction dialog uses a SelectField for Category selection.

### Completed read-only investigation

Source inspection only; no browser journey, live account inspection, or balance reproduction has run.

- Settings defaults the cutover input to today (`src/lib/components/settings/cutover-date.svelte:16`); demo seed behavior is distinct.
- Bank setup maps a bank account into a new or existing Budge Account, or ignores it. Mapping precedes a skippable Starting Balance step (`src/lib/components/bank/held-account-dialog.svelte:154`). No durable setup-complete checklist was found.
- Connection cards show destinations and sync state, without a bank-versus-Budge balance comparison (`src/lib/components/bank/connection-card.svelte:251`).
- Successful sync reports this run's Added and Matched counts (`src/lib/bankConnections.svelte.ts:43`). It omits the returned held count; zero added/matched can coexist with transactions waiting for account setup. Modified and removed bank rows also have effects outside those two counts.
- The Starting Balance suggestion provides no displayed input amounts, bank balance timestamp, or history-coverage evidence (`src/lib/components/accounts/starting-balance-step.svelte:68`). Budge's account balance is transaction-derived, not a fresh bank balance.
- Existing category memory uses Payee identity and saved exact Bank Text renames; no general fuzzy vendor grouping was found (`convex/lib/payees.ts`). Same-looking vendors must not automatically be assumed to be one Payee.
- Bulk approval and undo exist (`src/lib/components/transactions/transaction-table.svelte:396`); no bulk categorization surface/API was found.
- Approval does not require a Category (`convex/transactions.ts:491`). The reported backlog has not been measured separately as Unapproved and Uncategorized.

Parent spot-checks verified the category-memory code, category SelectField, sync success message, mapping-before-balance sequence, and lack of a category requirement in the approval handler. Other observations remain attributed source-inspection findings.

## Interview tree

### Round 1 — answered

1. Success criterion: reaching a usable, trustworthy current-month budget without individually processing every historical row.
2. Repeated-vendor workflow: review a group once, with individual exceptions visible and controllable.
3. Future automation: remembered category choices proposed visibly, versus silently applied or requiring repeated manual entry.
4. Bank trust: an account-by-account setup summary and explainable balance comparison, without needing to understand connection internals.

### Current frontier — round 2

5. Whether a one-off Category exception changes the remembered Category for its Payee.
6. Whether different bank descriptions may suggest a shared Payee without silently combining them.
7. Whether earlier history should stay available outside the active budget when choosing the current month; existing-data recovery must be previewed before any changes.
8. Whether the Account check should show the bank identity, account type, import boundary, Starting Balance basis, reported bank balance, Budge balance, and any unexplained difference.

### Round 2 feedback and revised frontier

- Q5 accepted: a one-off Category change leaves the remembered Category unchanged unless the user separately chooses to remember it.
- Q6 unresolved: the user asks why grouping different bank descriptions is needed. Explain its possible benefit, but propose deferring fuzzy identity suggestions and grouping only existing shared Payees initially.
- Q7 clarification: the user primarily wants November, does not seek a historical archive of earlier bank transactions, and values history accumulated from now onward. The earlier proposal to preserve September/October as a separate history feature was premature and is not accepted. Include a plan to inspect and repair the existing onboarding result; actual cause and repair remain unverified.
- Q8 rejected as too verbose. Propose a short Account summary with setup problems visible and detailed balance explanations available on demand. Do not hide an unresolved discrepancy behind a successful connection status.
- Revised frontier: confirm the smaller grouping scope, a November start with no requirement to import older bank history, and a compact setup summary. Do not introduce additional features merely to resolve speculative edge cases.

### Round 2 revised answers

- Q6 accepted on simplicity grounds: group by existing Payee identity initially. Do not add fuzzy name-matching suggestions to this scope. This is a product scope choice, not a verified claim about implementation cost.
- Q7 accepted: default onboarding to the current month's first day, explain the boundary at that decision, and import only from that date. Include inspecting and planning a repair of the user's existing setup with previewed date/balance changes. No separate pre-start history/archive feature is requested. Preserve useful budget history from the chosen start onward.
- Q8 further correction: even a routine “Tracking from November 1” label is unnecessary. Show the date during onboarding or when changing it, not as persistent Account status. Prefer minimal routine status, specific actionable problems, and details on request. Final placement of connection information is still a design question.

### Current frontier — categorization interaction

9. Choose a Category directly in the review list through search, without opening the full Transaction dialog; use the same interaction for an individual Transaction or a selected Payee group.
10. For a mixed-purpose Payee, select several Transactions and apply one Category, then handle the others separately. Do not require one Category for the whole Payee group or automatic splitting.

### Categorization interaction answers

- Q9 accepted: edit Category directly from the list using search, without opening the full Transaction dialog. Support the same Category choice for selected Transactions.
- Q10 accepted and strengthened: explicit multiple Transaction selection is a core user need, not merely an implementation of Payee grouping. It must support selecting a subset within a mixed-purpose Payee. The user has repeatedly wanted this during use.
- Proposed selection scope: permit individual row selection rather than requiring selection of an entire Payee group; use the selection for categorization and approval. Cross-Payee selection follows the general selection requirement, rather than adding a separate Payee-only selection mode.

### Current frontier — bank meaning and routine status

11. How to present a payment between the user's checking and credit card Accounts as a Transfer rather than another spending Category, and whether suggested Transfer links require confirmation.
12. Whether routine Sync feedback should prioritize “up to date / needs action” and leave Added/Matched counts in details. This does not establish actual correctness or suppress unresolved setup/balance problems.

### Bank meaning and routine status feedback

- Q11 not accepted yet: the user does not know the expected model. Their previous YNAB habit was putting between-account transactions and work direct deposits into Ready to Assign. Explain the distinction before asking for a product choice: external income into a budgeted Cash Account versus Transfers between Accounts already in the budget, including credit card payments. This is not evidence that the user's current Transactions are wrong.
- Q12 correction accepted: keep the number of Transactions added visible in the Sync result. Do not hide all counts in details. Exact copy can be short, such as “12 Transactions added”; zero additions is an ordinary result, while waiting setup and failures need their own truthful outcome.
- Consult official YNAB income, transfers, and credit-card-payment documentation to ground the explanation. Do not assume all external Accounts are tracked or apply between-budget-account rules indiscriminately to outside money.

Later checks still required: transfers/card-payment handling, compact connection/setup confirmation, concrete acceptance criteria, implementation ownership handoff, and final shared-understanding confirmation.

### Later branches

- Start-date choice and safe recovery of an existing budget; treatment of prior history.
- What counts as the same Payee and how to handle ambiguous merchants, transfers, refunds, and credit card payments.
- Distinguish categorization from approval; decide which actions can be combined.
- Category search, keyboard flow, mobile flow, and undo.
- Source and time of bank balances, sync status/count semantics, unavailable or incomplete data, and discrepancy handling.
- Navigation and first-use guidance after inspecting existing flows.
- Scope, non-goals, observable acceptance criteria, and final shared-understanding confirmation.

## Principles applied

- Experience First: prioritize getting to a usable budget over polishing individual controls in isolation.
- Model the Domain: keep connection state, category assignment, review state, and balance correctness distinct during the interview.
- Prove It Works: distinguish source-code findings and user reports from verified behavior; no claim that the user's balances are correct or incorrect yet.

## Decisions

- Confirmed Q1: the first milestone is to confirm connected Accounts and balances before asking the user to categorize the backlog.
- Q2 direction accepted tentatively ("I think I want this"): apply a Category to several existing Transactions from the same Payee, with a preview and individual exceptions. Validate the actual interaction later; do not treat the tentative answer as approval of a specific layout.
- Confirmed Q3: future imports receive the remembered Category and remain available for user review and approval. The Category can be corrected before approval.
- Confirmed Q4: offer a combined action to set the Category and approve selected Transactions, plus an option to save the Category without approving.
- Searchable Category selection is an explicit user request.
- Confirmed Q5: Category exceptions affect selected Transactions only. Remembering a new default is a separate explicit choice.
- Confirmed Q6: use existing Payee identity for grouping; defer fuzzy vendor identity suggestions.
- Confirmed Q7: start-this-month onboarding and planning a safe repair of the existing setup. Earlier bank history is not required.
- Q8 constraint: no persistent tracking-date label in the routine Account view. Explain the boundary at the relevant decision instead.
- Confirmed Q9: direct searchable Category editing from the Transaction list.
- Confirmed Q10: multiple selection is a core requirement, including selecting subsets of a Payee's Transactions. Do not limit the feature to whole-group categorization.
- Confirmed Q12: retain a visible Transactions-added count in Sync feedback.
- Confirmed Q11: the searchable picker contains Categories including Ready to Assign, with Transfers to Accounts in a separate section. The user accepted after the income/Transfer/credit-card-payment distinction was explained using official YNAB sources.
- The user requests that repair of their existing setup be included. Planning-only scope remains in force; no data deletion, reset, or balance change has been authorized by this request.
- The user's explicit scope remains planning and documentation only.

## Resume

All interview questions Q1–Q12 have answers or explicit scope corrections. Ask for final shared-understanding confirmation of the concise agreed scope; do not begin implementation. The read-only investigation does not verify live balances. Keep product choices distinct from pending technical architecture and actual repair authorization.
