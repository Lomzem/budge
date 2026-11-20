# Categories and Category Groups

Manage Categories and their groups on Budget, including order, visibility and the destination for deleted Categories’ history.

## Sub-features

- `category-create`, `category-rename`, `category-order`: create, rename and move Categories and Groups.
- `category-hide`, `category-delete`: hide and restore rows or delete them with a destination for their history.

## How to get to it (user POV)

- Budget → `Add Category` or `Add Category Group`. Below `sm`, both are in the `Add Category or Group` menu.
- Right-click an ordinary Category row or hold it for about 700 ms on touch. Its context menu offers `Rename`, `Move up`, `Move down`, `Move to group` (submenu), `Hide` and `Delete…`. A plain click on the row or its name selects the Category.
- Right-click an ordinary group row or open its `<group> actions` ⋯ button. The menu offers `Add Category`, `Rename`, `Move up`, `Move down`, `Hide` and `Delete…`. Adding here preselects the group. System groups such as Credit Card Payments lack management menus.
- `Add Category` requires a `Category Group`. Choose `New Category Group…` to enter a required `Group name` and create both together.
- `Rename` opens an inline `Category name` or `Category Group name` textbox. Enter or blur saves. Escape keeps the original name. An empty name submitted with Enter shows `Enter a name.`
- Budget’s `Hidden` section lists hidden groups with their Category names and individually hidden Categories with their Available amounts. Each row offers `Show <name>` to restore it. See [inspector.md](inspector.md) for the inspector’s Category actions.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence. The source is `e2e/journeys/categories.ts`, also run by `bun run test:e2e:local`):

- `categories/manage`: Add Category requires a group, offers a new one and omits Credit Card Payments. The group menu preselects its group. A missing group name keeps focus in that field. A refused Category can be retried in the new group, which survives reload. Right-click opens the Category menu, and Escape after a right-click on a row's empty cell returns focus to that Category's or group's name. Rename rejects an empty name, Escape keeps the old one, and successful Category and group renames persist. Clicking the row selects it. Move up reorders a Category and a group, the first Category’s Move up is disabled, and Move to group places the Category in Everyday. The journey reloads and checks the Category order and destination. Hide puts the Category in Hidden after reload, Show restores it, and Delete removes the Category into Groceries and then deletes its empty group.
- `categories/touch-menu`: at 320 px a touch hold on Groceries opens its menu without selecting the row or overflowing the page. A tap outside a row menu or a group ⋯ menu only closes it; after a group ⋯ menu, focus goes back to its ⋯ button, as it does after a desktop click outside any ⋯ menu. A tap or right-click in an Assigned field edits it with no row menu. At 1280 px a right-click outside a ⋯ menu only closes it, and a click at once after it reaches the row under it.
- `categories/held-rename`: a second Category rename can save while the first response is held. The second name stays visible when the earlier response lands and after reload.
- `categories/failed-rename`: a refused Category rename reopens its field with the attempted name, focus and the description `Budge couldn't rename it. Try again.` Enter retries, focuses the renamed Category and keeps the change after reload.

Preconditions:

- Authenticated baseline from the index. Reseed before independent mutations.

- **Create:** use `Add Category Group`, enter an invented name and click `Add`. Add a Category to it through the group actions menu and verify both after reload.
- **Order:** use `Move down` on a Category and on a group with a row below it. Check the order after reload and require the edge actions to be disabled.
- **Visibility:** use `Hide` on a group and require its rows to leave the table. In `Hidden`, require the group name and its Category names. Use `Show <group>` and verify the restored rows after reload.
- **Delete/history:** give a Category a Transaction, assignment and split line through their mapped UI. Choose `Delete…`, set `Move its history to` to Groceries and click `Delete Category`. After reload, require the source absent and the history in Groceries. For a populated group, choose `Move its Categories to` before `Delete group` and verify the destination’s order after reload.

## Gotchas

- With no eligible history destination, deleting a Category asks for another Category. Deleting a populated group needs another ordinary group. `categories/manage` checks that Delete group for a group with one Category says `Its Category moves to the group you pick, with its history.` and labels the field `Move its Category to`.
- Sources: ticket 06, public `categories.list/createGroup/create/rename/renameGroup/move/moveGroup/setHidden/setGroupHidden/remove/removeGroup`.
