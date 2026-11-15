# Inspector, move money and Cover

Inspect a Category, move Assigned between jobs, and cover Overspending from Ready to Assign.

## Sub-features

- `inspect-open`: keyboard opening/closing on desktop and phone.
- `move-money`: an explicit From/To form (this Category on one side, a searchable Category picker on the other, a `Swap From and To` button) that preserves Ready to Assign. Once anything is chosen, typed or refused, a `Clear` button empties the form and focuses the picker, and Escape inside the form clears it instead of closing the inspector; a clean form's Escape closes as before. A done move is announced politely (`Moved $10.00 from Groceries to Coffee.`).
- `cover`: cover exactly the negative Available from Ready to Assign, or `Cover from another Category`, which fills the shortfall into the move form with this Category as To. A done cover is announced politely (`Covered $88.29 for Dining Out from Ready to Assign.`).
- `inspect-manage`: rename the Category in place from the header, and its `<name> actions` menu (Rename, Move to group, Hide from budget, Delete…).

## How to get to it (user POV)

- Budget table → Category-name button. The Overspent list has no buttons; open the Category in the table, then use Cover in its inspector.
- At 1024 px and up the inspector sits in a sticky side panel that scrolls on its own; opening it focuses the region without scrolling the page. Below that it opens as a dialog whose `Assigned this month` row is an editable amount field (the table keeps its Assigned field too, even at 320 px), with an `Other Categories` nav of `Previous Category: <name>` and `Next Category: <name>` buttons (the visible name truncates on one line) that switch the dialog to the neighboring Category, scrolled to the top, and focus its Assigned field. The dialog opens scrolled to the top, with Ready to Assign in view.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/inspector.ts`, also run by `bun run test:e2e:local`):

- `inspector/move-money`: `inspect-open` and `move-money` by keyboard, a side panel that takes no input while the next month loads (sync held by `pausableSync` in `e2e/heldResponse.ts`), and the inspector as a dialog at 320 px that Close and Escape return to the Category and whose `Next Category` steps to the neighbor with its Assigned field focused. The move form starts with this Category as To; `Swap From and To` flips it, typing `cof` in the picker leaves one option, a move is announced in the inspector's status, an empty Amount is refused, and Escape then `Clear` each empty a started move without closing the inspector.
- `inspector/cover-and-manage`: at 1280 px cover the first overspent Category from the Category with the most Available (the Amount is prefilled with exactly the shortfall; afterwards its Available is $0.00 and the donor's falls by exactly the shortfall), leaving Ready to Assign unchanged after a reload, and the move announced; then `Cover $X from Ready to Assign` on the next overspent Category leaves its Available $0.00, lowers Ready to Assign by exactly X and announces it; rename Groceries in place, move it to a collapsed Savings Goals (the group opens to show it and focus stays on its actions), hide it (focus goes to the main region and it lists under Hidden Categories), and delete Dining Out into Coffee (Coffee's Activity gains Dining Out's after a reload), all from the inspector.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Inspect:** focus `getByRole("button", { name: "Groceries", exact: true })`, press Enter; require `getByRole("region", { name: "Groceries", exact: true })` visible and Left over from last month visible; opening auto-focuses the region only at widths ≥1024 px. Escape from inside the region or Close Groceries must restore focus. Repeat at 320 px: it opens as `getByRole("dialog", { name: "Groceries" })` scrolled to the top, and Close or Escape returns focus to the Category-name button.
- **Move:** record Assigned for Groceries/Coffee and Ready to Assign; in region click `Swap From and To` so Groceries is From, open the `To` picker, type `Coffee` and choose it (focus moves to Amount), fill Amount 10.00, submit `Move money`. Require Assigned −$10/+ $10 and Ready to Assign unchanged; reload and reopen. Swap back to reverse and verify.
- **Cover (journeyed in `inspector/cover-and-manage`; repeat by hand only for a Cash Category):** create an invented outflow large enough to overspend an ordinary Cash Category using Transaction UI; select it on Budget. Click its `Cover $… from Ready to Assign` action (inspect actual amount in ARIA). Require Available exactly zero, Assigned increased by deficit and Ready to Assign decreased by deficit; reload.

## Gotchas

- **Manual drive:** check the Target surface on ordinary Categories (Add/Edit Target, progress and Assign when needed) and `Card payment` on Credit Card Payment Categories.
- Hiding, moving to a collapsed group, or deleting the open Category from its inspector closes the inspector and puts focus on the main region.
- **Manual drive:** the From/To picker includes Hidden Categories and exclude the current Category. Zero, negative or invalid Amount shows `Enter an amount above zero, such as 25.00.`; a positive move may make the source Assigned negative while preserving Ready to Assign.

- Cover requires actual negative Available; if fixture has no negative Category create Overspending via UI or report blocked, not passed by opening an inspector.
- Sources: ticket 07, ux-efficiency ticket 01; public `budget.moveMoney/cover/month`, `categories.list/rename/move/setHidden/remove`.
