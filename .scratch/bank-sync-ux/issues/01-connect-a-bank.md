# 01: Connect a bank from the app

**Status:** done

**Spec:** [Bank sync and UI/UX](../spec.md), scope 1

**Blocked by:** None

## Problem

`bankConnections.setup` is internal, so the owner can't connect a bank from the app. Discovered bank accounts keep only their name and mask, so the setup step can't suggest whether an account is a Cash Account or a Credit Card Account. Missing Plaid credentials surface as "Couldn't reach the bank".

## What to build

- `PlaidClient.linkTokenCreate` takes a create mode (transactions product, Budge's webhook) and the existing update mode. `PlaidClient.publicTokenExchange` returns the Item's access token and id.
- A public `bankConnections.connect` action returns a create-mode link token. It refuses before the cutover date is set, and it refuses with `BANK_SYNC_UNAVAILABLE` when Plaid credentials or the token key are missing.
- A public `bankConnections.finishConnect` action exchanges the public token, saves the Bank Connection under the institution's name, records the Item's bank accounts as held right away, and schedules the first sync.
- Held bank accounts carry a suggested `kind` (Plaid `credit` → Credit Card Account, otherwise Cash Account), and `heldAccounts.list` returns it.
- A public `bankConnections.service` query reports whether bank sync is configured and which Plaid environment it uses.

## Acceptance

- [x] Connecting through the public actions against a fake Plaid HTTP server stores the connection and lists its bank accounts with names, masks, and suggested kinds.
- [x] `connect` refuses before the cutover date and when bank sync isn't configured, with a message that says which.
- [x] The feature map names the new public functions.

## Comments

- Backend landed: `connect`, `finishConnect`, `service`, `PlaidClient.publicTokenExchange`, create-mode `linkTokenCreate`, and suggested `kind` on held bank accounts. Proof is in `convex/plaidWebhook.test.ts` (fake Plaid HTTP server), `convex/lib/plaidClient.test.ts` (wire bodies), and `src/lib/domain/plaid.test.ts` (kind decoding).
- Sync now, Reconnect, and the sync after a reconnect keep working without credentials, so seeded connections still say why they can't sync. Plaid failures on a server without credentials map to `BANK_SYNC_UNAVAILABLE` in `toPublicError`.
- The UI for Connect is ticket 04.
