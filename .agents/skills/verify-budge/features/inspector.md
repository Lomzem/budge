# Inspector, move money and Cover

Inspect a Category, move Assigned between jobs, and cover Overspending from Ready to Assign.

## Sub-features

- `inspect-open`: keyboard opening/closing on desktop and phone.
- `move-money`: Move to/Take from preserve Ready to Assign.
- `cover`: cover exactly the negative Available.

## How to get to it (user POV)

- Budget → Category-name button; Overspending section → Category or Cover action when offered.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/inspector.ts`, also run by `bun run test:e2e:local`):

- `inspector/move-money`: `inspect-open` and `move-money` by keyboard, and the inspector under its row at 320 px.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Inspect:** focus `getByRole("button", { name: "Groceries", exact: true })`, press Enter; require `getByRole("region", { name: "Groceries", exact: true })` focused and Left over from last month visible. Escape/Close Groceries must restore focus. Repeat at 320 px, region must be inside the selected row.
- **Move:** record Assigned for Groceries/Coffee and Ready to Assign; in region check `Move to`, select `To Category` option beginning Coffee, fill Amount 10.00, submit `Move money`. Require Assigned −$10/+ $10 and Ready to Assign unchanged; reload and reopen. Choose Take from / From Category to reverse and verify.
- **Cover:** create an invented outflow large enough to overspend an ordinary Cash Category using Transaction UI; select it on Budget. Click its `Cover $… from Ready to Assign` action (inspect actual amount in ARIA). Require Available exactly zero, Assigned increased by deficit and Ready to Assign decreased by deficit; reload.

## Gotchas

- Cover requires actual negative Available; if fixture has no negative Category create Overspending via UI or report blocked, not passed by opening an inspector.
- Sources: ticket 07; public `budget.moveMoney/cover/month`.
