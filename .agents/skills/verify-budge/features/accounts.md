# Accounts, held Accounts and starting balances

Create Cash and Credit Card Accounts, arrange them, and decide where an unknown synced bank Account's rows go.

## Sub-features

- `account-create`, `account-start`: Cash/Card creation and cutover starting Transaction.
- `account-start-action`: Account actions → Starting balance shows the current amount and replaces it.
- `account-start-edit`: editing a Starting Balance offers only Date, Category, Direction, Amount and Memo.
- `account-rename`, `account-order`, `account-missing`: names, group order and invalid route.
- `account-held`, `account-suggested`: map/create/ignore held bank Accounts and confirm the Starting Balance step.

## How to get to it (user POV)

- Desktop sidebar `Add Account` beside the Accounts heading; on every width, the Accounts page's `Add Account`.
- Named Account page → `<name> actions` → Rename, Move up, Move down, Starting balance, and `Stop syncing from <connection>` on an Account a Bank Connection feeds (its result floats at the bottom of the screen with `Dismiss`, which returns focus to the actions button; see [plaid.md](plaid.md)). The header reads the Account name (h1) first, then its type, then `getByTestId("account-sync")`, which names the Bank Connection that feeds it (see [plaid.md](plaid.md)).
- Below `lg`, the Accounts page folds the Account list into a `Your Accounts <count>` disclosure. It starts closed, so the register is in view, and a plain visit opens it only if the owner left it open last time (remembered in this browser); arriving with a filter in the URL keeps it closed.
- Bank page → the connection's card → `New bank Accounts` region → `Set up <name> ending <mask>` (the row shows the name, `Ending <mask>` on its own line, then `<n> transactions waiting`, or `No transactions waiting yet` for one just brought back) → dialog `<name> ending <mask>` → radio `Into <Account>` / `Into a new Account` / `Nowhere: ignore this bank Account` → `Import its transactions` or `Ignore` → dialog `Starting balance for <Account name>` → `Confirm`, `Skip` or `Suggest again`.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/accounts.ts`, also run by `bun run test:e2e:local`):

- `accounts/start-late-save`: the Account-action Starting balance, including a save that finishes after its dialog was dismissed.
- `accounts/start-edit`: Starting Balance edit offers only allowed edits and saves.
- `accounts/held-map`, `accounts/held-new-card`, `accounts/held-ignore`: the three held journeys on `bank-sync`. The dialog's description starts with `<n> transactions waiting.`; an Account already fed by a connection is described `Already fed by <connection>` (Savings by Sample Community Bank); choosing an Account of the other type blocks `Import its transactions` (`aria-disabled`, described by `The bank says this is a credit card, but Checking is a cash Account, …`) until a matching or new Account is chosen. The area under the choices keeps one height: the new-Account fields, the mismatch block, `Its transactions join <Account>…` and the Ignore note share one grid cell. An ignored bank Account brought back from `Ignored bank Accounts` on the same page offers `Set up` again, focused.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** establish cutover via Settings, then click `Add Account`; dialog `Add Account`, label Name = `Sample Verification Cash`, check radio `Cash, such as checking or savings`, fill `Current balance` with `123.45`, submit scoped `Add Account`. Require navigation to `/accounts/<id>`, sidebar under Cash, balance $123.45, and a Cleared Starting Balance Transaction on cutover date. Budget Ready to Assign must increase by $123.45. Reload and repeat mobile creation. For exact card balance label inspect the dialog (`Amount owed` for cards); create a card with invented debt and verify Credit grouping and linked Payment Category without changing Ready to Assign.
- **Starting balance action (beyond `accounts/start-late-save`):** `Cancel` changes nothing; a card Account labels the field `Amount owed on the cutover date`.
- **Starting Balance edit (beyond `accounts/start-edit`):** require the hint `A starting balance stays in its Account, with no Payee and one Category.` Change Memo, Save, reload, reopen: require the Memo saved and the Account balance unchanged. Capture 1280 and 320 widths.
- **Rename/order:** open created Account, button `<name> actions`, menuitem Rename, dialog label Name, Save. Require the heading, the sidebar and the Accounts page keep the name after reload; renaming a Credit Card Account also renames its Credit Card Payment Category (manual drive). Exercise Move up/down within its Cash or Credit group and verify order; group-edge actions are disabled.
- **Missing route:** navigate `/accounts/not-an-account`; require the app’s missing/invalid Account handling and no leaked data, record actual behavior.
- **Held (`bank-sync` seed):** the three journeys below run as `accounts/held-*`; drive them by hand only for what they leave out (reload checks, Ready to Assign, Skip). Readiness: on `/bank`, the `region` named `New bank Accounts` lists Sample Savings Plus ending 4417 (2 rows), Sample Rewards Card ending 9021 (2 rows) and Sample Holiday Club ending 1180 (1 row), all from Sample Credit Union. Held rows change no balance; capture Savings' balance first. Reseed before each of the three journeys.
  - **Map into an existing Account:** open Sample Savings Plus, check radio `Into Savings`, click `Import its transactions`. In dialog `Starting balance for <Account name>` wait for `Suggest again` to be enabled (the suggestion fails with `Bank sync isn't set up on this server.` (the local app has no Plaid credentials; with credentials it would be `Bank sync isn't set up on this server.`), since the seed's token never decrypts), fill `Starting balance` = `1,000.00`, click `Confirm`. Require the held entry gone; on Savings require rows SAMPLE INTEREST PAID and SAMPLE TRANSFER IN 5512 and the Starting Balance row at $1,000.00. Reload.
  - **Create a card Account:** open Sample Rewards Card, check `Into a new Account`; Name is prefilled `Sample Rewards Card`; set it to an invented name, check `Credit card`, `Import its transactions`. Fill `Amount owed on the cutover date` = `100.00`, `Confirm`. Require the Account under Credit with SAMPLE BISTRO 0817 and SAMPLE BOOK NOOK 3306 and balance −(100.00 + 36.29 + 21.08) = −$157.37 and a Payment Category on the Budget. Capture Ready to Assign before mapping: it falls by exactly $57.37, the two Uncategorized purchases (an Uncategorized Transaction counts against Ready to Assign); the $100.00 starting debt itself leaves it unchanged.
  - **Ignore:** open Sample Holiday Club, check `Nowhere: ignore this bank Account`; require `Its transactions are dropped, and Budge stops asking. Bring it back from its Bank card any time.`; click `Ignore`. Require the entry gone after reload while the other two remain, and no Account created.
  - **Skip:** `Skip` closes the Starting balance step and leaves any existing Starting Balance as it was; the mapping stays.
- **Held at 320 px:** the Bank tab reaches the same cards, and each `Set up` button opens the same dialog at phone width (manual drive; the journeys run at desktop width).
- **Suggested balance (blocked):** a real suggestion (bank current balance less post-cutover imports, prefilled unless the owner already typed) needs a Plaid token that decrypts. Record as blocked; `convex/heldAccounts.test.ts` owns the arithmetic.

## Gotchas

- The `bank-sync` fixture builds held Accounts and rows through the production sync mutations, with no Plaid.
- A Starting Balance is a Cleared Transaction with `kind: 'startingBalance'`; the server refuses moving it, giving it a Payee, splitting it or making it a Transfer, and the dialog hides those edits. Card debt uses the opposite sign from Cash. Sources: tickets 03, 10, 21; public `accounts.list/create/rename/reorder/setStartingBalance/startingBalance`, `heldAccounts.list/map/createAccount/ignore/suggestStartingBalance`.
