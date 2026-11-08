# Categories and Category Groups

Manage the jobs for money, their order and visibility, and the history destination when deleting them.

## Sub-features

- `category-create`, `category-rename`, `category-order`: create and arrange Categories and Groups.
- `category-hide`, `category-delete`: visibility and history-preserving removal.

## How to get to it (user POV)

- Sidebar/phone View menu → Categories, or Budget → `Manage Categories` (`/categories`); Add Category and Add Category Group are also on Budget.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/categories.ts`, also run by `bun run test:e2e:local`):

- `categories/manage`: create a Group and Category, rename, hide, delete into Groceries and delete the empty Group, at 320 px with no page overflow.
- `categories/late-rename`: a rename that finishes after its dialog closed leaves the reopened dialog alone.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** click `Add Category Group`; dialog label `Name` = `Sample Verification Group`, button `Add`. Then `Add Category` (exact), labels `Category Group` and `Name` = `Sample Verification Category`; click `Add`. Require both on Budget after reload. Repeat Budget’s creation entry points.
- **Actions:** focus `getByRole("button", { name: "Sample Verification Category actions", exact: true })`, press Enter, then choose menuitem `Rename`; fill Name and Save. Exercise `Move up`, `Move down`, and group placement options from the current menu; assert visible order after reload. Use the corresponding Group actions menu to rename and reorder the group.
- **Visibility:** choose `Hide from budget` on Category and Group in separate runs; require the hidden indication in Categories and absence from the normal Budget section. Use the menu’s show action to restore and verify after reload.
- **Delete/history:** give the Category an invented Transaction, assignment, and split line first through their mapped UI. Choose `Delete…`, dialog `Delete <name>`, select `Move its history to` = Groceries, then `Delete Category`. Require source absent and each Transaction, split line and budget amount moved to Groceries. Delete a populated Group through its `Delete…` dialog, selecting `Move its Categories to` before `Delete group`; verify the Categories appear in the destination in order. An empty Group requires no destination. capture 320 px state.

## Gotchas

- Exact visibility/menu text varies for hidden versus visible rows; inspect the ARIA snapshot before selecting the inverse action.
- Add Category preselects the first Category Group, which can be Credit Card Payments; select an ordinary Group such as Everyday before adding.
- Credit Card Payment Categories and system Categories have restrictions; do not treat disabled actions as editable ordinary Categories.
- Sources: ticket 06; public `categories.list/createGroup/create/rename/renameGroup/move/moveGroup/setHidden/setGroupHidden/remove/removeGroup`.
