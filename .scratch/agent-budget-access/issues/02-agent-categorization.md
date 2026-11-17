# 02 — Agent categorization: apply, conflicts, and undo

Status: implemented on feat/agent-access; see the spec's Verification section
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

- **Undo path deviation:** Convex HTTP routes match exact paths or prefixes, not path parameters, so undo is `POST /agent/proposals/undo` with the JSON body `{"id": "<proposal id>"}` instead of `POST /agent/proposals/<id>/undo`.
- **Apply answer:** `{id, changes: [{transactionId, line, outcome}], created: {groups, categories}, undone}`. Each outcome is `applied`, `changed` (the Transaction, line, or Category is not what the agent read, or the Transaction is gone), `transfer`, `startingBalance`, `split` (a split Transaction named without a line), or `notAllowed` (the target is hidden, in a hidden Group, removed since the read, or not a normal Category, such as Ready to Assign). The whole proposal is refused with a 400 for malformed input, text that is not a Transaction or Category ID, a hidden, special, or missing `groupId`, or a new name that matches an existing Category or Group. A proposal takes at most 100 changes and at most 20 new Groups and 20 new Categories; the MCP tool's schema states the same limits.
- **Undo answer:** `{id, restored, keptTransactionIds, removedCategories, removedGroups}`. A second undo returns the first undo's answer.
- **"In use"** for a created Category means: any Transaction or split line, any Assignment, any Target, any Payee's Remembered Category, or a Category the latest cutover move's Undo would put back. A created Group is removed only when it has no Categories left.
- **Recent read:** `GET /agent/proposals` returns the 20 most recent proposals with `applied`, `refused`, and `undone`.
- **Backup:** the export includes the new `agentProposals` table, like `cutoverMoveHistory`.
