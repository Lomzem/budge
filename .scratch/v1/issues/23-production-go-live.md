# 23: Production go-live

**What to build:** My real Capital One Bank Connection syncs into production Budge, and I use it daily from my laptop and my iPhone Home Screen. The owner does this work. The agent prepares the steps as a `wizard` script that never prints or stores secrets in the repo.

**Blocked by:** 04 (Production and preview deployments), 18 (Webhook and daily cron), 19 (Bank changes and removals), 20 (Bank Connection health and Reconnect), 21 (Unknown Plaid Accounts and the suggested starting balance)

**Status:** ready-for-human

**Spec:** [Budge v1](../../v1-spec/spec.md): Manual checks before launch; Further Notes

- [ ] Set the cutover date in production. Run the setup action with the existing Capital One access token and Item ID from the private location. Confirm the Item's webhook now points at production Budge. No new Plaid Item is created, and no paid Production application is submitted.
- [ ] Map the checking, savings, and Discover Credit Card Accounts. Confirm each suggested starting balance. Sync, and check that pending and pre-cutover rows are absent.
- [ ] Real-iPhone checks against `budge.lomzem.dev`:
  - Add to Home Screen opens standalone.
  - GitHub and email sign-in work inside the Home Screen app.
  - Live data shows after the app returns from the background.
  - Re-sign-in works after the 7-day session ends.
  - Safe areas and the status bar look right in dark and light themes.
- [ ] Measure real document sizes with `getDocumentSize` and confirm the database I/O estimate. Check Convex team usage after the first month, and record the results on this ticket. If I/O tightens, open a ticket for a yearly Available checkpoint cache.
- [ ] No private material (tokens, captures, real merchants, or balances) enters the repo, tickets, or PRs.
