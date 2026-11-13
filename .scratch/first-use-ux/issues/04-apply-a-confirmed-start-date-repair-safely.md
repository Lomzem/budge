# 04: Apply a confirmed start-date repair safely

**Status:** ready-for-agent

**Spec:** [First-use budgeting UX](../spec.md)

**Blocked by:** 03 — consume a reviewable repair proposal.

Deliver: a user can confirm the previewed change and get consistent Transactions, Starting Balances, and budget totals. Reject a stale preview rather than applying unreviewed effects. Interruptions/retries must not duplicate work; preserve Transfer integrity and respect reconciliation rules. Provide and verify a recovery path. Another sync must not reintroduce excluded history. Inspect the actual user's setup and prepare its November repair, but do not execute a live repair without approval of the concrete preview and recovery plan.

Proof: the repair owner is primary for before/after persistent accounting state, stale-preview rejection, and repeat/interruption safety using synthetic data. Reuse monthly-cache consistency proof rather than duplicate its implementation. Add one distinct sync-boundary regression for excluded history only if current sync proof does not cover the changed boundary. A browser journey proves preview-to-confirm completion and recovery access, not every accounting permutation. Actual account correctness requires checking actual inputs separately; fixture tests cannot certify it.

## Testing gate (shared by every ticket)

- Before authoring a test, name the protected observable contract, credible regression, primary owner, why existing proof misses it, and whether a test-only production seam would be needed. Choose a real boundary instead of adding such a seam.
- Extend existing owner tables/fixtures. Keep one primary regression per contract; another layer must cover a different transport or lifecycle risk. Use synthetic data and independent expected values. Do not add source greps, private call assertions, copied inventories, or mocks that supply the asserted behavior.
- Demonstrate regressions failing pre-fix for the intended reason, then passing. Report unavailable baseline proof honestly. Baseline failures are not grounds to remove tests.
- Use verify-budge for running-app evidence, update its feature map for changed features, and follow the repository's auth, lifecycle, and cleanup requirements. Record focused owner/sibling checks and changed test runtime; complete required repository checks.
- Run the repository's per-ticket principles, test-audit, local code-review, and corrections workflow. Findings must be fixed, answered, or deferred with a reason. Follow the one-integration-PR policy and the explicit no-CodeRabbit exception for this spec. Implementation of all tickets was authorized on 2026-11-12. Ticket 12 owns shipping; a live data repair still requires approval of its concrete preview and recovery plan.

## Comments

### Decisions from ticket 03 review

Owner decisions recorded 2026-11-13 from the ticket 03 review. They bind this ticket's apply step.

- **Recompute, then compare.** Applying recomputes the proposal inside the same mutation, with the read limits in `LATER_CUTOVER_READS` (`convex/lib/laterCutover.ts`). It then compares the recomputed fingerprint with the one the user confirmed. A mismatch rejects the apply and changes nothing, so the user previews again. The fingerprint is a SHA-256 of the ready preview's canonical form, with object keys sorted and every list sorted as a set. Any change to what the preview shows changes it; a presentation-only reorder does not.
- **Server time, not the client's `today`.** The mutation validates the date against server time under a defined time-zone policy, not against the `today` argument the preview query takes from the client. Write the policy down here before implementing it.
- **Explicit unlock for reconciled history.** Replacing a reconciled Starting Balance, or folding reconciled Transactions, requires an explicit unlock from the user. Without it, the apply refuses.
- **Bank-feed confirmations become unconfirmed after the move.** This is already the ticket-02 rule, verified 2026-11-13:
  - `confirmStartingBalance` keys `connectionAccounts.startingBalanceConfirmedFor` to the cutover date.
  - `isStartingBalanceConfirmed` (`convex/lib/accounts.ts`) compares that key with the current cutover date, so moving the date unconfirms every feed.
  - The owner test is `convex/heldAccounts.test.ts`: "a confirmed starting balance is unconfirmed again once the cutover date changes, until the owner sets it for the new date".
  - Apply must not re-confirm feeds itself.
- **The new Starting Balance's state.** It is cleared, approved and unreconciled. `saveStartingBalance` already writes `cleared: 'cleared'` and `approved: true`.
- **Uncleared rows.** The preview must state that folding uncleared rows changes the cleared balance. Today's caution reads "… that haven't cleared count in the Starting Balance as if they had". Keep that caution, and name the cleared-balance change it causes.

### Time-zone policy for the apply (recorded 2026-11-13, before implementing it)

Budge stores no time zone: the owner's day is the browser's local date, as for every other date the app proposes. The apply therefore takes the browser's `today`, but trusts it only as far as server time allows:

- `today` must be a real date, and it must be the calendar date somewhere on Earth at the server's clock when the mutation runs: from the UTC date at `Date.now()` − 12 hours to the UTC date at `Date.now()` + 14 hours (UTC−12 to UTC+14). Any other `today` refuses with a message that the device's date looks wrong, and changes nothing.
- The new cutover date must be on or before that `today` (the preview's `notYet` rule). So no device clock can start a budget on a day that has not begun anywhere.
- The recomputed preview uses the same validated `today`, so its fingerprint matches the one the owner reviewed when nothing else changed. A device whose date rolls over between preview and confirm sees the preview change, which is the stale-preview path.
