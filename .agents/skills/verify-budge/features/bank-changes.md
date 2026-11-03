# Held, changed and removed Bank Rows

Keep approved or edited Transactions safe when the bank changes history, while applying untouched changes quietly.

## Sub-features

- `bank-held`: hold rows until their external Account is resolved.
- `bank-quiet`: untouched Unapproved modification/removal updates balances automatically.
- `bank-resolve`: approved/edited rows flag changes/removal; accept bank or keep owner version.

## How to get to it (user POV)

- Expected: Bank Connection / held Account prompt, Transaction list flag, then Transaction detail resolution. These controls are absent in this checkout.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Precondition check:** inspect seeded list and Bank Connections using the ordinary navigation and capture ARIA. Record absence of held/changed/removed rows and resolution controls as blocked.
- **Held contract:** once an authorized fixture exists, require held rows not to affect balances; resolve through the Accounts mapping journey before import.
- **Changed/removed contract:** once the real controls and data exist, inspect untouched versus edited/approved examples. Require quiet modification/removal for untouched rows, flags plus unchanged owner data for the others. Open each flag and choose accept bank or keep mine in separate reset runs. Reload and verify flags cleared, correct Transaction presence/amount, Account balance, budget Activity/Ready to Assign and search results.

## Gotchas

- Known fixture gap: neither `empty-budget` nor `budget-with-accounts` contains held, changed, or removed Bank Rows. Never fabricate a fixture or claim ordinary Unapproved rows cover this.
- Ticket 19 remains unimplemented: no resolution public API/UI; current sync does not apply modified/removed rows. Ticket 21 held-row handling is also incomplete. Missing controls are an implementation gap in addition to missing data.
