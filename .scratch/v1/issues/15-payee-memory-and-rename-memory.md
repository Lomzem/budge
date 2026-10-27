# 15: Payee memory and rename memory

**What to build:** When I enter or import a Transaction for a Payee I've used before, its Category is pre-filled with that Payee's last Category. When I rename the Payee on an imported Transaction, Budge remembers the rename for that exact Bank Text, and later imports with the same Bank Text arrive with my Payee name.

**Blocked by:** 14 (File import and the matcher)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 58, 79; Bank sync (Payee and Category for imports)

- [ ] Payees gain `lastCategoryId?`, updated whenever a Transaction with that Payee is categorized.
- [ ] Hand entry pre-fills the Category from Payee memory, and I can change it.
- [ ] A `payeeRenames` table (exact `bankText` → Payee) with a by-Bank-Text index. Renaming the Payee on an imported Transaction writes or updates the entry.
- [ ] Imports resolve the Payee in this order: rename memory, then the Bank Row's merchant name when it has one (Plaid sync fills it in ticket 17; files never do), then Bank Text. The Category comes from Payee memory, or the Transaction arrives Uncategorized.
- [ ] Exact match only: a Bank Text that differs by one character gets no rename.
- [ ] `convex-test`: after renaming one import, a second file with the same Bank Text arrives with the renamed Payee and its last Category. A different Bank Text doesn't.
