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

## #28, the Bank changes list

CodeRabbit raised two more points about the Bank changes list:

- **4542184098:** the scan read up to 1,000 flagged Bank Rows per state, ordered by Transaction id, and then filtered by Account. An Account whose change sat behind 1,000 rows from another Account got an empty page with `isDone: true`. Choosing rows by id before sorting by date could also leave out a newer Transaction.
- **4542184110:** the hand-built keyset pages ignored `maximumRowsRead` and `maximumBytesRead`.

The fix stores the answer on the Transaction instead of scanning:

- A Transaction carries `bankChange: true` while one of its Bank Rows is `changed` or `removed`.
- `refreshDerivedFields` (formerly `refreshSearchText`) keeps the marker, the same way it keeps `searchText`. It already runs after every owned write that touches a Transaction or its Bank Rows, and `updateBankRow` now runs it when a Bank Row's state changes.
- Two indexes, `by_bankChange_date` and `by_account_bankChange_date`, serve the list and the count. The list uses native `paginate`, newest date first. The count reads at most 501 rows of the index.

The test "a bank change in one Account stays reachable behind a thousand in another, and the list runs newest date first" failed on `e5b2838` at both points: the Checking count was 0, and the first row was the older Savings date.

**After deploy:** existing flagged Transactions have no marker. Run the backfill once on each deployment. It was renamed `backfillSearchText` → `backfillDerivedFields`, and it fills both fields:

```sh
npx convex run migrations:backfillDerivedFields '{"cursor": null}' --prod
```

"the backfill lists a bank change flagged before the list read its marker" covers it.

Verification:

- typecheck, lint, lint:ui, format:check and codegen:check pass, and so do all 855 tests.
- Journeys `bank-changes/take-the-banks`, `bank-changes/keep-mine`, `search/filters`, `plaid/attention` and `plaid/status` pass (`test-results/verify-budge/marker`).
- By hand on `bank-sync`: the Budget's `2 bank changes` chip opens `?status=bank-changes`, which reads `2 Transactions the bank changed` and lists both rows, newest first.

## #29, first review: 24 comments

Fixed, with a journey that failed before the fix where one can reach it:

- **278:** a held bank Account the bank gave no type starts with no type chosen. Import as a new Account asks for one (`aria-invalid` type group, focus on Cash). The seed adds an unnamed bank Account with no kind. `accounts/held-unknown-kind`. Follow-up: a bank Account recorded before kinds existed has a name but no kind, so the dialog no longer preselects a same-named Account for an untyped one; mapping it takes the owner's choice. The sync never records a name without a kind, so the `bank-sync` seed patches one held bank Account (Savings ending 6630) to the legacy shape. `accounts/held-legacy-name` failed on the dialog before `20c8b7c`, because Savings was preselected.
- **306:** an Assigned save typed back to the old amount while the first save is pending is saved, and only the latest save clears the pending value. `budget/assign-back`.
- **315:** a refused move marks and focuses the field at fault.
- **322:** a failed settings query shows an error in the cutover slot instead of loading forever.
- **346:** the compact and wide import pickers have distinct IDs. `imports/twin`.
- **371:** a failed Category or Payee lookup keeps the selected filters and says so, instead of dropping them.
- **384:** a failed Undo keeps Undo available.
- **396:** the removal confirmation runs through `DialogSession`, so a delete finishing after its confirmation was dismissed leaves the next one open. The seed adds a second owner-edited removed row (SAMPLE GYM 5521). `bank-changes/late-delete`.
- **409:** an Accounts query error ends the layout's loading state with the server error (or the sign-out screen for `FORBIDDEN`).

Declined, with a reply:

- **286:** mapping into an already-fed Account is a move (same account, newer login); the suggestion says what it's based on and stays editable.
- **296:** the owner reads "transactions"; "Bank Row" stays the code's word.
- **419:** a Budget URL without a month means the month the owner was on, so the Budget link returns to it; `This month` goes back to today.
- **Design (269, 330, 356, 429, 437, 446, 459, 472, 480, 488, 497, 502):** these cite the v1 UI rules, which the Design plan in `spec.md` supersedes. `.coderabbit.yaml` now points the Svelte path instructions at that plan, and the plan names each allowed case: sheets for bounded groups, counts and status words beside their item, rounded `Needs you` links, icon-only controls below md and for "more actions", and a one-sentence sign-in line.

## Remaining

- #28 and #29: incremental reviews of the fixes.
- #30: first review (rate limited at 20:03 UTC).
