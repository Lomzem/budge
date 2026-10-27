# 08: Targets and Upcoming

**What to build:** I can give a Category a Monthly Target (refill up to, or set aside, with an optional due day) or a By date Target (optionally repeating every N months). Each Category with a Target shows a thin progress bar and "Funded", "$X more needed", or "Overspent by $X". The inspector offers "Assign $X" for what is still needed, and an Upcoming list shows every Target due in the next 30 days and whether its Category is fully funded.

**Blocked by:** 07 (Inspector, move money, and Cover)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 32, 35–41, 43, 127; Domain module (Target math)

- [ ] Test-first Target math in the domain module:
  - Refill: still needed = max(0, X − (prior Available + Assigned this month)).
  - Set aside: still needed = max(0, X − Assigned this month).
  - By date: still needed = max(0, ⌈(X − prior Available) ÷ months left⌉ − Assigned this month), with months left counted inclusively and rounded up to the cent. The worked example holds: $139 by March 3, viewed in November with nothing saved, is $27.80.
  - A repeating By date Target uses D up to and including D's month, then D + N months, calculated from the first date and the interval.
  - A due day never changes the amount.
- [ ] The Category gains an optional embedded Target (`monthly {amount, mode, dueDay?}` or `byDate {amount, firstDate, everyMonths?}`). Setting, editing, switching mode, and clearing a Target are all supported.
- [ ] Each Category with a Target shows a progress bar under its name, plus status text that serves as the bar's text equivalent.
- [ ] The inspector shows the Target description, progress, status, and "Assign $X".
- [ ] The Upcoming list comes from Targets with a due day in the next 30 days of `today`. It shows Due, Category, Amount, and Funded columns, sits under the inspector on desktop, and follows the table on a phone.
- [ ] `convex-test`: "Assign $X" makes the Target read Funded, and a repeating By date Target rolls to its next date only after its due month ends.
