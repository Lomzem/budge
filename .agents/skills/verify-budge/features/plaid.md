# Plaid connection, Sync now, reconnect and automatic updates

Inspect bank freshness, request sync, and track the expected connection/reconnect workflows without claiming tokenless seeds contact a bank.

## Sub-features

- `plaid-status`, `plaid-sync`: freshness, exact time, errors, repeat/busy outcomes.
- `plaid-connect`, `plaid-reconnect`: connect existing Item and update-mode renewal.
- `plaid-auto`: verified webhook and daily backup sync.

## How to get to it (user POV)

- Desktop sidebar Bank Connections → Sample Bank (Sandbox) → Sync now.
- Connect, Reconnect/update mode and consent-renewal controls are not present in this checkout.
- Webhook/cron have no direct UI entry; their user-visible result is automatic arrival/freshness.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Seed status:** `getByRole("list", { name: "Bank Connections" }).getByRole("button", { name: /Sample Bank \(Sandbox\): Synced/ }).click()`; require dialog `Sample Bank (Sandbox)` and Last synced exact time. Click Sync now, require status `This Bank Connection has no bank login, so it never syncs.` Require no new Transactions or changed balances. Capture sidebar, action and status.
- **Live Sandbox (blocked):** requires separately authorized Sandbox Item, encrypted token configuration and mapped Accounts. Use UI Sync now, require new/Cleared/Unapproved Transactions, Matches, cursor idempotence on repeat, freshness and busy/error handling; inspect actual network side effects including refresh instead of inferring from a test label. Never provision a token, deploy, or call Plaid to bypass this task’s local scope.
- **Connect/update (blocked):** require visible connect entry or existing-item Reconnect notice, open real Link in connect/update mode as appropriate. For reconnect require same Item, post-success sync, cleared attention state; check 48-hour freshness and 14-day consent notice, without new/deleted Item. Record missing controls as failure/block.
- **Automatic updates (blocked):** after an authorized signed Sandbox webhook or daily scheduled sync, require imported rows/freshness once; repeated/out-of-order events must not duplicate, invalid signature must not change data, and tokenless seed must make no Plaid calls. Browser observation alone cannot prove signature validation or no network calls: pair it with the boundary tests in `convex/plaidWebhook.test.ts`, `convex/lib/plaidWebhook.test.ts` and `convex/bankConnections.test.ts`.

## Gotchas

- Seed connection has no token; it proves only status and no-login outcome. Sandbox credentials/Item and token key are not supplied by this fixture.
- Ticket 17’s manual cloud Sandbox check is still open. The ticket 18 webhook (`/plaid/webhook` in `convex/http.ts`) and daily sync (`convex/crons.ts`) exist but need a live Sandbox Item and signed webhook to drive, so they stay blocked here. Ticket 20 reconnect/health/consent UI is unimplemented. `bankConnections.setup` is internal provisioning, not a public Connect UI.
- Sources: tickets 17, 18, 20, 23; `e2e/bank-connections.test.ts`; public `bankConnections.list/syncNow`.
