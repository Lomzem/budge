# What are the exact budget rules?

Type: grilling
Status: resolved
Blocked by: 05

## Question

What are the exact rules of the budget math: how Available rolls over, how cash Overspending and credit Overspending are each handled, how Credit Card Payment Category balances move when spending on a Credit Card Account, how income lands in Ready to Assign, whether money can be Assigned to future months, and what happens to a negative Ready to Assign?

Also, from [What is in v1 and what waits?](05-v1-scope.md): how a Monthly Target's due day and a repeating By date Target compute the amount still needed this month, how a repeating By date Target rolls forward once met, and how the reconciliation adjustment Transaction affects Ready to Assign and Categories.

## Answer

**The rule everything keeps true**

- Cash in Cash Accounts = Ready to Assign + the sum of every Category's Available, Credit Card Payment Categories included. This is the main property the budget-math tests check.
- Budge stores only Transactions and Assigned amounts and calculates every Available from them, Credit Card Payment Categories included; moved amounts are never stored. This keeps every rule below a two-way door: changing a rule changes a calculation, not data.
- All amounts are whole cents (integers). Dates are plain dates with no time or time zone; a Transaction's month is the calendar month of its date. Each line of a split Transaction follows these rules on its own.

**Available and Overspending**

- Available = prior Available + Assigned + Activity, with no exceptions. Positive leftovers roll into the next month.
- A negative Available (Overspending) also carries forward until it is covered. There is no month-end reset, and Ready to Assign never changes because of spending. This is the one deliberate difference from YNAB: it keeps a single formula, keeps edits to past months consistent, and keeps the deficit in the Category that caused it.
- Overspent Categories show at the top of the budget screen until they are covered.

**Ready to Assign**

- One global number, the same on every month: all Ready to Assign inflows minus everything Assigned in every month, past and future.
- An inflow into a Cash Account categorized to Ready to Assign counts from its date; future-dated income counts once its date arrives. An inflow categorized to a normal Category (a refund) adds to that Category's Activity.
- Cash Account starting balances are Ready to Assign inflows dated on the cutover date.
- Money can be Assigned to future months, which reduces Ready to Assign right away.
- Ready to Assign may go negative. It never blocks anything; the budget screen shows a clear warning until it is fixed.

**Credit cards**

- Every categorized outflow on a Credit Card Account moves its full amount from the Category into that card's Credit Card Payment Category, even when the Category goes negative. Covering the Category later funds the card with no second rule. Example: Groceries has $30, a $50 Discover purchase leaves Groceries at −$20 and adds $50 to Discover Payment.
- The Payment Category shows how much of it is still waiting on overspent Categories (for example "$20 waiting on Groceries"), so the uncovered part stays visible as in YNAB. Under carry-forward this ends where YNAB's rule ends once covered; YNAB's partial-move rule can be switched to later as a calculation change.
- A categorized inflow on a card (a refund or return) reverses the move: the Category goes up, the Payment Category goes down.
- A card payment is a Transfer from a Cash Account to the Credit Card Account. It is Activity in that card's Payment Category and uses no other Category. A Transfer between two Cash Accounts has no Category and does not touch the budget.
- Card debt existing at cutover (the card's starting balance) touches no Category and not Ready to Assign. The Payment Category starts at $0; the budget screen shows the debt not yet covered (card balance − Payment Available), paid down by assigning to the Payment Category.

**Uncategorized Transactions**

- An Uncategorized Transaction counts exactly as if categorized to Ready to Assign (on a card, that includes the full-amount move) until it gets a Category. The budget screen shows how many Transactions still need one.

**Reconciliation adjustment**

- One Transaction dated the day of reconciliation, Payee "Reconciliation Adjustment", categorized to Ready to Assign by default and editable. On a Cash Account it adds to or takes from Ready to Assign; on a Credit Card Account it follows the full-amount move like any card outflow.

**Targets**

- A Monthly Target ("$X each month, optional due day") is one of two kinds, chosen per Target and changeable:
  - **Refill up to $X** (default): still needed = max(0, X − (prior Available + Assigned this month)).
  - **Set aside $X**: still needed = max(0, X − Assigned this month).
- The due day never changes the amount; it only places the Target on the Upcoming list with whether its Category is fully funded.
- A By date Target ("$X Available by date D, optionally every N months"): still needed this month = max(0, ⌈(X − prior Available) ÷ months left⌉ − Assigned this month), where months left counts from the viewed month through D's month inclusive, rounded up to the cent. Example: $139 by March 3, viewed in November with nothing saved → $27.80.
- A repeating By date Target switches to its next date only after D's month ends: every month up to and including D's month uses D; later months use D + N months, and so on. It is calculated from the date, with nothing stored.

**Effects on other tickets**

- [What does the data model look like in Convex?](11-data-model.md): store Transactions and Assigned only; Available, Activity, Ready to Assign, Payment Category balances, and Target progress are all derived. Amounts as integer cents, dates as plain dates. A repeating By date Target stores its first date and interval, not a rolling date.
- [What does the budget screen look like on desktop and phone?](09-budget-screen.md): place overspent Categories at the top, the negative Ready to Assign warning, the count of Uncategorized Transactions, the "waiting on" note on Payment Categories, and card debt not yet covered.
- [How do synced Transactions arrive?](07-import-flow.md): synced Transactions may arrive Uncategorized; they count against Ready to Assign until categorized.
