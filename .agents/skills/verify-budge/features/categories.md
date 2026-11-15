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

- `categories/manage`: Budget’s Add Category offers no Credit Card Payments Group but offers `New Category Group…`; a group's `Add Category to Savings Goals` button preselects it; a Category with a new group in one dialog (a named Category with an empty Group name keeps it open and focuses Group name); when the group is made but the server refuses the Category, the dialog keeps that group selected and a retry adds the Category to it (one group after a reload); a submission held at the server keeps the names it was sent with, not text typed afterwards; open its menu by click (focus on `Rename`, Escape back to the trigger); rename in place (empty refused, Escape keeps the name), rename the group in place, hide, delete into Groceries and delete the empty Group, at 320 px with no page overflow.
- `categories/reorder`: at 320 px two ArrowUp presses on Coffee's handle while the first save is unanswered (`holdResponseTo` in `e2e/heldResponse.ts`) move it twice at once and both saves last through a reload; End and Home move Coffee by its handle (focus stays, the top edge is a no-op), End moves the Savings Goals group last; a real (CDP) touch drag the browser cancels (`touchCancel`) and a mouse drag ended by Escape each move nothing and put the row back in place; a second finger tapping the dragged handle and lifting does not end the first finger's drag, which then drops Coffee two rows down; a touch drag of the first group's handle to the bottom edge scrolls the page and drops it last (edge scrolling starts only once the pointer moves toward that edge); at 1280 px a mouse drag of Transit's handle puts it first; the order survives a reload and shows on Budget. Not in the journey: the dragging pointer's own `lostpointercapture` and leaving the page mid-drag (one-off probes, not retained; see ticket 03 Integration and Final review repairs), and a phone's native gesture cancel.
- `categories/late-rename`: a held in-place rename landing while a second name is being typed (not yet submitted) keeps that draft and focus; renaming again keeps the name typed last when the first save lands, and after a reload.
- `categories/failed-rename`: at 320 px, with the first `categories:rename` and `categories:renameGroup` calls failed at the Convex WebSocket (a server error, nothing saved): a failed group rename with no other name open reopens with the failed name and `Budge couldn't rename it. Try again.`; a Category save failing while another Category's name is being typed leaves that draft and focus alone and shows the failure beside the failed Category's own name; opening that name again offers the failed name to retry, which saves; a reload keeps the saved names and the group's old one.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** click `Add Category Group`; dialog label `Name` = `Sample Verification Group`, button `Add`. Then `Add Category` (exact), labels `Category Group` and `Name` = `Sample Verification Category`; click `Add`. Require both on Budget after reload. Repeat Budget’s creation entry points.
- **Actions:** focus `getByRole("button", { name: "Sample Verification Category actions", exact: true })`, press Enter (any app menu, opened by click or key, focuses its first enabled item), then choose menuitem `Rename`; the name becomes the `Category name` textbox, fill and press Enter. Use the `Move <name>` handle (keys or drag) and the menu's `Move to group` options; assert visible order after reload. Rename the group from its name button and reorder it by its handle. **Manual drive:** `categories/reorder` drags with a real (CDP) touch; a phone check is still worthwhile for feel.
- **Visibility:** choose `Hide from budget` on Category and Group in separate runs; require the hidden indication in Categories, absence from the normal Budget table, and name/Available in Budget’s Hidden Categories section (manual drive beyond the journey). Use the menu’s show action to restore and verify after reload.
- **Delete/history:** give the Category an invented Transaction, assignment, and split line first through their mapped UI. Choose `Delete…`, dialog `Delete <name>`, select `Move its history to` = Groceries, then `Delete Category`. Require source absent and each Transaction, split line and budget amount moved to Groceries. Delete a populated Group through its `Delete…` dialog, selecting `Move its Categories to` before `Delete group`; verify the Categories appear in the destination in order. An empty Group requires no destination. capture 320 px state.

## Gotchas

- Exact visibility/menu text varies for hidden versus visible rows; inspect the ARIA snapshot before selecting the inverse action.
- Budget’s Add Category offers only ordinary Category Groups, never Credit Card Payments (`categories/manage` checks this). The Categories management page also excludes system Groups and their Categories, including Credit Card Payments.
- **Manual drive:** with no destination Category, Delete shows `Add another Category first, to take over this one's history.` and no submit. A populated Group with no destination Group similarly asks for another Category Group and offers no submit.
- Sources: ticket 06; public `categories.list/createGroup/create/rename/renameGroup/move/moveGroup/setHidden/setGroupHidden/remove/removeGroup`.
