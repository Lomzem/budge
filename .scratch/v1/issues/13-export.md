# 13: Export

**What to build:** I can download a full export of my budget, as JSON and as one CSV per table, as a backup and a way out of Convex. The export never includes Bank Connection tokens or the rebuildable monthly totals.

**Blocked by:** 03 (Manual Accounts and Transactions)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 115–116; Convex function surface (export)

- [ ] An owner-only export function returns every source table in the schema. It is driven by the schema's table list, so tables added later are included automatically. It leaves out `monthlyTotals` and the `provider` field of Bank Connections.
- [ ] The browser downloads one JSON file and turns the same data into one CSV per table.
- [ ] `convex-test`: the export covers every schema table except `monthlyTotals`, so adding a table without export coverage fails the test. No exported value contains a `provider` field or token.
- [ ] The export control is reachable from the shell with a visible label.
