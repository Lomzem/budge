# 17: Plaid sync through Sync now

**What to build:** Pressing Sync now pulls new Transactions from my Bank Connection into the right Accounts, through the same matcher as file import. Each Bank Connection shows "Synced 2 hours ago" in the sidebar, and opening it shows the exact time and any error. On non-production deployments this runs against Plaid Sandbox, and automated tests never reach Plaid at all.

**Blocked by:** 14 (File import and the matcher), 15 (Payee memory and rename memory)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 5–6, 72, 76, 78, 82–85, 129–130; Sync; Effect conventions

- [x] A `PlaidClient` service on `effect/http` `FetchHttpClient`, with live and test layers and tagged errors `PlaidTransport`, `PlaidTimeout`, `PlaidDecode`, and `PlaidApi` (which carries `error_code`, `status`, and `request_id`). At most three attempts, 10 seconds per attempt, 35 seconds in total. Effect Schema decodes `/transactions/sync` responses, dropping pending and pre-cutover rows.
- [x] A `TokenCipher` service for AES-GCM with its key from `BUDGE_TOKEN_KEY`, with live and test layers. Only ciphertext is stored.
- [x] A `bankConnections` table (name, provider-neutral status, `lastSyncedAt`, `syncLeaseUntil`, `consentExpiresAt?`, and a tagged `provider` field `{ kind: "plaid", itemId, encryptedToken, cursor }`), and a `connectionAccounts` table mapping external Account IDs to Accounts.
- [x] An owner-only internal setup action takes an access token and an Item ID. It encrypts the token, creates the Bank Connection, and points the Item's webhook at Budge with `/item/webhook/update`. It never creates or deletes a Plaid Item.
- [x] Sync takes `syncLeaseUntil` in a mutation (about 2 minutes ahead) and ignores the request if a lease is held. It fetches and decodes in the action, then one internal mutation applies the Bank Rows, Transactions, `monthlyTotals`, and cursor together. Payee is the merchant name when present, otherwise Bank Text, through ticket 15's resolution order.
- [x] Sync now runs a sync and calls `/transactions/refresh`.
- [x] The Bank Connection status query's `returns` validator omits `provider`. Logs and errors never carry tokens, request bodies, or raw bank responses.
- [x] Sidebar: one "Synced …" line per Bank Connection, showing the exact time and last error on open.
- [x] `@effect/vitest` with `PlaidClient`/`TokenCipher` test layers and TestClock: the retry and timeout limits, and the token round-trip. `convex-test` with the test layers: one sync applies a batch; repeating the same batch adds nothing; a held lease makes Sync now a no-op; the status query never returns `provider`.
- [ ] Manual check: one Sync now against Plaid Sandbox on the cloud dev deployment. Its usage is checked afterwards.
- [x] The seed gains a Sandbox-kind Bank Connection with no token.

## Comments

- The manual Sandbox check is still open. The implementing agent may not deploy to a Convex cloud deployment or call Plaid.
- Batch bound: one apply mutation takes at most 3 pages of 100 rows (`MAX_SYNC_ROWS` = 300). At about six index reads per row, that stays well inside Convex's 4,096 reads per mutation. A sync applies at most 4 batches and then releases the lease at a committed cursor; the next sync continues from there.
- Lease: `syncLeaseUntil` doubles as the lease's identity. Each apply checks that both the lease and the cursor are still the sync's, otherwise it writes nothing and the sync stops quietly. Each batch extends the lease, and the last batch, or a failure, releases it. A crashed sync's lease simply expires after 2 minutes.
- `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` restarts the uncommitted batch from its committed cursor, up to 2 times.
- Rows from a bank Account not yet mapped create a `held` connectionAccount and are skipped. Because a re-sync skips rows by transaction ID, ticket 21 can recover them by resetting the cursor.
- An "ask" decision (several candidates) from sync becomes a new Unapproved Transaction rather than a guessed Match.
- Plaid's `modified` and `removed` rows are left for ticket 19.
- The seed's connection uses a `sandbox` provider kind with no token, so Sync now reports it never syncs.
