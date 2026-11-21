# 03 — Complete transaction cleanup through Budge MCP

Status: implemented on feat/mcp-transaction-cleanup
Spec: [Agent budget access](../spec.md)
Follow-up to [Agent categorization](02-agent-categorization.md).

## Goal

Let the owner finish reviewing Uncategorized Transactions through Budge MCP. A confirmed inflow can go to Ready to Assign. Two Bank Rows for a confirmed card payment can become the two sides of a Transfer.

## Problem

During a budget cleanup, the MCP could categorize ordinary spending. The owner still needed the app to record a gift as Ready to Assign and to link five imported card payments. The [proposal target guard](../../../convex/agentProposals.ts#L139) accepts regular Categories only. The app already supports [Ready to Assign](../../../src/lib/components/transactions/categoryChoices.ts#L18) and [linking the other side of a Transfer](../../../src/lib/components/transactions/transaction-dialog.svelte#L724).

## Acceptance

- **Inflow.** After the owner approves the proposed change, an Uncategorized inflow can move to Ready to Assign. The MCP can identify that target, and the Transaction and budget reads reflect the change. The proposal can be undone under the existing conflict rules.
- **Card payment.** After the owner approves a proposal that identifies both imported Transactions, Budge links the existing pair as one Transfer. Use the app's [Transfer eligibility rules](../../../convex/lib/transactions.ts#L394). With opposite amounts and bank dates one day apart, both Account balances and both Bank Rows are preserved. Each side appears in its Account and drops out of Uncategorized results.
- **Conflicts and retries.** Revalidate both Transfer sides at apply time. If either has changed or is no longer eligible, report the conflict and leave the pair as it was. Repeating an apply request returns the recorded result. Undo restores the pair when both sides still match the applied result and preserves later owner edits.

Prioritize linking imported payments. Each payment leaves two Transactions in the cleanup queue.
