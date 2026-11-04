# Accounts, held Accounts and starting balances

Create Cash and Credit Card Accounts, arrange them, and decide where an unknown synced bank Account's rows go.

## Sub-features

- `account-create`, `account-start`: Cash/Card creation and cutover starting Transaction.
- `account-start-action`: Account actions → Starting balance shows the current amount and replaces it.
- `account-start-edit`: editing a Starting Balance offers only Date, Category, Direction, Amount and Memo.
- `account-rename`, `account-order`, `account-missing`: names, group order and invalid route.
- `account-held`, `account-suggested`: map/create/ignore held bank Accounts and confirm the Starting Balance step.

## How to get to it (user POV)

- Desktop sidebar `Add Account`; phone View menu → Add Account.
- Named Account page → `<name> actions` → Rename, Move up, Move down.
- Sidebar `New bank Accounts` region → `<name> ending <mask>, from <connection>: <n> rows waiting` → dialog `<name> ending <mask>` → radio `Into <Account>` / `Into a new Account` / `Nowhere: ignore this bank Account` → `Bring in its rows` or `Ignore` → dialog `Starting balance` → `Confirm`, `Skip` or `Suggest again`.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** establish cutover via Settings, then click `Add Account`; dialog `Add Account`, label Name = `Sample Verification Cash`, select `Cash, such as checking or savings`, fill `Current balance` with `123.45`, submit scoped `Add Account`. Require sidebar under Cash, balance $123.45, and a Cleared Starting Balance Transaction on cutover date. Budget Ready to Assign must increase by $123.45. Reload and repeat mobile creation. For exact card balance label inspect the dialog (`Amount owed` for cards); create a card with invented debt and verify Credit grouping and linked Payment Category without changing Ready to Assign.
- **Starting balance action:** seed `budget-with-accounts`, open Checking, button `Checking actions`, menuitem `Starting balance`; dialog heading `Starting balance for Checking` shows `Now $…` (test id `current-starting-balance`). Fill label `Starting balance` with the current amount plus $100.00, `Confirm`. Require the dialog closed, the sidebar and `account-balance` up by $100.00, and reopening shows the new amount. `Cancel` changes nothing; a card Account labels the field `Amount owed on the cutover date`.
- **Starting Balance edit:** seed `budget-with-accounts`, open Checking, click button `/^Starting Balance/`; dialog `Edit Transaction`. Require labels Account and Payee disabled (Payee value `Starting Balance`), the hint `A starting balance stays in its Account, with no Payee and one Category.`, label `Category` (exact) listing `Groceries` but no `Split across Categories` and no `Transfer:` options. Change Memo, Save, reload, reopen: require the Memo saved and the Account balance unchanged. Capture 1280 and 320 widths.
- **Rename/order:** open created Account, button `<name> actions`, menuitem Rename, dialog label Name, Save. Require heading and both navigation menus retain name after reload. Exercise Move up/down within its Cash or Credit group and verify order; group-edge actions are disabled.
- **Missing route:** navigate `/accounts/not-an-account`; require the app’s missing/invalid Account handling and no leaked data, record actual behavior.
- **Held (`bank-sync` seed):** run `bun run app seed bank-sync`. Readiness: the `region` named `New bank Accounts` lists Sample Savings Plus ending 4417 (2 rows), Sample Rewards Card ending 9021 (2 rows) and Sample Holiday Club ending 1180 (1 row), all from Sample Credit Union. Held rows change no balance; capture Savings' balance first. Reseed before each of the three journeys.
  - **Map into an existing Account:** open Sample Savings Plus, check radio `Into Savings`, click `Bring in its rows`. In dialog `Starting balance` wait for `Suggest again` to be enabled (the suggestion fails with `Couldn't reach the bank; try again later.`, since the seed's token never decrypts), fill `Starting balance` = `1,000.00`, click `Confirm`. Require the held entry gone; on Savings require rows SAMPLE INTEREST PAID and SAMPLE TRANSFER IN 5512 and the Starting Balance row at $1,000.00. Reload.
  - **Create a card Account:** open Sample Rewards Card, check `Into a new Account`; Name is prefilled `Sample Rewards Card`; set it to an invented name, check `Credit card`, `Bring in its rows`. Fill `Amount owed on the cutover date` = `100.00`, `Confirm`. Require the Account under Credit with SAMPLE BISTRO 0817 and SAMPLE BOOK NOOK 3306 and balance −(100.00 + 36.29 + 21.08) = −$157.37, a Payment Category on the Budget, and Ready to Assign unchanged.
  - **Ignore:** open Sample Holiday Club, check `Nowhere: ignore this bank Account`; require `Its rows are dropped, and Budge won't ask about it again.`; click `Ignore`. Require the entry gone after reload while the other two remain, and no Account created.
  - **Skip:** `Skip` closes the Starting balance step and leaves any existing Starting Balance as it was; the mapping stays.
- **Held at 320 px (not reachable):** the `New bank Accounts` region renders only in the desktop sidebar (1024 px and up). The phone View menu lists Budget, All Accounts, Categories, each Account and Add Account, as story 119 specifies, so a phone has no way to a held bank Account. Record held journeys at desktop width; at 320 px require only that the region is hidden.
- **Suggested balance (blocked):** a real suggestion (bank current balance less post-cutover imports, prefilled unless the owner already typed) needs a Plaid token that decrypts. Record as blocked; `convex/heldAccounts.test.ts` owns the arithmetic.

## Gotchas

- `e2e/held-accounts.test.ts` owns the three held journeys. The `bank-sync` fixture builds held Accounts and rows through the production sync mutations, with no Plaid.
- A Starting Balance is a Cleared Transaction with `kind: 'startingBalance'`; the server refuses moving it, giving it a Payee, splitting it or making it a Transfer, and the dialog hides those edits. Card debt uses the opposite sign from Cash. Sources: tickets 03, 10, 21; public `accounts.list/create/rename/reorder/setStartingBalance/startingBalance`, `heldAccounts.list/map/createAccount/ignore/suggestStartingBalance`.
- `e2e/starting-balance.test.ts` owns the Account-action Starting balance journey (including a save that finishes after its dialog was dismissed) and the Starting Balance edit journey.
