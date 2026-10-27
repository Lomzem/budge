# 18: Webhook and daily cron

**What to build:** New Transactions arrive on their own. A sync runs when Plaid says updates are available, and a daily backup sync catches anything a lost webhook missed. Repeated or out-of-order webhooks are harmless. A deployment with no token never calls Plaid.

**Blocked by:** 17 (Plaid sync through Sync now)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 80–81, 84, 134; Sync

- [ ] A Convex HTTP action receives Plaid webhooks and verifies Plaid's signed JWT. An unverified request is rejected without side effects. `SYNC_UPDATES_AVAILABLE` schedules the same sync that Sync now uses.
- [ ] A daily Convex cron runs the sync for every Bank Connection.
- [ ] The cron and the webhook return at once for a Bank Connection with no stored token, so seeded previews and local backends make no Plaid call.
- [ ] `convex-test`: an unverified webhook changes nothing. Two identical verified webhooks, or a webhook while a lease is held, apply the batch once. The cron on the seeded (no-token) Bank Connection makes no `PlaidClient` call.
- [ ] Manual check: one Sandbox webhook round-trip on the cloud dev deployment.
