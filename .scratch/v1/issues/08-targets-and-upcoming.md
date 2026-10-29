# 08: Targets and Upcoming

**What to build:** I can give a Category a Monthly Target (refill up to, or set aside, with an optional due day) or a By date Target (optionally repeating every N months). Each Category with a Target shows a thin progress bar and "Funded", "$X more needed", or "Overspent by $X". The inspector offers "Assign $X" for what is still needed, and an Upcoming list shows every Target due in the next 30 days and whether its Category is fully funded.

**Blocked by:** 07 (Inspector, move money, and Cover)

**Status:** done

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 32, 35–41, 43, 127; Domain module (Target math)

- [x] Test-first Target math in the domain module:
  - Refill: still needed = max(0, X − (prior Available + Assigned this month)).
  - Set aside: still needed = max(0, X − Assigned this month).
  - By date: still needed = max(0, ⌈(X − prior Available) ÷ months left⌉ − Assigned this month), with months left counted inclusively and rounded up to the cent. The worked example holds: $139 by March 3, viewed in November with nothing saved, is $27.80.
  - A repeating By date Target uses D up to and including D's month, then D + N months, calculated from the first date and the interval.
  - A due day never changes the amount.
- [x] The Category gains an optional embedded Target (`monthly {amount, mode, dueDay?}` or `byDate {amount, firstDate, everyMonths?}`). Setting, editing, switching mode, and clearing a Target are all supported.
- [x] Each Category with a Target shows a progress bar under its name, plus status text that serves as the bar's text equivalent.
- [x] The inspector shows the Target description, progress, status, and "Assign $X".
- [x] The Upcoming list comes from Targets with a due day in the next 30 days of `today`. It shows Due, Category, Amount, and Funded columns, sits under the inspector on desktop, and follows the table on a phone.
- [x] `convex-test`: "Assign $X" makes the Target read Funded, and a repeating By date Target rolls to its next date only after its due month ends.

## Comments

- Implemented on branch `08-targets-and-upcoming`.
- Decisions:
  - The domain `Target` type matches the stored shape exactly: `monthly {amount, mode, dueDay?}` or `byDate {amount, firstDate, everyMonths?}`. `computeBudget` returns `target: {definition, needed, progress, dueDate} | null` per Category, and `upcoming: {id, name, dueDate, amount, funded}[]`. It memoizes per-month sums so it can judge each Upcoming row in its due month.
  - Status: overspent if Available < 0. Otherwise, with a Target, underfunded if needed > 0, else funded. Without a Target, funded if Available > 0, else empty. Progress = funded ÷ goal, clamped to 0–1.
  - A repeating By date Target's due date is firstDate + ⌈monthsBehind ÷ N⌉·N months, with the day clamped to the month's last day.
  - Upcoming lists each Target's next due date that falls in [today, today + 30 days), one row per Target, sorted by date. A Row is Funded when the due month's needed is 0 and Available ≥ 0. Hidden Categories are included, because story 43 asks for "every Target due in the next 30 days". The page shows Upcoming even when every Category is hidden.
  - `categories:setTarget(categoryId, target | null)` validates through `requireTarget`: amount > 0, due day 1–31, an ISO date, and a repeat interval of 1–120 months. The 120 cap is a sanity bound like `MAX_CENTS`. The domain module owns it (`isRepeatInterval`), and the dialog and the server share it. Ready to Assign is refused.
  - `budget:assignTarget(month, categoryId)` adds the server-computed `needed` to Assigned and returns it. It is deliberately not capped at Ready to Assign, which "may go negative" with a warning (story 23).
  - The status text moved from under Available to under the Category name, beside the bar, and it is the bar's `aria-valuetext`. On wide screens the aside is always rendered, holding the inspector when a Category is selected and then Upcoming.
  - The shadcn Progress component was added, with `value` defaulting to `null` and props typed separately so svelte-check passes.
- Verification: `bun run typecheck`, `lint`, `lint:ui`, `format:check`, `bun run test` (168), and `bun run build` pass. The new `e2e/targets.test.ts` passes in CI. It adds a Target, uses "Assign $25.00", checks Upcoming at 320 px, and restores the seeded budget in a `finally` block after a pending Assign settles.
- Review (GPT-6.1-Sol, standards and spec): included hidden Categories in Upcoming and shared the repeat-interval rule. The 120-month cap was kept.
- CodeRabbit:
  - It requested e2e cleanup hardening (`finally`, waiting for a pending Assign, an atomic button-state check), and all three were fixed.
  - Of its two outside-diff comments, "Upcoming when every Category is hidden" was fixed, and "cap Assign $X at Ready to Assign" was declined per the spec.
- Shipped in https://github.com/Lomzem/budge/pull/7, squash-merged to `main` as d536658.
  - CodeRabbit approved head 29abffb.
  - The final head, 0f6443b, adds three lines to `+page.svelte` that show Upcoming when every Category is hidden. CodeRabbit did not review it because of its rate limit, and the owner waived that final review. All six checks passed on 0f6443b.
