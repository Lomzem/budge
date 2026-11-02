# 16: Search and filters

**What to build:** On the Transaction list I can search text over Payee, memo, split memos, and Bank Text. I can also filter by Account, Category, Payee, and date range.

**Blocked by:** 11 (Split Transactions), 14 (File import and the matcher)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 68–69; Convex data model (search)

- [x] Transactions gain `searchText`, denormalized from the Payee name, memo, split memos, and linked Bank Text. It is rewritten on every Transaction write, on split edits, on Match and Unmatch, and when a Payee is renamed.
- [x] A search index on `searchText` with filter fields for Account, Category, and Payee. The date range is applied after the search.
- [x] Without search text, the filters use the existing indexes (Account by date, by date, Category by date, by Payee), stay paginated, and never collect the full history.
- [x] The search field and filter controls have visible labels and work down to 320 px.
- [x] `convex-test`: a split memo, a renamed Payee's new name, a memo, and a matched Transaction's Bank Text are each findable, and Bank Text stops matching after Unmatch, and filters narrow the results as expected.

## Comments

- Decided while building: a split has no Category of its own, so a Category filter lists whole Transactions in that Category first, newest first, then the split Transactions with a line in it (`splitLines: true`, through the lines' Category-by-date index). The search index has `split` as a fourth filter field so a search can reach split Transactions and check their lines. A split listed both ways shows once.
- Search, a Category's split lines, and the dates after a search apply to each page, so a page can come back short; "Show more" continues. Filtering inside a search query could scan past the 1,024-row search limit and fail.
- A Payee filter needed a by-Payee index, added as `by_payee_date`. Unapproved first applies only without filters; a filtered list is one list. All Accounts' Account filter scopes "Approve all" and the count like an Account page.
- Nothing renamed a Payee before this ticket, so `payees.rename` (owner-only, no UI yet) renames one and rewrites its Transactions' `searchText` 50 at a time: the first batch in the mutation, the rest scheduled. Another Payee's name is refused, since merging isn't supported.
- `migrations:backfillSearchText` (internal, start with `cursor: null`) fills `searchText` for Transactions written before search, 50 per scheduled mutation. Run it once on each deployment after deploying; it hasn't been run anywhere.
