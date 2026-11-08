# Reconciliation

Compare cleared balance to the bank, record a difference when needed, and lock reconciled Transactions.

## Sub-features

- `reconcile-equal`, `reconcile-adjust`: exact balance and adjustment.
- `reconcile-lock`, `reconcile-unlock`: protected amount/date/Account and explicit unlock.

## How to get to it (user POV)

- Named Account page → Reconcile; reconciled row → Edit Transaction → Unlock.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/reconciliation.ts`, also run by `bun run test:e2e:local`):

- `reconciliation/difference`: a $1.00 difference on the seeded Card becomes a locked Reconciliation Adjustment, and Unlock reopens it (`reconcile-adjust`, `reconcile-lock`, `reconcile-unlock`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Equal:** click Reconcile, scope dialog `Reconcile <Account>`; read displayed cleared balance and fill the matching bank balance label (inspect whether Cash or card amount-owed wording). Set Date, click Reconcile. Require no adjustment and `getByTestId("last-reconciled")` date; all Cleared Transactions now Reconciled after reload, including ones dated after the Reconciliation Date (manual drive).
- **Difference:** fresh seed; enter a bank balance differing by an invented $1.00. Require one Reconciliation Adjustment row with correct sign, Ready to Assign category and reconciled state; verify Account balance and Budget change. Repeat Cash and Card with card sign rules.
- **Lock:** open a reconciled row, require Amount/Date/Account and Direction radios disabled and no Delete. Payee/memo/Category may still change. Click Unlock; require protected fields editable and Cleared remains checked after reload. For a Starting Balance, Account remains disabled, Payee is absent and Split/Transfer choices stay unavailable (manual drive). Capture before/action/result.

## Gotchas

- Use `e2e/journeys/reconciliation.ts` for exact dynamic bank-balance label and adjustment status; input owed balance on cards is sign-inverted.
- Sources: ticket 12; public `reconciliation.clearedBalance/reconcile`, `transactions.unlock`.
