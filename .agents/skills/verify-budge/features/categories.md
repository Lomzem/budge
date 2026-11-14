# Categories and Category Groups

Manage the jobs for money, their order and visibility, and the history destination when deleting them.

## Sub-features

- `category-create`, `category-rename`, `category-order`: create and arrange Categories and Groups.
- `category-hide`, `category-delete`: visibility and history-preserving removal.

## How to get to it (user POV)

- Sidebar or phone tab bar → Categories, or Budget → `Manage Categories` (`/categories`); Add Category and Add Category Group are also on Budget, and every ordinary group header (Budget and Categories) has an `Add Category to <group>` button that opens Add Category with that group chosen.
- Add Category's `Category Group` select ends with `New Category Group…`, which reveals a required `Group name` field; Add then creates the group and the Category together.
- A Category's or group's name on the Categories page is a button: click it (or the actions menu's `Rename`) to edit the name in place (`Category name` / `Category Group name` textbox). Enter or blur saves, Escape keeps the old name, an empty name shows `Enter a name.`.
- Each row starts with a `Move <name>` handle: ArrowUp/ArrowDown/Home/End move it within its group (groups among groups) and keep focus on the handle; dragging it by mouse, pen or touch moves it too. Moving to another group stays in the actions menu's `Move to group`.
- Budget's inspector header also has the name in place (`Category name`) and a `<name> actions` menu with Rename, Move to group, Hide from budget and Delete….

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/categories.ts`, also run by `bun run test:e2e:local`):

- `categories/manage`: Budget’s Add Category offers no Credit Card Payments Group but offers `New Category Group…`; a group's `Add Category to Savings Goals` button preselects it; a Category with a new group in one dialog (an empty Group name keeps it open); open its menu by click (focus on `Rename`, Escape back to the trigger); rename in place (empty refused, Escape keeps the name), rename the group in place, hide, delete into Groceries and delete the empty Group, at 320 px with no page overflow.
- `categories/reorder`: at 320 px ArrowUp and Home move Coffee by its handle (focus stays, the top edge is a no-op), End moves the Savings Goals group last; at 1280 px a mouse drag of Transit's handle puts it first; the order survives a reload and shows on Budget.
- `categories/late-rename`: renaming again while the first in-place rename is held keeps the name typed last when the first save lands, and after a reload.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** click `Add Category Group`; dialog label `Name` = `Sample Verification Group`, button `Add`. Then `Add Category` (exact), labels `Category Group` and `Name` = `Sample Verification Category`; click `Add`. Require both on Budget after reload. Repeat Budget’s creation entry points.
- **Actions:** focus `getByRole("button", { name: "Sample Verification Category actions", exact: true })`, press Enter (any app menu, opened by click or key, focuses its first enabled item), then choose menuitem `Rename`; the name becomes the `Category name` textbox, fill and press Enter. Use the `Move <name>` handle (keys or drag) and the menu's `Move to group` options; assert visible order after reload. Rename the group from its name button and reorder it by its handle. **Manual drive:** a real touch drag on a phone or touch emulation (the journey drags with a mouse).
- **Visibility:** choose `Hide from budget` on Category and Group in separate runs; require the hidden indication in Categories, absence from the normal Budget table, and name/Available in Budget’s Hidden Categories section (manual drive beyond the journey). Use the menu’s show action to restore and verify after reload.
- **Delete/history:** give the Category an invented Transaction, assignment, and split line first through their mapped UI. Choose `Delete…`, dialog `Delete <name>`, select `Move its history to` = Groceries, then `Delete Category`. Require source absent and each Transaction, split line and budget amount moved to Groceries. Delete a populated Group through its `Delete…` dialog, selecting `Move its Categories to` before `Delete group`; verify the Categories appear in the destination in order. An empty Group requires no destination. capture 320 px state.

## Gotchas

- Exact visibility/menu text varies for hidden versus visible rows; inspect the ARIA snapshot before selecting the inverse action.
- Budget’s Add Category offers only ordinary Category Groups, never Credit Card Payments (`categories/manage` checks this). The Categories management page also excludes system Groups and their Categories, including Credit Card Payments.
- **Manual drive:** with no destination Category, Delete shows `Add another Category first, to take over this one's history.` and no submit. A populated Group with no destination Group similarly asks for another Category Group and offers no submit.
- Sources: ticket 06; public `categories.list/createGroup/create/rename/renameGroup/move/moveGroup/setHidden/setGroupHidden/remove/removeGroup`.
