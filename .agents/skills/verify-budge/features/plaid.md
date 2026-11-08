# Plaid connection, Sync now, reconnect and automatic updates

Inspect bank freshness, request sync, and see when a Bank Connection needs a reconnect or a consent renewal, without claiming a seed contacts a bank.

## Sub-features

- `plaid-status`, `plaid-sync`: freshness, exact time, errors, repeat/busy outcomes.
- `plaid-attention`: the Budget's `Needs you` line and the Bank card that asks for a reconnect; what Reconnect and Sync now do from there.
- `plaid-consent`: the card's `Your consent at the bank ends …` line and its Reconnect.
- `plaid-connect`, `plaid-reconnect`: connect a new Item; update-mode Plaid Link and the sync after it.
- `plaid-auto`: verified webhook and daily backup sync.

## How to get to it (user POV)

- The `Bank` Section (sidebar on desktop, tab bar on phone, direct `/bank`). Its badge counts the things that need the owner: held bank Accounts plus cards that need a look.
- Bank page → `Connect a bank` (disabled with a notice when this server has no Plaid credentials or no cutover date is set; a Sandbox server explains the `user_good`/`pass_good` login).
- Each Bank Connection is an `article` card in the `Bank Connections` list: name, freshness, `Sync now`, and `Reconnect`. A card that needs a reconnect or whose consent is ending says so on its status line.
- Budget page → `Needs you` region → link `Bank: N things need you` → Bank page.
- Webhook/cron have no direct UI entry; their user-visible result is automatic arrival/freshness.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/plaid.ts`, also run by `bun run test:e2e:local`):

- `plaid/status`: seed status (`plaid-status`).
- `plaid/late-sync`: the late Sync now recipe (`plaid-sync`).
- `plaid/attention`: needs attention (`plaid-attention`).
- `plaid/consent`, `plaid/late-renew`: consent and a renew result that waits for its own Bank Connection (`plaid-consent`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index. `budget-with-accounts` has Sample Bank (Sandbox), with no login. `bun run app seed bank-sync` adds Sample Credit Union (consent ends in 5 days) and Sample Savings Bank (needs attention after `ITEM_LOGIN_REQUIRED`). Both have a login token that never decrypts, so Budge reaches no bank.
- Readiness for `bank-sync`: on `/bank`, require the Sample Savings Bank card text `Needs you to reconnect before it can sync again.`
- A card is `getByRole("list", { name: "Bank Connections" }).getByRole("article", { name, exact: true })`.

- **Seed status (`budget-with-accounts`):** on `/bank` the Sample Bank (Sandbox) card reads `Synced 2 hours ago.` Click its Sync now; require status `This Bank Connection has no bank login, so it never syncs.` and no new Transactions or changed balances.
- **Needs attention (`bank-sync`):** on the Budget, the `Needs you` region links `/^Bank: \d+ things? needs? you$/` to `/bank`. Only Sample Savings Bank's card says `Needs you to reconnect before it can sync again.` Click its Reconnect; require status `Bank sync isn't set up on this server.` (the local app has no Plaid credentials; with credentials it would be `Bank sync isn't set up on this server.`), Reconnect enabled again, and after a reload the card's text unchanged. Sync now on that card says `The bank needs you to reconnect.` (a paused connection refuses before using its token).
- **Consent (`bank-sync`):** the Sample Credit Union card says `/Your consent at the bank ends .+\. Reconnect to renew it\./`. Its Reconnect reports `Bank sync isn't set up on this server.`; after a reload the consent line is still there.
- **Late renew (`bank-sync`, `plaid/late-renew`):** hold `bankConnections:reconnect` (`e2e/heldResponse.ts`) on Sample Credit Union. Its button reads `Reconnecting…` (disabled); every other card's Reconnect is disabled while Plaid Link may open, but their Sync now stays enabled. On release the result lands on the Credit Union card only.
- **Late Sync now (`bank-sync`, `plaid/late-sync`):** hold `bankConnections:syncNow` on the Sandbox card; its button reads `Syncing…` (disabled). Sync the Credit Union meanwhile: the held response stalls the socket, so both cards read `Syncing…` with empty statuses. On release the Sandbox card shows the no-login message and the Credit Union card the not-set-up one. A result belongs to the card that asked for it.
- **Held bank Accounts (`bank-sync`):** a card's `New bank Accounts` region lists bank Accounts waiting for a home, each with `Set up <label>` (driven by the `accounts/held-*` journeys in `accounts.md`).
- **At 320–390 px:** the Bank page and its cards stack in one column with no sideways scroll; `shell/phone-pages` loads and scrolls it under the layout-shift guard.
- **Live Sandbox (blocked):** requires a separately authorized Sandbox Item, encrypted token configuration and mapped Accounts. Use UI Sync now, require new/Cleared/Unapproved Transactions, Matches, cursor idempotence on repeat, freshness and busy/error handling; inspect actual network side effects including refresh instead of inferring from a test label. Never provision a token, deploy, or call Plaid to bypass this task's local scope.
- **Successful reconnect (blocked):** needs real Plaid Link in update mode. Require the same Item, the sync after success (`Reconnected. Added …` or plain `Reconnected.`), and the card's attention line and the Bank badge cleared. A seed cannot reach this; record it as blocked.
- **Automatic updates (blocked):** after an authorized signed Sandbox webhook or daily scheduled sync, require imported rows/freshness once; repeated/out-of-order events must not duplicate, invalid signature must not change data, and tokenless seed must make no Plaid calls. Pair browser observation with the boundary tests in `convex/plaidWebhook.test.ts`, `convex/lib/plaidWebhook.test.ts` and `convex/bankConnections.test.ts`.

## Gotchas

- **Manual drive:** freshness reads `Synced …`, `Never synced`, or `Not synced since <date>` when the last sync is more than 48 hours old. The seed status journey does not cover the latter two.
- **Manual drive with authorized Plaid Link:** exiting Link is silent; a load failure says `Plaid Link didn't load. Try again.` Success may say plain `Reconnected.` rather than Added/Matched counts.

- The `plaid/*` journeys prove none of Plaid Link or a real sync.
- Setup saves the sealed token before it points the Item's webhook at Budge, and a token exchange is never retried: Plaid honors a public token once, so a lost response must not orphan an Item (each one spends a Production Trial slot).
- The `bank-sync` fixture is built by `convex/seedBankSync.ts` through the production sync mutations; it refuses to run on a production deployment.
- `bankConnections.connect`/`finishConnect` are the in-app Connect path (create-mode Plaid Link); `bankConnections.service` reports whether this server has Plaid credentials and the token key, and which Plaid environment it uses. A local backend has none, so `connect` and Sync now on a tokened connection say `Bank sync isn't set up on this server.` `bankConnections.setup` is internal provisioning. It refuses a new Item once Budge holds `MAX_BANK_CONNECTIONS` (20); setting up an existing Item again still replaces its token. Ticket 17's manual cloud Sandbox check is still open.
- Sources: tickets 17, 18, 20, 23; public `bankConnections.list/service/connect/finishConnect/syncNow/reconnect/syncAfterReconnect`.
