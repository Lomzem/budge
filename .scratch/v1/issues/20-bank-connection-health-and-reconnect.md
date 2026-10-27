# 20: Bank Connection health and Reconnect

**What to build:** When my Bank Connection needs me, a plain-text notice at the top of the budget screen says "Capital One needs you to reconnect", with a Reconnect button. Reconnect opens Plaid Link in update mode on the existing Item and syncs right after. Short-lived errors retry quietly. If 48 hours pass without a successful sync, the sidebar line warns "Not synced since …". From 14 days before consent ends, it reads "Consent ends …, renew".

**Blocked by:** 17 (Plaid sync through Sync now)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 86–90; Sync (status, freshness, consent)

- [ ] Plaid error codes map to provider-neutral statuses at the edge, with the raw code kept as display text. `ITEM_LOGIN_REQUIRED`, revoked consent, and `PENDING_DISCONNECT` set the status to needing attention and pause sync. Short-lived errors retry with backoff through the Convex scheduler and leave the status OK.
- [ ] `consentExpiresAt` is stored from Plaid. The sidebar shows the renewal line from 14 days before it.
- [ ] The 48-hour warning is computed from `lastSyncedAt` against a `today`/now argument passed to the query, never `Date.now()` inside it.
- [ ] Reconnect gets an update-mode link token for the existing Item, opens Plaid Link, and runs a sync after success. It never creates or deletes an Item. Public errors use `BANK_CONNECTION_NEEDS_LOGIN` and `BANK_UNAVAILABLE`.
- [ ] The reconnect notice sits above the budget table. Notices are plain text, with no badges, email, or push.
- [ ] `@effect/vitest`: each error class maps to its status. `convex-test`: a needs-login error pauses sync and the status query reports it; a successful sync after Reconnect clears it.
- [ ] Manual check: update mode in Plaid Sandbox on the cloud dev deployment.
