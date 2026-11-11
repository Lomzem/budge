# 23 — CodeRabbit review

Status: in progress

#27 is the PR that merges. CodeRabbit reviews it in three slices that never merge: #28 (Convex, domain and client libraries), #29 (components, routes and styles) and #30 (journeys, lint rules, feature maps and spec). `node_modules/.shots/slices-next.sh` adds each new commit on #27 to the slices as a follow-up commit, so incremental reviews see only the change.

## #28, first review: 11 comments, all fixed

Fixed in `28f8673`:

- `parseCentsSum` refuses a running sum outside the safe integer range.
- A Plaid `loan` account suggests a Credit Card Account.
- Reconnect reports `busy` as a sync already running.
- The Budget side panel, including the Category Inspector, is `inert` while the next month loads.

Fixed in `1304551`:

- **Removal signs out at the bank first.** `remove` always calls Plaid `/item/remove` for a connection that has a bank login, and forgets the connection only after that succeeds. A server without Plaid credentials or a token key refuses with `Bank sync isn't set up on this server, so Budge can't sign out of this bank yet. Set it up, then remove the connection.` and keeps the connection. This departs from the earlier spec, which dropped the connection without signing out. Keeping the bank login would leave an access token alive at the bank that Budge no longer shows.
- **Forgetting covers every bank Account.** `forget` works through the connection's bank Accounts in pages of 50 and reschedules itself until it reaches the end.
- **A late account list for a removed connection writes nothing.**
- **Connect asks for accounts again.** `connectItem` stamps `accountsCheckRequestedAt`, so if the first lookup fails, the next sync asks the bank again.
- **Bank changes count by Account.** The limit applies after the Account filter, with a scan cap per state. The list uses keyset pages that honor `paginationOpts`.
- **A re-imported pair is held back once.** In the matcher, exact repeats and alike rows share one taken set.

Each new test failed before its fix. `plaid/remove` was rewritten for the new removal behavior, and the verify-budge `plaid.md` map was updated to match.

The Docstring Coverage pre-merge note doesn't apply: the repo forbids comments in TS and Svelte.

## #28, replies to the fixes

CodeRabbit accepted the fixes and raised one more point: the Bank list read a connection's first 50 bank Accounts, held rows included, so held rows could push synced or ignored ones off the list. A new `by_connectionId_state` index on `connectionAccounts` lets `bankAccountsOf` read mapped and ignored rows on their own, up to 50 each, the most one bank list holds. The test "shows the bank Accounts a connection syncs or ignores while 50 others wait for setup" failed before the fix.

## Remaining

- #28: an incremental review of `d2b91b7`.
- #29 and #30: first reviews. Both were rate limited at 18:57 UTC.
