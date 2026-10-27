# 21: Unknown Plaid Accounts and the suggested starting balance

**What to build:** When Plaid reports an Account Budge doesn't know, its rows are held, and I'm asked to map it to an existing Account, create a new Account, or ignore it. Ignored Accounts are remembered. After mapping, rows already in that Account are matched, so history arriving under new IDs (such as after the Discover migration) isn't duplicated. For a newly mapped synced Account, Budge suggests its starting balance, and I confirm or correct it.

**Blocked by:** 17 (Plaid sync through Sync now)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 12, 91–93; Sync (unknown Plaid Accounts)

- [ ] `NEW_ACCOUNTS_AVAILABLE`, or an unknown external Account ID during sync, creates a `held` connection Account. Its rows are stored as `held` Bank Rows with no Account, and nothing is imported.
- [ ] Map to an existing Account, create a new Cash or Credit Card Account, or ignore. Ignored IDs stay ignored on later syncs.
- [ ] After mapping, the held rows run through the matcher with the file-row rule, so they Match Transactions already imported in that Account.
- [ ] The suggested starting balance is Plaid's current balance minus the Transactions imported since cutover. The owner confirms or edits it, and it is saved as the starting balance Transaction on the cutover date.
- [ ] The UI lists held Accounts with their row counts in plain text, with keyboard-reachable actions.
- [ ] `convex-test`: held rows import nothing. Mapping to an Account with matching history adds no duplicates. An ignored ID stays ignored after another sync.
