# Inspector, move money and Cover

Inspect a Category, move Assigned between jobs, and cover Overspending from Ready to Assign.

## Sub-features

- `inspect-open`: keyboard opening/closing on desktop and phone.
- `move-money`: Move to/Take from preserve Ready to Assign.
- `cover`: cover exactly the negative Available.

## How to get to it (user POV)

- Budget table → Category-name button. The Overspent list has no buttons; open the Category in the table, then use Cover in its inspector.
- At 1024 px and up the inspector sits in a sticky side panel that scrolls on its own; opening it focuses the region without scrolling the page. Below that it opens as a dialog whose `Assigned this month` row is an editable amount field (the table hides its Assigned column below 352 px), with an `Other Categories` nav of `Previous Category: <name>` and `Next Category: <name>` buttons (the visible name truncates on one line) that switch the dialog to the neighboring Category, scrolled to the top, and focus its Assigned field. The dialog opens scrolled to the top, with Ready to Assign in view.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/inspector.ts`, also run by `bun run test:e2e:local`):

- `inspector/move-money`: `inspect-open` and `move-money` by keyboard, a side panel that takes no input while the next month loads (sync held by `pausableSync` in `e2e/heldResponse.ts`), and the inspector as a dialog at 320 px that Close and Escape return to the Category and whose `Next Category` steps to the neighbor with its Assigned field focused.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Inspect:** focus `getByRole("button", { name: "Groceries", exact: true })`, press Enter; require `getByRole("region", { name: "Groceries", exact: true })` visible and Left over from last month visible; opening auto-focuses the region only at widths ≥1024 px. Escape from inside the region or Close Groceries must restore focus. Repeat at 320 px: it opens as `getByRole("dialog", { name: "Groceries" })` scrolled to the top, and Close or Escape returns focus to the Category-name button.
- **Move:** record Assigned for Groceries/Coffee and Ready to Assign; in region check `Move to`, `choose` the `To Category` option beginning `Coffee (`, fill Amount 10.00, submit `Move money`. Require Assigned −$10/+ $10 and Ready to Assign unchanged; reload and reopen. Choose Take from / From Category to reverse and verify.
- **Cover:** create an invented outflow large enough to overspend an ordinary Cash Category using Transaction UI; select it on Budget. Click its `Cover $… from Ready to Assign` action (inspect actual amount in ARIA). Require Available exactly zero, Assigned increased by deficit and Ready to Assign decreased by deficit; reload.

## Gotchas

- **Manual drive:** check the Target surface on ordinary Categories (Add/Edit Target, progress and Assign when needed) and `Card payment` on Credit Card Payment Categories.
- **Manual drive:** To Category/From Category include Hidden Categories and exclude the current Category. Zero, negative or invalid Amount shows `Enter an amount above zero, such as 25.00.`; a positive move may make the source Assigned negative while preserving Ready to Assign.

- Cover requires actual negative Available; if fixture has no negative Category create Overspending via UI or report blocked, not passed by opening an inspector.
- Sources: ticket 07; public `budget.moveMoney/cover/month`.
