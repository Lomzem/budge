# 03 — Complete transaction cleanup through Budge MCP

Status: merged to main in PR #39 (9d46cc1)
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

## Comments

- **Ready to Assign inflows:** `GET /agent/budget` now includes `readyToAssign.id` so MCP agents can identify the Ready to Assign Category without inferring it from a Starting Balance. `POST /agent/proposals` allows `toCategoryId` to target `readyToAssign` when the moved Transaction or split line has `amount > 0`; outflows and Credit Card Payment Categories remain `notAllowed`.
- **Linked imported Transfers:** `GET /agent/transactions` returns a `revision` per row hashing Transaction fields and Bank Row details (`id`, `state`, `date`, `amount`, `bankText`, `matched`). `POST /agent/proposals` accepts optional `transfers: [{ first: { transactionId, revision }, second: { transactionId, revision } }]` alongside optional `changes` (at least 1 and at most 100 total, no Transaction ID overlap). Apply revalidates kind, revision, and Budge's Transfer eligibility rules (`canLinkImportedTransfer`), links both sides through `linkImportedTransfer` (keeping `first`'s date and memo and both sides' Accounts, amounts, Cleared status, approval, and Bank Rows), and records post-link revisions plus original snapshots for undo.
- **Undo:** `POST /agent/proposals/undo` unlinks a Transfer pair via `unlinkTransfer` only when both sides still match their recorded post-link revisions, neither original date precedes the current cutover date, and any prior Category still exists; otherwise both Transaction IDs are returned in `keptTransactionIds` and left untouched.
- **Glossary note:** `GLOSSARY.md`'s **Categorization Proposal** definition now names Ready to Assign moves and linked imported Transfers.


## Corrections

Sol ran `/correct` (analysis only) on PR #39. Opus decided each class:

- **Freshness check omits state (accepted, types):** `transactionRevisionOf` now types its Transaction and Bank Row projections from `Doc<'transactions'>` and `Doc<'imports'>`, with excluded fields listed. A dropped or new field fails `typecheck:convex`. The serialized payload is unchanged, so recorded revisions still match.
- **Undo misses a live restore dependency (rejected):** `restoreTransfer` is the only caller of `unlinkTransfer`, and `sideCanRestore` already holds the cutover and Category checks beside it. Moving them would not protect the other Undo paths.
- **Refusal test passes for the wrong reason (accepted, tests):** the memo apply case and the memo and date undo cases now approve both sides before reading revisions, so only the named edit differs. With `memo` or `date` left out of the revision, the old cases passed and the new cases fail.
- **Bounded parent read, unbounded child reads (deferred):** a Transaction rarely has more than one or two Bank Rows, and `accounts.ts` iterates Bank Rows the same way. Revisit if the capacity check grows a many-Bank-Row fixture.
- **MCP text copies server limits (accepted):** `APPLY_DESCRIPTION` builds its window and proposal limit from `MATCH_WINDOW_DAYS` and `PROPOSAL_CHANGE_LIMIT`. `tools/list` followed both constants when they changed.
