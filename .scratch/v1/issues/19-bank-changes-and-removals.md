# 19: Bank changes and removals

**What to build:** When the bank changes or removes a Transaction I haven't touched, Budge applies it quietly. When I've already approved or edited it, Budge keeps my version and flags it "bank changed this" or "bank removed this", so I can accept the bank's version or keep mine.

**Blocked by:** 17 (Plaid sync through Sync now)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 100–101; Sync (bank changes)

- [x] Plaid `modified` and `removed` entries in a sync batch are handled:
  - **Unapproved and unedited Transaction**: the change is applied to it, or it is deleted.
  - **Otherwise**: the Bank Row's state becomes `changed` (keeping the bank's newest values) or `removed`.
- [x] Transaction detail and the list show the flag in plain text. Resolving it either applies the bank's values (or deletes the Transaction) or keeps the owner's version, and clears the flag.
- [ ] `monthlyTotals` and `searchText` stay correct through every path.
- [x] `convex-test`: all four paths (quiet change, quiet removal, flagged change, flagged removal) and both resolutions. The rebuild still equals the incrementally kept rows.

## Comments

- `monthlyTotals` stays correct on every path; each test checks the kept totals equal a rebuild. `searchText` doesn't exist yet (ticket 16 adds it), so that half of the third box is left for ticket 16: a quiet change that names the Payee again, and resolving to the bank's version, must rewrite it.
- "Unedited" means the Bank Row created the Transaction (not a Match), it is the Transaction's only Bank Row, it is Unapproved (editing approves), and it isn't a split, a Transfer, or Reconciled.
- A change to the Bank Text alone updates the Bank Row without a flag; only a new date or amount that differs from the Transaction's flags it.
- Applying the same batch again changes nothing: a modified row already holding the bank's values and a removal of a row already `removed` are no-ops. Keeping your version of a removal unlinks the Bank Row (it stays `removed`), so a replay can't flag it again.
- Taking the bank's amount on a split whose lines add up to the old amount is refused with a message to edit the split first. Unmatching a removed Bank Row is refused; unmatching a changed one gives the new Transaction the bank's values and clears the flag.
- A `modified` row Budge never imported (for example, one dropped as pending before) arrives as a new row through the matcher.
