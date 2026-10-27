# 16: Search and filters

**What to build:** On the Transaction list I can search text over Payee, memo, split memos, and Bank Text. I can also filter by Account, Category, Payee, and date range.

**Blocked by:** 11 (Split Transactions), 14 (File import and the matcher)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 68–69; Convex data model (search)

- [ ] Transactions gain `searchText`, denormalized from the Payee name, memo, split memos, and linked Bank Text. It is rewritten on every Transaction write, on split edits, on Match and Unmatch, and when a Payee is renamed.
- [ ] A search index on `searchText` with filter fields for Account, Category, and Payee. The date range is applied after the search.
- [ ] Without search text, the filters use the existing indexes (Account by date, by date, Category by date, by Payee), stay paginated, and never collect the full history.
- [ ] The search field and filter controls have visible labels and work down to 320 px.
- [ ] `convex-test`: a split memo, a renamed Payee's new name, a memo, and a matched Transaction's Bank Text are each findable, and Bank Text stops matching after Unmatch, and filters narrow the results as expected.
