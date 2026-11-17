# 02 — Agent categorization: apply, conflicts, and undo

Status: needs-triage
Blocked by: 01
Spec: ../spec.md

## Goal

After the owner approves a Categorization Proposal in chat, the agent applies it; changes made since the agent read are refused one by one; any applied proposal can be undone without losing the owner's later edits.

## Scope (settled in spec Q11, Q12, Q15, Q19–Q23)

- `POST /agent/proposals` with a client-chosen proposal ID, optional new Category Groups and Categories (duplicate names refused, case-insensitive; the agent reuses existing ones), and at most ~100 changes. Each change names a Transaction (or an existing split line), the Category the agent read, and the target Category.
- Per change, refuse: Category changed since read; Transfer; Starting Balance; hidden target Category; Ready to Assign. Apply the rest in one mutation through `lib/transactions.ts`, leaving Remembered Categories, approval, amount, date, Account, Payee, and split shape unchanged. Reconciled Transactions may change Category.
- Record the applied proposal (per change: before/after Category; created Categories/Groups). Re-sending the same proposal ID returns the recorded result.
- `POST /agent/proposals/<id>/undo`: restore only Transactions still in the agent's Category; delete created Categories/Groups nothing uses; report restored / kept.
- `GET /agent/proposals`: recent applied proposals with counts, so an agent can find one to undo.
- MCP tools: `budge_apply_proposal`, `budge_undo_proposal`, `budge_proposals`, with descriptions that require owner approval in chat before apply and listing unclear Transactions as questions.

## Comments
