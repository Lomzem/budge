# 17: Plaid sync through Sync now

**What to build:** Pressing Sync now pulls new Transactions from my Bank Connection into the right Accounts, through the same matcher as file import. Each Bank Connection shows "Synced 2 hours ago" in the sidebar, and opening it shows the exact time and any error. On non-production deployments this runs against Plaid Sandbox, and automated tests never reach Plaid at all.

**Blocked by:** 14 (File import and the matcher), 15 (Payee memory and rename memory)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 5–6, 72, 76, 78, 82–85, 129–130; Sync; Effect conventions

- [ ] A `PlaidClient` service on `effect/http` `FetchHttpClient`, with live and test layers and tagged errors `PlaidTransport`, `PlaidTimeout`, `PlaidDecode`, and `PlaidApi` (which carries `error_code`, `status`, and `request_id`). At most three attempts, 10 seconds per attempt, 35 seconds in total. Effect Schema decodes `/transactions/sync` responses, dropping pending and pre-cutover rows.
- [ ] A `TokenCipher` service for AES-GCM with its key from `BUDGE_TOKEN_KEY`, with live and test layers. Only ciphertext is stored.
- [ ] A `bankConnections` table (name, provider-neutral status, `lastSyncedAt`, `syncLeaseUntil`, `consentExpiresAt?`, and a tagged `provider` field `{ kind: "plaid", itemId, encryptedToken, cursor }`), and a `connectionAccounts` table mapping external Account IDs to Accounts.
- [ ] An owner-only internal setup action takes an access token and an Item ID. It encrypts the token, creates the Bank Connection, and points the Item's webhook at Budge with `/item/webhook/update`. It never creates or deletes a Plaid Item.
- [ ] Sync takes `syncLeaseUntil` in a mutation (about 2 minutes ahead) and ignores the request if a lease is held. It fetches and decodes in the action, then one internal mutation applies the Bank Rows, Transactions, `monthlyTotals`, and cursor together. Payee is the merchant name when present, otherwise Bank Text, through ticket 15's resolution order.
- [ ] Sync now runs a sync and calls `/transactions/refresh`.
- [ ] The Bank Connection status query's `returns` validator omits `provider`. Logs and errors never carry tokens, request bodies, or raw bank responses.
- [ ] Sidebar: one "Synced …" line per Bank Connection, showing the exact time and last error on open.
- [ ] `@effect/vitest` with `PlaidClient`/`TokenCipher` test layers and TestClock: the retry and timeout limits, and the token round-trip. `convex-test` with the test layers: one sync applies a batch; repeating the same batch adds nothing; a held lease makes Sync now a no-op; the status query never returns `provider`.
- [ ] Manual check: one Sync now against Plaid Sandbox on the cloud dev deployment. Its usage is checked afterwards.
- [ ] The seed gains a Sandbox-kind Bank Connection with no token.
