# Targets and Upcoming

Set Monthly or By date Targets, fund the missing amount, and see the upcoming obligations.

## Sub-features

- `target-monthly`: refill versus set aside, optional due day.
- `target-date`: dated goal with optional repeat and edit/remove.
- `target-assign`, `target-upcoming`: progress, funding and next-30-days list.

## How to get to it (user POV)

- Budget → Category inspector → Add Target or Edit Target; Upcoming below inspector/table.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/targets.ts`, also run by `bun run test:e2e:local`):

- `targets/monthly`: the Monthly recipe through Funded and Upcoming (`target-monthly`, `target-assign`, `target-upcoming`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Monthly:** open Emergency Fund inspector, click Add Target; dialog label Amount = current Assigned plus 25 dollars. Check `Set aside the amount`, select `Due day` matching today, Save. Require progressbar `Emergency Fund Target` aria-valuetext `$25.00 more needed` and Upcoming row not funded. Click `Assign $25.00`; require Funded, Assigned +25, Ready to Assign −25 and Upcoming Yes after reload.
- **Modes:** Edit Target, choose Refill up to the amount with known prior Available; require needed = max(0, target − prior Available − Assigned). Switch to By date, fill Available by and Repeat/Every how many months; require inclusive-month rounded-up funding and next due date after its month. Navigate months through the ordinary Budget controls to check rollover, not an internal clock setter.
- **Remove/mobile:** Edit Target → Remove Target; require No Target yet after reload, unchanged Assigned. Check Upcoming at 320 px, and a hidden Category Target still appears when due within 30 days. Restore assignments via UI.

## Gotchas

- Due day changes scheduling, not amount. Month-end due dates clamp; repeat interval is 1–120 months.
- Sources: ticket 08; public `categories.setTarget`, `budget.assignTarget/month`.
