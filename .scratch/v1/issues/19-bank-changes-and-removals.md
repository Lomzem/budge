# 19: Bank changes and removals

**What to build:** When the bank changes or removes a Transaction I haven't touched, Budge applies it quietly. When I've already approved or edited it, Budge keeps my version and flags it "bank changed this" or "bank removed this", so I can accept the bank's version or keep mine.

**Blocked by:** 17 (Plaid sync through Sync now)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 100–101; Sync (bank changes)

- [ ] Plaid `modified` and `removed` entries in a sync batch are handled:
  - **Unapproved and unedited Transaction**: the change is applied to it, or it is deleted.
  - **Otherwise**: the Bank Row's state becomes `changed` (keeping the bank's newest values) or `removed`.
- [ ] Transaction detail and the list show the flag in plain text. Resolving it either applies the bank's values (or deletes the Transaction) or keeps the owner's version, and clears the flag.
- [ ] `monthlyTotals` and `searchText` stay correct through every path.
- [ ] `convex-test`: all four paths (quiet change, quiet removal, flagged change, flagged removal) and both resolutions. The rebuild still equals the incrementally kept rows.
