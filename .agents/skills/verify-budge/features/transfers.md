# Transfers, including imported sides

Move money between Accounts as one linked pair, and link an already imported opposite side without duplicates.

## Sub-features

- `transfer-pair`: create/edit/delete either side; budget-neutral Cash-to-Cash.
- `transfer-import`: create uncleared opposite side or link existing import.
- `transfer-card`: Cash-to-card payment updates Payment Category.

## How to get to it (user POV)

- Add Transaction on an Account or the Accounts page → Category or Transfer → Transfer: <other Account>.
- Edit an imported Transaction → the same selector → Other side choices.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/transfers.ts`, also run by `bun run test:e2e:local`):

- `transfers/pair`: a Transfer appears in both Accounts and deleting one side deletes both (`transfer-pair`).
- `transfers/import-link`: a Transfer from an import links the other import (`transfer-import`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Pair:** record Checking/Savings balances and Ready to Assign. Add Transaction, select `Category or Transfer` option `Transfer: Savings`, Outflow, Amount 10.00; Save. Require opposite signed rows in both Accounts, total Cash and Ready to Assign unchanged. Reload both sides; edit amount/date from Savings and require both updated. Delete one side through confirmation and require both gone and balances restored.
- **Import-create:** import an invented Cash outflow, edit it to Transfer: Savings, select `Create a new uncleared side` if candidates exist; otherwise Save creates that side without showing the choice. Require one linked uncleared inflow in Savings. Import its matching opposite bank row; require one pair with both Cleared, no third row.
- **Import-link:** import both sides before categorizing. Edit source, choose destination; inspect Other side candidates and select the opposite import within ten days. Save and require only one pair, both Cleared. Manually verify the linked side adopts the edited side’s Date and Memo and both are approved. Repeat with multiple offers and explicit new-side choice; use `e2e/journeys/transfers.ts` for radio names derived from rendered amounts/dates.
- **Card payment:** transfer Cash to Card; require Cash decrease, card debt decrease, Payment Available decrease, and no expense assigned to an ordinary Category. Capture both lists and Budget after reload.

## Gotchas

- **Manual drive:** convert an existing Transfer to an ordinary Category; require its counterpart deleted and balances/Activity updated after reload.
- At least one side must be a Cash Account; card-to-card Transfers are unavailable. The Other side radios, including `Create a new uncleared side`, appear only when candidates exist.

- Sources: tickets 09, 10, 22; public `transactions.create/update/remove/transferCandidates`.
- No automatic Transfer detection. Reconciled sides require unlocking before amount/date edits.
