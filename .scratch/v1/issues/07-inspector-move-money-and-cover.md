# 07: Inspector, move money, and Cover

**What to build:** Selecting a Category shows its breakdown: left over from last month, Assigned, Activity, and Available. On desktop it appears in the inspector column; on a phone it opens inline under the row. From there I can move money to or from another Category in one action, and Cover an overspent Category from Ready to Assign in one step.

**Blocked by:** 05 (Budget screen)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 33–34, 42, 120; UI (layout)

- [ ] The budget entry point also returns each Category's left-over-from-last-month amount (prior Available).
- [ ] Inspector column at 1024 px and wider. Below that, the same content opens inline under the selected Category row.
- [ ] Move money is one mutation that changes two Assigned values in the viewed month. Nothing about the move itself is stored.
- [ ] "Cover $X from Ready to Assign" on an overspent Category assigns exactly enough to bring its Available back to zero.
- [ ] `convex-test`: moving money leaves Ready to Assign unchanged and shifts both Categories' Available by the amount moved. Cover brings Available to exactly zero and lowers Ready to Assign by the same amount.
- [ ] Keyboard path and visible labels for both actions.
