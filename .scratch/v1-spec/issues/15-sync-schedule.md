# How often does sync run, and what happens when a Bank Connection breaks?

Type: grilling
Status: resolved
Blocked by: 

## Question

With Plaid chosen ([Which aggregator syncs Capital One and Discover for at most $25 a year?](01-bank-sync-provider.md)) and the import flow decided ([How do synced Transactions arrive?](07-import-flow.md)): does sync run on Plaid's `SYNC_UPDATES_AVAILABLE` webhook, on a schedule, on manual refresh, or a mix; how is freshness shown (last synced time per Bank Connection); and what happens when a Bank Connection needs re-authentication (yearly Capital One consent renewal, Discover's migration to Capital One logins changing external IDs), including how the owner is told and how Link update mode is entered?

## Answer

**Plaid's webhook drives sync, with a daily cron as a safety net and a manual Sync now. Budge never creates or deletes a Plaid Item: the one existing Capital One Bank Connection is renewed in place through Link update mode.**

**When sync runs**

- `SYNC_UPDATES_AVAILABLE` arrives at a Convex HTTP action, which verifies Plaid's signed JWT and runs `/transactions/sync` from the stored cursor.
- A daily Convex cron runs the same sync for every Bank Connection, in case a webhook is lost.
- **Sync now** runs a sync at once and calls `/transactions/refresh`, so fresh bank data arrives later through the webhook. It is ignored while a sync is already running.
- Syncs for one Bank Connection run one at a time and are safe to repeat (duplicate or out-of-order webhooks are harmless).
- Load: about 10 syncs a day, roughly 3,000 Convex function calls a month against the free 1M; far below Plaid's per-Item limits (`/transactions/refresh` 2/min and 120/hour, `/transactions/sync` 50/min).

**Freshness**

- One plain-text line per Bank Connection in the Account sidebar: "Synced 2 hours ago", the time Budge last reached Plaid successfully (not when the bank last posted). Opening it shows the exact time and any error.
- After 48 hours without a successful sync the line becomes a plain-text warning ("Not synced since Oct 25").

**Failures and telling the owner**

- Short-lived errors (institution down, rate limits, network) retry quietly with backoff and surface only through the 48-hour warning.
- Errors that need the owner (`ITEM_LOGIN_REQUIRED`, revoked consent, `PENDING_DISCONNECT`) mark the Bank Connection as needing attention at once and pause its sync.
- In-app only: one plain-text notice at the top of the budget screen ("Capital One needs you to reconnect" with a Reconnect button) plus the sidebar line. No email or push in v1 (the PWA has no service worker).

**Reconnect and renewal**

- Reconnect always opens Plaid Link in **update mode** on the existing Item; it never deletes or recreates it. A sync runs right after.
- From 14 days before `consent_expiration_time` (Capital One's yearly consent), the sidebar line reads "Consent ends Nov 10, renew". The top-of-screen notice appears only once reconnection is actually needed.

**No in-app Item creation or deletion**

- Budge has no Connect and no Disconnect. The existing Capital One Item (from [Connect real accounts and capture sample data](08-connect-accounts.md)) is loaded once by an owner-only setup script: the token is encrypted through `TokenCipher`, and the script points the Item's webhook at Budge with `/item/webhook/update` (Quickstart created it without one).
- If Plaid ever reports an Item that update mode can't repair, the fix happens outside the app: link once more through the private Quickstart, then re-run the setup script with the new token. That uses one of the 9 remaining Items.
- To stop Plaid reading the bank, revoke access at Capital One or in Plaid's Dashboard.
- Two-way door: the Bank Connection table stays general (one row today), so Connect or Disconnect can be added later without a data change. No ADR.

**Unknown Plaid Accounts**

- Each Budge Account stores the Plaid `account_id` it maps to. When Plaid reports an Account Budge doesn't know (`NEW_ACCOUNTS_AVAILABLE`, or an unknown ID during sync), its rows are held, not imported, until the owner maps it to an existing Account, creates a new Account, or ignores it.
- After mapping to an existing Account, the first sync matches its rows against already-imported Transactions (the rule file rows use), so history arriving under new IDs isn't duplicated.

**Plaid Trial cost and duration** (Plaid help center, updated October 2026)

- No duration or expiry is stated for Trial. "Lifetime" applies to the cap of 10 Items created; `/item/remove` doesn't free a slot. Consent renewal through update mode reuses the Item and costs nothing.
- "API calls against your existing connected Items are not capped." Transactions, including Transactions Refresh, is in the Trial bundle.
- Upgrading is one-way: once a paid Production application is submitted or approved, Trial can't be restored. Don't submit one unless leaving Trial is intended.
- Paid prices aren't published. Pay-as-you-go (no minimum) bills Transactions per Item per month while its token exists and Refresh per call; amounts appear only in the Dashboard request form. If Trial ends, SimpleFIN Bridge ($15/year plus tax, daily polling, no webhook, so cron-only) is the fallback.
- Trial has no support cases, only Plaid's AI assistant.
- Sources: [What is the Plaid Trial plan?](https://support.plaid.com/hc/en-us/articles/39994173227159-What-is-the-Plaid-Trial-plan), [Sandbox, Production, Trial plan, and Limited Production](https://support.plaid.com/hc/en-us/articles/16110110883479-How-are-Sandbox-Production-Trial-plan-and-Limited-Production-different), [Upgrading from Trial](https://support.plaid.com/hc/en-us/articles/39917307426967-How-do-I-upgrade-from-the-Trial-plan-to-a-paid-Production-plan), [Plaid billing docs](https://plaid.com/docs/account/billing/), [Plaid rate limits](https://plaid.com/docs/errors/rate-limit-exceeded/), [Convex limits](https://docs.convex.dev/production/state/limits).

**Effects on other tickets**

- [What does the data model look like in Convex?](11-data-model.md): see the comment added there.
- [What does the budget screen look like on desktop and phone?](09-budget-screen.md) (resolved): the sidebar gets the per-Bank Connection freshness line; the budget screen gets the reconnect notice above the table.
