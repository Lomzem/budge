# What does the data model look like in Convex?

Type: grilling
Status: open
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
