# Plaid connection, Sync now, reconnect and automatic updates

Inspect bank freshness, request sync, and see when a Bank Connection needs a reconnect or a consent renewal, without claiming a seed contacts a bank.

## Sub-features

- `plaid-status`, `plaid-sync`: freshness, exact time, errors, repeat/busy outcomes.
- `plaid-attention`: needs-attention notice on the Budget and in the connection dialog; what Reconnect and Sync now do from there.
- `plaid-consent`: `Consent ends …, renew` line and its dialog text.
- `plaid-connect`, `plaid-reconnect`: connect a new Item; update-mode Plaid Link and the sync after it.
- `plaid-auto`: verified webhook and daily backup sync.

## How to get to it (user POV)

- Desktop sidebar `Bank Connections` list → `<name>: Synced …` button → dialog `<name>` → `Sync now` (and `Reconnect` when the connection needs attention or its consent is ending).
- Budget page → `<name> needs you to reconnect` line → `Reconnect`.
- Sidebar under a connection → `Consent ends <date>, renew` → `renew`.
- Webhook/cron have no direct UI entry; their user-visible result is automatic arrival/freshness.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index. `budget-with-accounts` has Sample Bank (Sandbox), with no login. `bun run app seed bank-sync` adds Sample Credit Union (consent ends in 5 days) and Sample Savings Bank (needs attention after `ITEM_LOGIN_REQUIRED`). Both have a login token that never decrypts, so Budge reaches no bank.
- Readiness for `bank-sync`: on `/`, require text `Sample Savings Bank needs you to reconnect`.

- **Seed status (`budget-with-accounts`):** `getByRole("list", { name: "Bank Connections" }).getByRole("button", { name: /Sample Bank \(Sandbox\): Synced/ }).click()`; require dialog `Sample Bank (Sandbox)` and Last synced exact time. Click Sync now, require status `This Bank Connection has no bank login, so it never syncs.` Require no new Transactions or changed balances.
- **Needs attention (`bank-sync`):** on the Budget, require the notice `Sample Savings Bank needs you to reconnect` and no notice for Sample Credit Union. Click its `Reconnect`; require status `Couldn't reach the bank; try again later.` and the notice still shown. Open the sidebar button `/Sample Savings Bank: /` (it carries the `Needs a look` icon); require dialog text `Sample Savings Bank needs you to reconnect.` and alert `/failed: The bank needs you to reconnect \(ITEM_LOGIN_REQUIRED\)\.$/`. Sync now here also fails with `Couldn't reach the bank; try again later.`, because the fixture's token never decrypts. It does not prove how a real needs-attention connection refuses a sync; that stays with `convex/bankConnections.test.ts`.
- **Consent (`bank-sync`):** require sidebar text `/^Consent ends .+, renew$/` under Sample Credit Union. Click `renew`; require the dialog `Sample Credit Union` to open with status `Couldn't reach the bank; try again later.` and text `/^Your consent at the bank ends .+ Reconnect to renew it\.$/`.
- **Late Sync now (`bank-sync`):** hold the `bankConnections:syncNow` action response (`e2e/heldResponse.ts`), click Sync now in `Sample Bank (Sandbox)`, press Escape, open `/^Sample Credit Union: /`. Require its `Sync now` enabled (not `Syncing…`). Release; require no `status` in the Credit Union dialog and no `This Bank Connection has no bank login` text anywhere. A result belongs to the opening that asked for it.
- **At 320 px:** the Budget notice and its `Reconnect` still show. The `Bank Connections` list (status, Sync now, the consent line) renders only in the desktop sidebar, and neither the View menu nor the app menu offers it, so record those recipes at desktop width.
- **Live Sandbox (blocked):** requires a separately authorized Sandbox Item, encrypted token configuration and mapped Accounts. Use UI Sync now, require new/Cleared/Unapproved Transactions, Matches, cursor idempotence on repeat, freshness and busy/error handling; inspect actual network side effects including refresh instead of inferring from a test label. Never provision a token, deploy, or call Plaid to bypass this task's local scope.
- **Successful reconnect (blocked):** needs real Plaid Link in update mode. Require the same Item, the sync after success (`Reconnected. Added …`), and the notice and `Needs a look` icon cleared. A seed cannot reach this; record it as blocked.
- **Automatic updates (blocked):** after an authorized signed Sandbox webhook or daily scheduled sync, require imported rows/freshness once; repeated/out-of-order events must not duplicate, invalid signature must not change data, and tokenless seed must make no Plaid calls. Pair browser observation with the boundary tests in `convex/plaidWebhook.test.ts`, `convex/lib/plaidWebhook.test.ts` and `convex/bankConnections.test.ts`.

## Gotchas

- `e2e/bank-connections.test.ts` covers seed status and the late Sync now result; `e2e/bank-reconnect.test.ts` covers needs-attention and consent. Neither proves Plaid Link or a real sync.
- The `bank-sync` fixture is built by `convex/seedBankSync.ts` through the production sync mutations; it refuses to run on a production deployment.
- `bankConnections.setup` is internal provisioning, not a public Connect UI. It refuses a new Item once Budge holds `MAX_BANK_CONNECTIONS` (20), the most the sidebar lists; setting up an existing Item again still replaces its token. Ticket 17's manual cloud Sandbox check is still open.
- Sources: tickets 17, 18, 20, 23; public `bankConnections.list/syncNow/reconnect/syncAfterReconnect`.
