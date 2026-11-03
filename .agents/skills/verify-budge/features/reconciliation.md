# Reconciliation

Compare cleared balance to the bank, record a difference when needed, and lock reconciled Transactions.

## Sub-features

- `reconcile-equal`, `reconcile-adjust`: exact balance and adjustment.
- `reconcile-lock`, `reconcile-unlock`: protected amount/date/Account and explicit unlock.

## How to get to it (user POV)

- Named Account page → Reconcile; reconciled row → Edit Transaction → Unlock.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Equal:** click Reconcile, scope dialog `Reconcile <Account>`; read displayed cleared balance and fill the matching bank balance label (inspect whether Cash or card amount-owed wording). Set Date, click Reconcile. Require no adjustment and `getByTestId("last-reconciled")` date; Cleared rows now Reconciled after reload.
- **Difference:** fresh seed; enter a bank balance differing by an invented $1.00. Require one Reconciliation Adjustment row with correct sign, Ready to Assign category and reconciled state; verify Account balance and Budget change. Repeat Cash and Card with card sign rules.
- **Lock:** open a reconciled row, require Amount/Date/Account disabled and no Delete. Payee/memo/Category may still change. Click Unlock; require protected fields editable and Cleared remains checked after reload. Capture before/action/result.

## Gotchas

- Use `e2e/reconciliation.test.ts` for exact dynamic bank-balance label and adjustment status; input owed balance on cards is sign-inverted.
- Sources: ticket 12; public `reconciliation.clearedBalance/reconcile`, `transactions.unlock`.
