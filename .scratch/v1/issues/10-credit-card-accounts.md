# 10: Credit Card Accounts

**What to build:** Each Credit Card Account has its own Credit Card Payment Category. A categorized card purchase moves its full amount from the Category into the Payment Category, even when the Category goes negative, and a refund reverses the move. A card payment is a Transfer from a Cash Account. The Payment Category shows how much is still "waiting on" overspent Categories, and the screen shows the card debt not yet covered.

**Blocked by:** 09 (Transfers)

**Status:** ready-for-agent

**Spec:** [Budge v1](../../v1-spec/spec.md): stories 14–15, 44–48; Domain module (credit-card rules)

- [ ] Test-first in the domain module, through the budget entry point:
  - Every categorized card outflow moves its full amount into that card's Payment Category, and a categorized card inflow reverses it. The worked example holds: Groceries $30 with a $50 card purchase leaves Groceries at −$20 and Discover Payment at +$50.
  - An Uncategorized card outflow follows the move as if categorized to Ready to Assign.
  - A card payment Transfer is Activity in the Payment Category only.
  - A card's starting balance touches no Category and not Ready to Assign.
  - "Waiting on" amounts per overspent Category, and card debt not yet covered (card balance − Payment Available).
  - The cash invariant holds with cards included.
- [ ] Creating a Credit Card Account creates its Payment Category in the system `creditCardPayments` group, with the `accountId` link.
- [ ] Budget table: Payment Categories appear in their group with the "waiting on" note (for example "$20 waiting on Groceries") and the debt not yet covered.
- [ ] `convex-test`: a sequence of card purchases, a refund, a Cover of the overspent Category, and a card payment gives the expected Payment Available and Ready to Assign.
- [ ] The seed gains card purchases and one card payment.
