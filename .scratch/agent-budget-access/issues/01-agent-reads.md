# 01 — Agent reads: Agent Key, setup, and read tools

Status: implemented on feat/agent-access; see the spec's Verification section
Spec: ../spec.md

## Goal

From any T3 Code thread on the owner's machine, an agent can answer "look at my October transactions, any recommendations?" by reading Budge live.

## Scope

- **Agent Key check.** Agent requests reach Convex HTTP routes under `/agent/`. Each carries the Agent Key as `Authorization: Bearer <key>`. Budge compares the key's SHA-256 with the deployment env var `BUDGE_AGENT_KEY_SHA256`. Missing env var, missing header, or wrong key → 401, with no data and no hint which. Owner sessions are not involved.
- **Read routes** (GET, query-string parameters parsed at the boundary; bad input → 400 with a plain message):
  - `/agent/budget?month=YYYY-MM&today=YYYY-MM-DD`: the month's Ready to Assign, Category Groups and Categories with Assigned / Activity / Available, Targets, hidden Categories, Overspending, upcoming.
  - `/agent/accounts`: Accounts with kind, balance, last Reconciliation date.
  - `/agent/transactions`: one page of Transactions, newest first, filtered by `from`/`to`, `accountId`, `categoryId` (+ `splitLines=true` for split Transactions with a line in it), `uncategorized=true`, `approval`, `search`; `limit` ≤ 100 (default 50) and `cursor`. Rows give date, Account, Payee, Category, amount, memo, Cleared / Reconciled / Unapproved, kind (normal / split / Transfer / Starting Balance), split lines, and Bank Text.
  - Money is reported in dollars (two decimals). IDs are included so ticket 02 can reference Transactions and Categories.
- **Local tool server.** `bun run agent serve` runs a stdio MCP server exposing `budge_budget_month`, `budge_accounts`, `budge_transactions`. It reads `{siteUrl, key}` from `~/.config/budge/agent.json` (mode 0600) and passes the owner's local date as `today`.
- **Setup.** `bun run agent setup [--deployment <name>|--prod]` generates a random key, sets `BUDGE_AGENT_KEY_SHA256` through the Convex CLI, writes the local file, and registers `budge` at user scope with Claude Code and Codex. `rotate` replaces the key; `revoke` removes the env var and the local file. Production is never touched without an explicit flag.

## Out of scope

Writes, proposals, undo (ticket 02); local cache; rate quotas; Budge UI.

## Acceptance

- Convex tests drive the HTTP routes: 401 for missing/wrong key and unset fingerprint; 400 for bad month/date/limit/IDs; budget, accounts, and a filtered, paginated Transactions read return the documented shapes and dollar amounts.
- Lint, typecheck, and the full test suite pass.
- Live: against a local backend, setup → an agent tool call returns the seeded month and Transactions; rotate makes the old key fail with 401.

## Comments
