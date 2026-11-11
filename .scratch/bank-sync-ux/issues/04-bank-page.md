# 04: Bank page with guided account setup

**Status:** done

**Spec:** [Bank sync and UI/UX](../spec.md)

**Blocked by:** 01, 03

## What to build

See the spec scope item.

## Comments

- Landed: `/bank` lists every Bank Connection as a card. Each card has a fixed-height health or result line, a Reconnect button and a Sync now button that are always there, and held bank Accounts nested under their connection.
- Connect a bank runs `connect` → Plaid Link → `finishConnect`. It is disabled with the reason shown when the server has no Plaid credentials or the cutover date isn't set.
- `HeldAccountDialog` asks where each bank Account's rows go: a new Account (name and type prefilled from Plaid), an existing Account (same-name preselected), or nowhere. Settled rows stay in the card as Done, so the list never shrinks under the pointer.
- `heldAccounts.list` returns `connectionId`, proved by the first test in `convex/heldAccounts.test.ts`.
