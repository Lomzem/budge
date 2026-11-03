# Accounts, held Accounts and starting balances

Create Cash and Credit Card Accounts, arrange them, and recognize the pending workflow for unknown synced Accounts.

## Sub-features

- `account-create`, `account-start`: Cash/Card creation and cutover starting Transaction.
- `account-start-edit`: editing a Starting Balance offers only Date, Category, Direction, Amount and Memo.
- `account-rename`, `account-order`, `account-missing`: names, group order and invalid route.
- `account-held`, `account-suggested`: map/create/ignore unknown Accounts and confirm suggested balance (not implemented).

## How to get to it (user POV)

- Desktop sidebar `Add Account`; phone View menu → Add Account.
- Named Account page → `<name> actions` → Rename, Move up, Move down.
- Held Account mapping and starting-balance suggestions have no UI in this checkout.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Create:** establish cutover via Settings, then click `Add Account`; dialog `Add Account`, label Name = `Sample Verification Cash`, select `Cash, such as checking or savings`, fill `Current balance` with `123.45`, submit scoped `Add Account`. Require sidebar under Cash, balance $123.45, and a Cleared Starting Balance Transaction on cutover date. Budget Ready to Assign must increase by $123.45. Reload and repeat mobile creation. For exact card balance label inspect the dialog (`Amount owed` for cards); create a card with invented debt and verify Credit grouping and linked Payment Category without changing Ready to Assign.
- **Starting Balance edit:** seed `budget-with-accounts`, open Checking, click button `/^Starting Balance/`; dialog `Edit Transaction`. Require labels Account and Payee disabled (Payee value `Starting Balance`), the hint `A starting balance stays in its Account, with no Payee and one Category.`, label `Category` (exact) listing `Groceries` but no `Split across Categories` and no `Transfer:` options. Change Memo, Save, reload, reopen: require the Memo saved and the Account balance unchanged. Capture 1280 and 320 widths.
- **Rename/order:** open created Account, button `<name> actions`, menuitem Rename, dialog label Name, Save. Require heading and both navigation menus retain name after reload. Exercise Move up/down within its Cash or Credit group and verify order; group-edge actions are disabled.
- **Missing route:** navigate `/accounts/not-an-account`; require the app’s missing/invalid Account handling and no leaked data, record actual behavior.
- **Held/suggested (blocked):** with unknown external Account and held rows, require no imported balance change before mapping. Map existing/new or Ignore; verify mapped rows match history once and ignored IDs remain ignored. For a new synced Account require suggestion = bank current balance minus imported post-cutover Transactions, confirm/edit it, and reopen cutover Starting Balance. Stop as blocked when the entry/precondition is absent.

## Gotchas

- Ticket 21 is unimplemented: no held-Account actions or suggested-balance public API/UI. Current sync records held connection Accounts but skips rows; it cannot prove ticket 21’s held-row storage/mapping. No seed includes held Accounts or Bank Rows.
- A Starting Balance is a Cleared Transaction with `kind: 'startingBalance'`; the server refuses moving it, giving it a Payee, splitting it or making it a Transfer, and the dialog hides those edits. Card debt uses the opposite sign from Cash. Sources: tickets 03, 10, 21; public `accounts.list/create/rename/reorder`.
