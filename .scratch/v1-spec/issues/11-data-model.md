# What does the data model look like in Convex?

Type: grilling
Status: resolved
Blocked by: 06, 07, 14, 15

## Question

What tables, fields, and indexes does the Convex schema need to support the budget rules and the import flow: money representation, month keys, Accounts, Transactions and splits, Categories and Category Groups, Assigned per month, Payees, Bank Connections, and encrypted secrets?

## Comments

- From [Where does Effect go in Budge?](14-effect-boundaries.md): `v.*` validators own tables and function contracts (types inferred, no hand-written mirrors); Effect Schema decodes only external data. Bank Connection tokens go through a `TokenCipher` service (AES-GCM, key in Convex env).
- From [Which domain does Budge run on?](12-domain.md): the schema must keep **production, the cloud dev deployment, and preview deployments together inside the Convex free tier**. They share one team quota (local deployments, the default for dev and CI per [How is the repo set up?](10-repo-setup.md), don't count): 1M function calls a month, 0.5 GB of storage, **1 GB of database I/O a month**, and 40 deployments. On the free plan, hitting a limit makes writes fail. Database I/O is the only limit realistically at risk. Before choosing the schema, use the sample capture from [Connect real accounts and capture sample data](08-connect-accounts.md) to estimate the bytes per Transaction document and the bytes read by one budget-screen load and one Transaction-list load. Multiply by expected loads a month for production plus a few active previews, then show the total fits under 1 GB with clear headroom. Ways to keep reads low, for this ticket to decide:
  - **Per-month Activity totals per Category,** kept in the same mutation that writes a Transaction, so Available never scans the full history. This sits against the rule in [What are the exact budget rules?](06-budget-rules.md) that only Transactions and Assigned are stored. If this ticket keeps the totals, it must record them explicitly as a derived cache that can be rebuilt from Transactions.
  - **Read by month through an index** on the budget screen and the Transaction list. No `.collect()` over the full history.
  - **Small Transaction documents:** raw Plaid payloads and anything else read rarely go in a separate table.
  - **One mutation per import batch,** so subscribed queries re-run once instead of once per Transaction.
  - **Paginated Transaction list** (Convex paginated queries).
- Also from [Which domain does Budge run on?](12-domain.md): local, dev, and preview deployments start empty and are filled by the **synthetic seed function** from [How is the repo set up?](10-repo-setup.md) (previews run it with `npx convex deploy --preview-run`). The seed must never contain real data, because the repo is public. The schema must be seedable that way. The seed must also stay small, because preview deployments draw on the shared team quota.
- From [How often does sync run, and what happens when a Bank Connection breaks?](15-sync-schedule.md): each Bank Connection needs its Plaid Item ID, encrypted token, sync cursor, status (OK / needs attention, with the last error code), `consent_expiration_time`, last successful sync time, and a lock or queue so only one sync runs at a time. Each Account needs its Plaid `account_id` (optional, for manual Accounts). Rows for an unknown Plaid Account are held until mapped, created, or ignored, and the ignored `account_id`s are remembered. There is no Item count.

## Answer

**Store only what the owner and the bank own, plus one rebuildable cache of monthly totals, so the budget screen never reads the whole Transaction history.**

**Conventions**

- Amounts are `v.number()` whole cents, checked as safe integers (no `v.int64()`: bigint is awkward in JSON, Svelte, and tests). Dates are `"YYYY-MM-DD"` strings; months are `"YYYY-MM"` strings. Both sort correctly as text and work as index keys.
- No owner column and no `users` table: each deployment is one budget, and `requireOwner` checks the Clerk user ID from env. Multi-user would be a migration; it is out of scope.
- `v.*` validators own every table; types come from `Doc<>`/`Id<>` ([Where does Effect go in Budge?](14-effect-boundaries.md)).

**Tables**

| Table | Fields | Indexes |
|---|---|---|
| `settings` | one row: cutover date | none |
| `accounts` | `name`, `kind` (`cash` / `creditCard`), `position`, `lastReconciledOn?`. No `closed` flag (not in v1 scope; can be added as an optional field). No provider fields. | none |
| `categoryGroups` | `name`, `position`, `hidden`, `kind` (normal, or system: `creditCardPayments`, and a hidden group for Ready to Assign) | none |
| `categories` | `groupId`, `name`, `position`, `hidden`, `kind` (`normal` / `readyToAssign` / `creditCardPayment` with `accountId`), optional embedded Target: `monthly {amount, mode: refill \| setAside, dueDay?}` or `byDate {amount, firstDate, everyMonths?}` | by group and position |
| `assignments` | Assigned per (`month`, `categoryId`), cents; setting 0 deletes the row | `by_month_category` |
| `transactions` | `accountId`, `date`, `amount`, `payeeId?`, `categoryId?`, `split`, `memo?`, `cleared` (`uncleared` / `cleared` / `reconciled`), `approved`, `transferTransactionId?`, `searchText` | `by_account_date`, `by_date`, `by_approved_date`, `by_category_date`, `by_payee`, `by_account_amount_date`; search index on `searchText` with filter fields `accountId`, `categoryId`, `payeeId` |
| `transactionSplits` | `transactionId`, `categoryId`, `amount`, `memo?`, parent's `date` (denormalized) | `by_category_date`, `by_transaction` |
| `payees` | `name`, `lastCategoryId?` (Payee memory) | `by_name` |
| `payeeRenames` | exact `bankText` → `payeeId` (rename memory) | `by_bank_text` |
| `imports` (Bank Rows) | `source` (`plaid` / `qfx` / `csv`, open-ended), `sourceId?` (Discover CSV has none), `accountId?` (empty while held), `connectionAccountId?`, `date`, `amount`, `bankText`, `transactionId?`, `state` (`linked` / `held` / `changed` / `removed`); a `changed` row keeps the bank's newest values | `by_account_source` (`accountId`, `source`, `sourceId`), `by_transaction`, `by_connection_account_state` |
| `bankConnections` | shared columns: `name`, provider-neutral status (`ok` / `needsLogin` / `consentRevoked` / …) with the raw error code kept as display text, `lastSyncedAt`, `syncLeaseUntil`, `consentExpiresAt?`; one tagged `provider` field, today `{ kind: "plaid", itemId, encryptedToken, cursor }` (token via `TokenCipher`) | none |
| `connectionAccounts` | `bankConnectionId`, `externalAccountId` (Plaid `account_id` today), `state` (`mapped` / `held` / `ignored`), `accountId?` | by connection and external ID |
| `monthlyTotals` | derived cache: sum of cents per (`month`, `accountId`, bucket), where bucket is a Category ID, `"uncategorized"`, or `"transfer"`; split lines add to their own Categories | `by_month_account_bucket` |

**How the model carries the rules**

- **Monthly totals are a cache** ([ADR 0002](../../../docs/adr/0002-monthly-totals-cache.md)): the mutation that writes a Transaction updates its rows; a rebuild function recreates them from Transactions, and a test asserts the two agree. The source data stays Transactions and Assigned, as [What are the exact budget rules?](06-budget-rules.md) requires. Category Activity sums a Category's rows; a Payment Category's Activity is that card's categorized rows (the full-amount move) plus its `"transfer"` rows; an Account balance sums its rows.
- **Uncategorized, Ready to Assign, Transfer**: a Transaction with no `categoryId` and `split: false` is Uncategorized unless `transferTransactionId` is set. Ready to Assign is a system Category row, so "categorized to Ready to Assign" is an ordinary `categoryId`. This keeps YNAB's three-way split.
- **Splits**: normal Transactions hold their Category inline; split lines live in `transactionSplits` because Convex can't index inside arrays.
- **Transfers**: two Transactions pointing at each other, no Category, no Transfer table; editing or deleting one side changes the other in the same mutation. The counterpart created by "categorize as Transfer" is an uncleared Transaction a Bank Row can later Match.
- **Bank Rows** hold what the bank reported, apart from what the owner entered: Match links a Bank Row to a Transaction, Unmatch unlinks it, "bank changed/removed this" compares the two, held rows wait for a `connectionAccounts` mapping, and the import-ID skip is `by_account_source`. No raw Plaid payload is stored (about 1.4 KB per row, never read, and better for privacy).
- **Matcher** uses `by_account_amount_date` for "same Account, same amount, within 10 days".
- **Provider independence**: everything Plaid-specific is in the tagged `provider` field, in `connectionAccounts.externalAccountId`, and in Bank Row `source`/`sourceId`. Plaid error codes map to provider-neutral statuses at the edge. Adding SimpleFIN is a union branch plus a service, not a table migration.
- **Sync lock**: `syncLeaseUntil` (about 2 minutes ahead), taken in a mutation, released when done, and expiring by itself if an action crashes.
- **Search**: `searchText` denormalizes Payee name, memo, split memos, and linked Bank Text; it is rewritten on Payee rename and on Match/Unmatch. Date range is applied after search (search filters are equality only).
- **Category management**: integer `position` per sibling list, rewritten on reorder; `hidden` booleans. Deleting a Category moves its Transactions, split lines, and Assigned rows (summing into existing rows) to the chosen Category, rebuilds the affected totals, then hard-deletes it, so every month's Available stays exact. A Category Group's Categories move to a chosen group first.
- **Move money** is one mutation changing two Assigned values; nothing about the move is stored.
- **Starting balances and the reconciliation adjustment** are ordinary Transactions.

**Queries and I/O**

- The budget query takes `today` as an argument (`Date.now()` would defeat Convex's query cache) and subtracts Ready to Assign and Uncategorized inflows dated after `today`, found through `by_category_date`.
- The budget query reads only `categories`, `categoryGroups`, `assignments`, `monthlyTotals`, and `settings`. Bank Connection status is a separate query whose `returns` validator omits `provider`, so sync bookkeeping never re-runs the budget read and tokens never reach the browser.
- The Transaction list is paginated through `by_account_date`, `by_date`, or `by_approved_date` (Unapproved first). Each import batch is one mutation, per [Where does Effect go in Budge?](14-effect-boundaries.md).
- Estimate from the sample capture in [Connect real accounts and capture sample data](08-connect-accounts.md) (about 80 Transactions a month, slim Transaction about 450 B): a budget-screen run reads about 0.5 MB in year 5. At 600 runs a month (two devices), plus Transaction list pages (about 25 MB), writes and sync (about 5 MB), and previews (about 10 MB), the total is about 70 MB a month in year 1 and about 340 MB in year 5, about 3× under the 1 GB free-tier I/O limit. Without the cache, year 5 approaches the limit. Before launch, measure real sizes with `getDocumentSize` on the seed; check dashboard I/O after the first month. If it ever tightens, a yearly Available checkpoint (another rebuildable cache) is a two-way door.

**Seed**

- One internal mutation `seed:run` writes a synthetic budget: 3 Accounts (checking, savings, card), about 12 Categories in 3 groups, 3 months of about 150 made-up Transactions including a split, a Transfer, a card payment, Unapproved and held Bank Rows, some Assigned rows, and a Plaid Sandbox–kind Bank Connection with no token. It ends by calling the `monthlyTotals` rebuild, so every preview exercises it. It refuses to run if any Account exists or if an env flag marks the deployment as production. About 100 KB written per preview.

**Glossary and ADRs**

- `GLOSSARY.md` gains **Bank Row** and **Reconciled**; **Match** and **Bank Text** now refer to the Bank Row.
- [ADR 0002](../../../docs/adr/0002-monthly-totals-cache.md) records monthly totals as a rebuildable cache.

**Effects on other tickets**

- [How often does sync run, and what happens when a Bank Connection breaks?](15-sync-schedule.md): its Plaid fields take the provider-neutral shape above; the Plaid `account_id` lives in `connectionAccounts`, not on the Account.
- [How do synced Transactions arrive?](07-import-flow.md): Bank Text and the bank-changed/removed flags live on the Bank Row, not the Transaction.
