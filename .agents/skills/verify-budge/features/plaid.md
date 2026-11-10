# Plaid connection, Sync now, reconnect and automatic updates

Inspect bank freshness, request sync, and see when a Bank Connection needs a reconnect or a consent renewal, without claiming a seed contacts a bank.

## Sub-features

- `plaid-status`, `plaid-sync`: freshness, exact time, errors, repeat/busy outcomes.
- `plaid-attention`: the Budget's `Needs you` line and the Bank card that asks for a reconnect; what Reconnect and Sync now do from there.
- `plaid-consent`: the card's `Your consent at the bank ends …` line and its Reconnect.
- `plaid-connect`, `plaid-reconnect`: connect a new Item; update-mode Plaid Link and the sync after it.
- `plaid-auto`: verified webhook and daily backup sync.
- `plaid-remove`: remove a Bank Connection, stop syncing one bank Account, and bring an ignored bank Account back.

## How to get to it (user POV)

- The `Bank` Section (sidebar on desktop, tab bar on phone, direct `/bank`). Its badge counts the things that need the owner: held bank Accounts plus cards that need a look. It is red when a connection needs a reconnect or its last sync failed and amber otherwise, matching the Budget's `Bank` chip; the Unapproved badge stays green.
- Bank page → `Connect a bank` (disabled with a notice when this server has no Plaid credentials or no cutover date is set; a Sandbox server explains the `user_good`/`pass_good` login).
- Each Bank Connection is an `article` card in the `Bank Connections` list: name, a `Feeds` line linking each Budge Account it feeds (or `Feeds no Budge Account yet.`), a list of every problem it has (`A sample connection with no bank login, so it can’t sync or reconnect.`, a needed reconnect, a failed sync, consent ending, a missed daily sync, or `N transactions waiting` for held bank Accounts), on a card that can reconnect and needs no reconnect yet, `Reconnect if the bank asks you to sign in again.` (it describes Reconnect), then one line beside the buttons (above them on phones) that reads the freshness (`Last successful sync … ago.` or `Never synced.`, with a check only when nothing is wrong) until a Sync now, Reconnect or menu action reports; then it shows `Syncing…`/`Reconnecting…` and the result in the same place (a warning icon and red text when it failed), `Sync now`, and `Reconnect`. The card's next step is the filled button: Reconnect when a reconnect is needed, otherwise Sync now. On a card with no bank login both buttons are outlined, `aria-disabled` and described by its problem list; on a card that needs a reconnect, Sync now is `aria-disabled` and described by the reconnect line. `Connect a bank` is `aria-disabled` (not `disabled`) and described by the page notice when the server isn't set up or the cutover date is missing. A link to `/bank#connection-<id>` scrolls that card into view and focuses it once the cards load. A server without Plaid credentials says so once, in the page notice above the cards.
- Cards are ordered by urgency when they first load (a needed reconnect or failed sync, then consent ending or a missed sync, then held bank Accounts, then no bank login, then healthy) and keep that order while the page is open, so a card never jumps after Sync now or Reconnect.
- Busy buttons (`Syncing…`, `Reconnecting…`, a blocked Reconnect, `Connect a bank` while linking) are `aria-disabled` rather than `disabled`, so the button keeps focus; a click while busy does nothing. Playwright's `toBeDisabled()` covers both.
- `Connect a bank`'s result floats at the bottom of the screen with `Dismiss`, which returns focus to `Connect a bank`.
- A named Account fed by a Bank Connection shows `Synced … from <connection>` under its balance, linking to the Bank page; other Accounts read `Entered by hand or from bank files`. When its connection needs the owner, the line starts with a pill naming the reason (`Reconnect needed`, `Last sync failed`, `Consent ends <Mon d>`, `Missed its daily sync`) that links to that connection's card; its accessible name (an `aria-label`) is `<reason>: <connection>`. The line reserves two lines below `sm` and one from `sm`, so a longer sync time never moves the page.
- Each card's `<connection> actions` menu lists `Stop syncing <Account>` for every Budge Account it feeds, then `Remove connection…`, which opens the alert dialog `Remove <connection>?` (`Keep it` returns focus to the actions button; `Remove connection` drops the card, reports `<connection>: Removed. Its Transactions stay in your Accounts.` in the floating message, and focuses the next card, or `Connect a bank` when none is left). Removing tells Plaid to drop the Item when this server has Plaid credentials, then forgets its bank Accounts and held rows; Transactions it brought in stay.
- `Stop syncing <Account>` (or `Stop syncing from <connection>` in a named Account's actions menu) unmaps that bank Account and ignores it: the Account keeps its Transactions and reads `Entered by hand or from bank files`. The card then lists it in an `Ignored bank Accounts` region with `Bring back <label>`; Bring back moves it to `New bank Accounts` (`No transactions waiting yet` until the next sync) and focuses its `Set up` button.
- Budget page → `Needs you` region → link `Bank: N things need you` (`Bank: N to do` below `sm`) → Bank page.
- Webhook/cron have no direct UI entry; their user-visible result is automatic arrival/freshness.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/plaid.ts`, also run by `bun run test:e2e:local`):

- `plaid/status`: seed status (`plaid-status`).
- `plaid/late-sync`: the late Sync now recipe (`plaid-sync`).
- `plaid/attention`: needs attention (`plaid-attention`).
- `plaid/consent`, `plaid/late-renew`: consent and a renew result that waits for its own Bank Connection (`plaid-consent`).
- `plaid/remove`: Keep it, then Remove connection on Sample Community Bank; Savings keeps its Transactions (`plaid-remove`).
- `plaid/stop-and-bring-back`: Savings stops syncing from Sample Community Bank; the card's Bring back offers `Sample Statement Savings ending 6604` for setup (`plaid-remove`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index. `budget-with-accounts` has Sample Bank (Sandbox), with no login. `bun run app seed bank-sync` adds Sample Credit Union (feeds Checking; consent ends in 5 days), Sample Savings Bank (feeds nothing; needs attention after `ITEM_LOGIN_REQUIRED`) and Sample Community Bank (feeds Savings from its bank Account `Sample Statement Savings` ending 6604; healthy, last synced 3 hours ago). Both have a login token that never decrypts, so Budge reaches no bank.
- Readiness for `bank-sync`: on `/bank`, require the Sample Savings Bank card text `Needs you to reconnect before it can sync again.`
- A card is `getByRole("list", { name: "Bank Connections" }).getByRole("article", { name, exact: true })`.

- **Seed status (`budget-with-accounts`):** on `/bank` the Sample Bank (Sandbox) card reads `A sample connection with no bank login, so it can’t sync or reconnect.` and `Last successful sync 2 hours ago.` with no check. Its Sync now and Reconnect are `aria-disabled="true"` with that sentence as their accessible description; clicking Sync now does nothing (empty status, no new Transactions or changed balances).
- **Needs attention (`bank-sync`):** on the Budget, the `Needs you` region links `/^Bank: \d+ things? needs? you$/` to `/bank`. Only Sample Savings Bank's card says `Needs you to reconnect before it can sync again. The bank stopped its sync at <time>.` as one line, with no Plaid error code and no second failure line, and `Last successful sync 1 day ago.`. Click its Reconnect; require status `Bank sync isn't set up on this server.` (the local app has no Plaid credentials; with credentials Plaid Link would open), Reconnect enabled again, and after a reload the card's text unchanged. Its Sync now is `aria-disabled` with the description starting `Needs you to reconnect before it can sync again.`; a forced click leaves its status empty. The server still refuses a paused connection with `Reconnect this bank first.` before using its token. On a healthy card of a server without Plaid credentials or a token key, Sync now says `Bank sync isn't set up on this server.` and records no failure on the card; the daily sync skips every connection there too.
- **Consent (`bank-sync`):** Checking's sync line has the link `/^Consent ends .+: Sample Credit Union$/`; clicking it opens `/bank` with the Sample Credit Union card focused and in view. The Sample Credit Union card says `/Your consent at the bank ends .+\. Reconnect to renew it\./`. Its Reconnect reports `Bank sync isn't set up on this server.`; after a reload the consent line is still there.
- **Late renew (`bank-sync`, `plaid/late-renew`):** hold `bankConnections:reconnect` (`e2e/heldResponse.ts`) on Sample Credit Union. Its button reads `Reconnecting…` (disabled); every other card's Reconnect is disabled while Plaid Link may open, but a healthy card's Sync now (Sample Community Bank) stays enabled. On release the result lands on the Credit Union card only.
- **Late Sync now (`bank-sync`, `plaid/late-sync`):** hold `bankConnections:syncNow` on the Sample Community Bank card; its button reads `Syncing…` (disabled). Sync Sample Credit Union meanwhile: the held response stalls the socket, so both cards read `Syncing…` with empty statuses. On release both show `Bank sync isn't set up on this server.`, and Sample Savings Bank's status stays empty. A result belongs to the card that asked for it.
- **Held bank Accounts (`bank-sync`):** a card's `New bank Accounts` region lists bank Accounts waiting for a home, each with `Set up <label>` (driven by the `accounts/held-*` journeys in `accounts.md`).
- **At 320–390 px:** the Bank page and its cards stack in one column with no sideways scroll; `shell/phone-pages` loads and scrolls it under the layout-shift guard.
- **Live Sandbox (blocked):** requires a separately authorized Sandbox Item, encrypted token configuration and mapped Accounts. Use UI Sync now, require new/Cleared/Unapproved Transactions, Matches, cursor idempotence on repeat, freshness and busy/error handling; inspect actual network side effects including refresh instead of inferring from a test label. Never provision a token, deploy, or call Plaid to bypass this task's local scope.
- **Successful reconnect (blocked):** needs real Plaid Link in update mode. Require the same Item, the sync after success (`Reconnected. Added …` or plain `Reconnected.`), and the card's attention line and the Bank badge cleared. A seed cannot reach this; record it as blocked.
- **Automatic updates (blocked):** after an authorized signed Sandbox webhook or daily scheduled sync, require imported rows/freshness once; repeated/out-of-order events must not duplicate, invalid signature must not change data, and tokenless seed must make no Plaid calls. Pair browser observation with the boundary tests in `convex/plaidWebhook.test.ts`, `convex/lib/plaidWebhook.test.ts` and `convex/bankConnections.test.ts`.

## Gotchas

- **Manual drive:** freshness reads `Last successful sync …`, `Never synced`, or `Not synced since <date>` when the last sync is more than 48 hours old. The seed status journey does not cover the latter two.
- **Manual drive with authorized Plaid Link:** exiting Link is silent; a load failure says `Plaid Link didn't load. Try again.` Success may say plain `Reconnected.` rather than Added/Matched counts.

- The `plaid/*` journeys prove none of Plaid Link or a real sync.
- Setup saves the sealed token before it points the Item's webhook at Budge, and a token exchange is never retried: Plaid honors a public token once, so a lost response must not orphan an Item (each one spends a Production Trial slot).
- The `bank-sync` fixture is built by `convex/seedBankSync.ts` through the production sync mutations; it refuses to run on a production deployment.
- `bankConnections.connect`/`finishConnect` are the in-app Connect path (create-mode Plaid Link); `bankConnections.service` reports whether this server has Plaid credentials and the token key, and which Plaid environment it uses. A local backend has none, so `connect` and Sync now on a tokened connection say `Bank sync isn't set up on this server.` `bankConnections.setup` is internal provisioning. It refuses a new Item once Budge holds `MAX_BANK_CONNECTIONS` (20); setting up an existing Item again still replaces its token. Ticket 17's manual cloud Sandbox check is still open.
- Sources: tickets 17, 18, 20, 23; public `bankConnections.list/service/connect/finishConnect/syncNow/reconnect/syncAfterReconnect/remove` and `heldAccounts.stopSyncing/restore`.
