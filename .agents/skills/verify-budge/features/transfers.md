# Transfers, including imported sides

Move money between Accounts as one linked pair, and link an already imported opposite side without duplicates.

## Sub-features

- `transfer-pair`: create/edit/delete either side; budget-neutral Cash-to-Cash.
- `transfer-import`: create uncleared opposite side or link existing import.
- `transfer-card`: Cash-to-card payment updates Payment Category.

## How to get to it (user POV)

- Add Transaction on Account or All Accounts → Category or Transfer → Transfer: <other Account>.
- Edit an imported Transaction → the same selector → Other side choices.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Pair:** record Checking/Savings balances and Ready to Assign. Add Transaction, select `Category or Transfer` option `Transfer: Savings`, Outflow, Amount 10.00; Save. Require opposite signed rows in both Accounts, total Cash and Ready to Assign unchanged. Reload both sides; edit amount/date from Savings and require both updated. Delete one side through confirmation and require both gone and balances restored.
- **Import-create:** import an invented Cash outflow, edit it to Transfer: Savings, select `Create a new uncleared side`, Save. Require one linked uncleared inflow in Savings. Import its matching opposite bank row; require one pair with both Cleared, no third row.
- **Import-link:** import both sides before categorizing. Edit source, choose destination; inspect Other side candidates and select the opposite import within ten days. Save and require only one pair, both Cleared. Repeat with multiple offers and explicit new-side choice; use `e2e/imported-transfers.test.ts` for radio names derived from rendered amounts/dates.
- **Card payment:** transfer Cash to Card; require Cash decrease, card debt decrease, Payment Available decrease, and no expense assigned to an ordinary Category. Capture both lists and Budget after reload.

## Gotchas

- Sources: tickets 09, 10, 22; `e2e/transfers.test.ts`, `e2e/imported-transfers.test.ts`; public `transactions.create/update/remove/transferCandidates`.
- No automatic Transfer detection. Reconciled sides require unlocking before amount/date edits.
