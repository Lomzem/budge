# Spec: Budge v1

Status: ready-for-agent

Source: the resolved wayfinding map, [Map: Budge v1 spec](map.md), and its tickets under `issues/`. Each decision below cites the ticket that made it. Where this spec decides something new, it says so.

## Problem Statement

I budget the zero-based way: every dollar I have gets a job. YNAB does this well, but it costs more than I want to pay for a tool only I use. Its behavior also isn't mine to change. When I overspend a Category, YNAB resets the overspent amount at month-end and takes it out of next month's Ready to Assign. That makes editing a past month hard to follow.

My money is in Capital One checking, Capital One savings, and a Discover card that now signs in through Capital One, plus a few Accounts I track by hand. I want my Transactions to arrive on their own. I want to review and categorize them quickly on my laptop or my iPhone, and to see what each Category has Available. I also need to know what's coming due and whether I'm covered.

The tool must cost almost nothing to run: at most $25 a year for bank sync, and free tiers for everything else. That covers development and testing too. The repo is public, so no real financial data or secrets can ever reach it.

## Solution

Budge is a personal, single-user, YNAB-style budget web app that runs at `budge.lomzem.dev` and installs on my iPhone as a Home Screen web app. When no decision here says otherwise, it copies YNAB's behavior. The one deliberate difference in the budget math: Overspending carries forward in its Category until I Cover it, and there is no month-end reset.

- **Budget screen**: the YNAB layout. An Account sidebar, a table of Category Groups and Categories with Assigned, Activity, and Available, and an inspector for the selected Category. The inspector holds the Upcoming list.
- **Ready to Assign**: one global number that may go negative. It shows a warning while negative.
- **Targets**: Monthly Targets (refill up to, or set aside, with an optional due day) and By date Targets (optionally repeating). Each Category with a Target shows its progress.
- **Credit cards**: YNAB's Credit Card Payment Category model.
- **Transactions**: split Transactions, Transfers, memos, search and filters, and editing in any month.
- **Bank sync**: Plaid's free Trial plan syncs Capital One checking, savings, and the Discover card through one Bank Connection. Imported Transactions count at once and arrive Unapproved and Cleared. One matcher links Bank Rows to Transactions I entered by hand.
- **File import**: Capital One CSV and QFX, and Discover CSV, as a fallback.
- **Upkeep**: Reconciliation, Category management, move money, Payee memory, and a full CSV/JSON export.
- **Access**: only I can sign in, using GitHub. Every backend function checks that the caller is the owner.

Development, CI, and previews stay inside the free tiers of Convex, Clerk, Vercel, Plaid, GitHub, and CodeRabbit. Automated tests never touch a cloud backend or a real bank.

## User Stories

### Access and security

1. As the owner, I want to sign in with my GitHub account, so that I don't manage another password and my GitHub 2FA protects my budget.
2. As the owner, I want sign-up closed (Invite-only, with only my GitHub email invited), so that nobody else can create an account.
3. As the owner, I want every backend function to reject any caller who isn't me, so that even a valid Clerk session for another user can't read or change my budget.
4. As the owner, I want my session to last Clerk's free 7 days and re-sign-in to be one tap, so that I stay secure without paying for Clerk Pro.
5. As the owner, I want Bank Connection tokens encrypted at rest, so that a database copy or export can't be used to read my bank.
6. As the owner, I want Bank Connection tokens never to reach the browser, so that a compromised page can't steal them.
7. As the owner, I want error messages in the app to be short, fixed codes, so that tokens, request bodies, and raw bank responses never show up in the UI or logs.
8. As the owner, I want the public repo to hold only code and synthetic fixtures, so that none of my merchants, balances, account numbers, or Plaid IDs is ever published.

### Setup and Accounts

9. As the owner, I want to set a cutover date, so that Budge starts fresh from that date and ignores anything earlier.
10. As the owner, I want to create manual Cash Accounts and Credit Card Accounts, so that I can track money that has no Bank Connection.
11. As the owner, I want to enter a manual Account's starting balance as a Transaction on the cutover date, so that its balance is right from day one.
12. As the owner, I want Budge to suggest a synced Account's starting balance (Plaid's current balance minus Transactions imported since cutover), so that I only confirm or correct it.
13. As the owner, I want a Cash Account's starting balance to land in Ready to Assign, so that I can give that money jobs right away.
14. As the owner, I want a card's starting debt to touch no Category and not Ready to Assign, so that old debt doesn't distort this month's budget.
15. As the owner, I want to see each card's debt not yet covered (card balance minus Payment Available), so that I know how much more I need to assign to pay it off.
16. As the owner, I want to rename and reorder Accounts, so that the sidebar reads the way I think about my money.
17. As the owner, I want Accounts in the sidebar grouped as Cash and Credit, each with its balance, so that I see my position at a glance.

### Budget screen

18. As the owner, I want to see Category Groups and their Categories with Assigned, Activity, and Available for a month, so that I know where my money stands.
19. As the owner, I want group rows to show their totals, so that I can see how much went to each area.
20. As the owner, I want to move to the previous or next month, so that I can look back or plan ahead.
21. As the owner, I want Ready to Assign shown at the top, with how much Uncategorized money it includes, so that I know how much is truly free.
22. As the owner, I want Ready to Assign to be the same number in every month, so that future Assigned amounts reduce it right away.
23. As the owner, I want a clear warning when Ready to Assign is negative, so that I fix it without being blocked from anything.
24. As the owner, I want overspent Categories shown at the top until they are Covered, so that I deal with them first.
25. As the owner, I want Available colored green when funded, amber when underfunded, and red when overspent, with the status in text too, so that color is never the only signal.
26. As the owner, I want the count of Uncategorized Transactions and the count of Unapproved Transactions on the budget screen, so that I know how much review is waiting.
27. As the owner, I want income dated in the future to count only from its date, so that I don't spend money I haven't received.
28. As the owner, I want a negative Available to carry into later months until I Cover it, so that the deficit stays with the Category that caused it.
29. As the owner, I want positive Available to roll over into the next month, so that unspent money keeps its job.

### Assigning and moving money

30. As the owner, I want to edit Assigned inline in the budget table, so that budgeting is fast.
31. As the owner, I want to assign to any month, past or future, and have every later Available recalculate, so that I can fix mistakes and plan ahead.
32. As the owner, I want an "Assign $X" action that assigns what a Target still needs, so that I don't do arithmetic.
33. As the owner, I want a "Cover $X from Ready to Assign" action on an overspent Category, so that I can zero it in one step.
34. As the owner, I want to move money from one Category to another as one action, so that rebalancing doesn't take two edits.

### Targets and Upcoming

35. As the owner, I want a Monthly Target that refills a Category up to an amount, so that bills like groceries get topped up each month.
36. As the owner, I want a Monthly Target that sets aside an amount on top of what's left, so that savings grow by a fixed amount each month.
37. As the owner, I want to switch a Monthly Target between refill and set aside, so that I can change my mind without recreating it.
38. As the owner, I want an optional due day on a Monthly Target, so that rent and subscriptions appear on the Upcoming list.
39. As the owner, I want a By date Target ("$X Available by a date"), so that I save for a known future expense in even steps.
40. As the owner, I want a By date Target to repeat every N months, rolling forward only after its due month ends, so that yearly bills like Amazon Prime keep themselves going.
41. As the owner, I want each Category with a Target to show a thin progress bar and "Funded", "$X more needed", or "Overspent by $X", so that I can see what still needs money.
42. As the owner, I want the inspector to show the selected Category's breakdown (left over from last month, Assigned, Activity, Available) with its Target and status, so that I understand its number.
43. As the owner, I want an Upcoming list of every Target due in the next 30 days, with due date, Category, amount, and whether the Category is fully funded, so that nothing catches me short.

### Credit cards

44. As the owner, I want each Credit Card Account to have its own Credit Card Payment Category, so that money for paying the card is set aside.
45. As the owner, I want a categorized card purchase to move its full amount from the Category to the card's Payment Category, even if the Category goes negative, so that Covering the Category later funds the card.
46. As the owner, I want the Payment Category to show how much is still waiting on overspent Categories ("$20 waiting on Groceries"), so that I see what isn't covered yet.
47. As the owner, I want a card refund to reverse the move, so that the Category goes up and the Payment Category goes down.
48. As the owner, I want a card payment entered as a Transfer from a Cash Account, so that it counts as Activity in the Payment Category and touches no other Category.

### Transactions

49. As the owner, I want to enter a Transaction by hand with date, Payee, amount, Category, and memo, so that I can record cash spending or spending before it syncs.
50. As the owner, I want hand-entered Transactions to stay uncleared until matched or marked Cleared, so that I know which ones the bank has confirmed.
51. As the owner, I want to toggle a Transaction between Cleared and uncleared, so that I can reflect what the bank shows.
52. As the owner, I want to edit or delete any Transaction in any month, with balances and Available recalculating, so that history stays correct.
53. As the owner, I want to split a Transaction across several Categories, each line with its own amount and memo, so that one Costco trip can be groceries and household.
54. As the owner, I want each split line to follow the budget rules on its own, so that a split card purchase moves each line's amount to the Payment Category.
55. As the owner, I want to categorize an inflow to Ready to Assign, so that income becomes money to budget.
56. As the owner, I want an inflow categorized to a normal Category to add to that Category, so that refunds go back where they came from.
57. As the owner, I want a Transaction left Uncategorized to count as if categorized to Ready to Assign, so that totals stay right before I review it.
58. As the owner, I want Payee memory to pre-fill a Payee's last Category, so that recurring merchants categorize themselves.

### Transfers

59. As the owner, I want to record a Transfer between two Accounts as a linked pair, so that money moves without changing the total budgeted.
60. As the owner, I want a Transfer between two Cash Accounts to have no Category, so that it never touches the budget.
61. As the owner, I want editing or deleting one side of a Transfer to change the other side, so that the pair never disagrees.
62. As the owner, I want categorizing an imported Transaction as a Transfer to another Account to create the other side as an uncleared Transaction, so that the other Account's import can Match it later.
63. As the owner, I want Budge to offer to link an existing imported Transaction when both sides are already imported, so that I don't get a duplicate.

### Transaction list and search

64. As the owner, I want a Transaction list per Account and for All Accounts, so that I can review any Account's history.
65. As the owner, I want the list to show Date, Account (in All Accounts only), Payee, Category, Memo, Amount, and Cleared, so that I see each Transaction at a glance.
66. As the owner, I want Unapproved Transactions first and shown in bold, so that review work is on top.
67. As the owner, I want Uncategorized shown in amber with text, so that it stands out without relying on color alone.
68. As the owner, I want to filter by Account, Category, Payee, and date range, so that I can find what I'm looking for.
69. As the owner, I want text search over Payee, memo, split memos, and Bank Text, so that I can find a Transaction by any name it has.
70. As the owner, I want the list paginated, so that it stays fast and cheap as years of data pile up.
71. As the owner, I want to see a Transaction's Bank Text, read-only, in its detail, so that I know what the bank actually called it.

### Bank sync

72. As the owner, I want Transactions from my Capital One Bank Connection to arrive on their own, so that I don't type them in.
73. As the owner, I want imported Transactions to count in balances and the budget immediately, so that my numbers are current before I review them.
74. As the owner, I want imported Transactions to arrive Unapproved, and editing, categorizing, Approve, or "Approve all" to approve them, so that I review each one.
75. As the owner, I want imported Transactions to arrive Cleared, so that they match what the bank shows.
76. As the owner, I want pending Transactions ignored, so that holds that vanish or change never clutter my budget.
77. As the owner, I want Transactions dated before the cutover date dropped, so that history I didn't budget doesn't land in the budget.
78. As the owner, I want Payee taken from Plaid's merchant name when present and from the Bank Text otherwise, so that Payees read cleanly.
79. As the owner, I want renaming the Payee on an imported Transaction to be remembered for that exact Bank Text, so that the next import arrives with my name.
80. As the owner, I want sync to run when Plaid says updates are available, so that new Transactions show up within hours.
81. As the owner, I want a daily sync as a backup, so that a lost webhook doesn't leave me stale.
82. As the owner, I want a Sync now action that also asks Plaid to refresh, so that I can pull fresh data on demand.
83. As the owner, I want Sync now ignored while a sync is already running, so that pressing it twice does no harm.
84. As the owner, I want repeated or out-of-order syncs to be harmless, so that no Transaction is ever duplicated.
85. As the owner, I want a "Synced 2 hours ago" line per Bank Connection in the sidebar, with the exact time and any error on opening it, so that I know how fresh my data is.
86. As the owner, I want that line to become "Not synced since Oct 25" after 48 hours without a successful sync, so that quiet failures still reach me.
87. As the owner, I want short-lived errors to retry quietly, so that bank outages don't nag me.
88. As the owner, I want a plain-text "Capital One needs you to reconnect" notice with a Reconnect button at the top of the budget screen when the Bank Connection needs me, so that I fix it promptly.
89. As the owner, I want Reconnect to open Plaid Link in update mode on the existing Item and sync right after, so that I never use up another of my 10 lifetime Items.
90. As the owner, I want "Consent ends Nov 10, renew" in the sidebar from 14 days before Capital One's yearly consent ends, so that I renew before sync stops.
91. As the owner, I want rows for a Plaid Account Budge doesn't know held until I map it to an Account, create an Account, or ignore it, so that nothing lands in the wrong place.
92. As the owner, I want rows for an Account I just mapped matched against Transactions already there, so that history arriving under new IDs (such as after the Discover migration) isn't duplicated.
93. As the owner, I want ignored Plaid Accounts remembered, so that I'm not asked again.

### Matching and bank changes

94. As the owner, I want a Bank Row with a known import ID skipped, so that the same bank Transaction never imports twice.
95. As the owner, I want a Bank Row that has exactly one candidate (same Account, same amount, dated within 10 days, not yet linked to an import from that source) to Match it automatically, so that hand-entered Transactions become Cleared with no work.
96. As the owner, I want to pick the Transaction when two or more candidates exist, so that ambiguous Matches are never guessed.
97. As the owner, I want a Match to keep my Payee, Category, memo, and date, so that the bank never overwrites what I entered.
98. As the owner, I want a Matched Transaction to stay Unapproved with an Unmatch action, so that I can undo a wrong Match.
99. As the owner, I want two identical bank rows (two $5 coffees on one day) to stay two Transactions, so that real repeats aren't merged.
100. As the owner, I want a bank change or removal applied quietly to an Unapproved, unedited Transaction, so that I don't review trivial corrections.
101. As the owner, I want "bank changed this" or "bank removed this" on a Transaction I've approved or edited, with a way to resolve it, so that my version is never silently replaced.

### File import

102. As the owner, I want to import a Capital One CSV or QFX file and a Discover CSV file into a chosen Account, so that I can still bring in Transactions if sync breaks.
103. As the owner, I want Discover's positive purchase amounts read as outflows, so that file imports have the right sign.
104. As the owner, I want a preview showing new, matched, and duplicate rows before saving, so that I can check a file before it changes my budget.
105. As the owner, I want file rows to go through the same matcher as sync, including matching rows already imported by sync, so that a file never duplicates synced Transactions.
106. As the owner, I want QFX transaction IDs used as import IDs, scoped to the Account, so that re-importing the same file is harmless.

### Reconciliation

107. As the owner, I want to Reconcile an Account by entering the bank's real balance and comparing it to the cleared balance, so that I know my records agree with the bank.
108. As the owner, I want a matching balance to lock the Cleared Transactions as Reconciled, so that they can't change by accident.
109. As the owner, I want a difference recorded as one "Reconciliation Adjustment" Transaction, categorized to Ready to Assign by default and editable, so that the Account is corrected in one step.
110. As the owner, I want each Account to show when it was last reconciled, so that I know when to do it again.

### Category management

111. As the owner, I want to create, rename, reorder, and hide Categories and Category Groups, so that the budget fits how I spend.
112. As the owner, I want deleting a Category to move its Transactions, split lines, and Assigned amounts to a Category I choose, so that every month's Available stays exact.
113. As the owner, I want deleting a Category Group to move its Categories to a group I choose first, so that nothing is lost.
114. As the owner, I want Ready to Assign and Credit Card Payment Categories managed by Budge, so that I can't break the budget's structure.

### Export

115. As the owner, I want a full export of my data as CSV and JSON, so that I have a backup and a way out of Convex.
116. As the owner, I want the export to exclude Bank Connection tokens, so that a backup file can't read my bank.

### Phone and PWA

117. As the owner, I want to add Budge to my iPhone Home Screen and open it as a standalone web app, so that it feels like an app without the App Store.
118. As the owner, I want brief in-app instructions for adding it to the Home Screen, so that I remember how (iOS has no install prompt).
119. As the owner, I want a View menu (Budget, All Accounts, each Account) in place of the sidebar on narrow screens, so that the phone layout stays usable.
120. As the owner, I want the budget table to drop Activity below 640 px and the inspector to open inline under the selected Category, so that it fits a phone.
121. As the owner, I want the Transaction table to drop columns as it narrows and move the Category under the Payee, so that rows stay readable from 320 px.
122. As the owner, I want safe-area insets respected and a status bar that suits dark mode, so that nothing hides under the notch.
123. As the owner, I want Budge always to show live data and never a cached copy, so that I never act on stale numbers.

### Look and accessibility

124. As the owner, I want dark and light themes, so that Budge is comfortable at any hour.
125. As the owner, I want both themes to meet WCAG 2.2 AA, with every control labeled and reachable by keyboard, so that the app is accessible.
126. As the owner, I want status, Category, and count labels written as plain text (no badges or pills), headings as plain labels, and sections laid out with headings, whitespace, and dividers, so that the screen is calm and easy to scan.
127. As the owner, I want every chart or progress bar to have a text equivalent, so that the information doesn't depend on seeing it.

### Developing and testing within the free tiers

128. As the developer (owner or agent), I want all day-to-day development and every automated test to run against a local Convex backend or the in-memory `convex-test`, so that they use none of the shared free-tier quota.
129. As the developer, I want automated tests never to call Plaid over the network, so that no test can spend a Plaid Item, hit a rate limit, or touch real bank data.
130. As the developer, I want non-production deployments to use only Plaid Sandbox, so that the 9 remaining Trial Items are used only on purpose.
131. As the developer, I want the cloud dev deployment kept for what local can't do (Plaid webhooks, real-iPhone checks) and capped by a daily function-call limit that pauses it, so that a runaway loop can't use up the team's quota.
132. As the developer, I want Playwright to sign in a pre-created test user on the Clerk development instance, so that test runs never create Clerk users.
133. As the developer, I want preview deployments seeded with a small synthetic budget (about 100 KB), deleted automatically after 5 days, and skipped for docs-only changes, so that previews stay within Convex's quota and 40 deployments and Vercel Hobby's build limits.
134. As the developer, I want the sync cron to do nothing on a deployment with no Bank Connection token, so that previews and the seed never call Plaid.
135. As the developer, I want no test or tool ever pointed at production Convex, so that tests can't damage real data or spend production quota.
136. As the developer, I want an easy way to check free-tier usage (Convex team usage, Vercel usage) and a measured database I/O estimate before launch, so that limits are seen coming, not hit.
137. As the developer, I want a synthetic seed and hand-written fixtures that mirror only the shape of real data, so that tests are realistic without exposing anything real.
138. As the developer, I want a rebuild of monthly totals checked against the incrementally kept totals, so that the cache can never drift from the Transactions.

## Implementation Decisions

### Architecture

- **Stack**: SvelteKit 2 (held at 2.x for `svelte-clerk`), Svelte 5 runes, Bun as the package manager and dev runner, strict TypeScript, Convex Cloud free tier, Clerk, and Vercel Hobby. `convex-svelte` for live subscriptions, bridged to Clerk with `setupAuth()` and `useClerkContext()`. Vercel SSR stays on the Node runtime. (03, 10)
- **One package**, three parts: the SvelteKit app, the Convex backend, and a pure domain module that both import. A lint rule keeps the domain module free of Convex, SvelteKit, Svelte, and browser imports. (10)
- **Effect 4** wherever there is IO, retries, typed failure, or external data: actions, Plaid calls, CSV/QFX decoding, and domain workflows with typed failures. Budget math, queries, simple mutations, SvelteKit server code, and Svelte components stay plain. Convex functions are plain `query`/`mutation`/`action` exports with `v.*` validators; Confect is not used ([ADR 0001](../../docs/adr/0001-plain-convex-not-confect.md), 13, 14).
- **Effect conventions**: one shared `runEffect(program, toPublicError)` helper runs each action or workflow mutation exactly once, building that invocation's layers from its `ctx`. There is no module-global runtime. Services are `Context.Service` classes, each beside its live and test layers: `PlaidClient` (`effect/http` `FetchHttpClient`), `TokenCipher` (AES-GCM, key in Convex env), and `ConvexRunner` (`runQuery`/`runMutation`). Domain and integration errors are `Schema.TaggedErrorClass` classes. `effect` and `@effect/vitest` are pinned to the same exact version, and `@effect/platform` is never installed. (14)

### Domain module (pure)

- **Budget rules**: one deep entry point that, given a month, `today`, the cutover date, Categories with their Targets, Assigned rows, and monthly totals, returns everything the budget screen shows:
  - each Category's Assigned, Activity, and Available, and its Target status ("Funded", "$X more needed", "Overspent by $X")
  - Category Group totals
  - Ready to Assign and the Uncategorized amount it includes
  - each Payment Category's "waiting on" amounts and its card debt not yet covered
  - the Upcoming list (Targets due in the next 30 days, funded or not)

  Callers never assemble these from smaller helpers. (06)
- **Rules it implements** (06):
  - Available = prior Available + Assigned + Activity, with no exceptions, and negatives carry forward.
  - Ready to Assign is global: all Ready to Assign inflows dated on or before `today`, minus everything Assigned in every month. It may go negative.
  - Uncategorized counts exactly as if categorized to Ready to Assign, and on a card that includes the full-amount move.
  - Every categorized card outflow moves its full amount into that card's Payment Category, and a categorized card inflow reverses the move.
  - A card payment (a Transfer from a Cash Account) is Activity in the Payment Category. A Transfer between two Cash Accounts touches no Category.
  - A card's starting debt touches no Category.
  - Split lines follow every rule on their own.
- **Target math** (06):
  - Monthly, refill: still needed = max(0, X − (prior Available + Assigned this month)).
  - Monthly, set aside: still needed = max(0, X − Assigned this month).
  - The due day only places the Target on the Upcoming list; it never changes the amount.
  - By date: still needed = max(0, ⌈(X − prior Available) ÷ months left⌉ − Assigned this month). Months left counts from the viewed month through the due month, inclusive, rounding up to the cent.
  - A repeating By date Target uses date D up to and including D's month, then D + N months, and so on. It is calculated from the first date and the interval; nothing rolls forward in storage.
- **The invariant**: cash in Cash Accounts = Ready to Assign + the sum of every Category's Available (Payment Categories included). (06)
- **Matcher**: one pure function used by sync, file import, and newly mapped Accounts. Given a Bank Row and its candidates, it decides: skip (known import ID in this Account), Match (exactly one candidate), ask (two or more), or new Transaction. A candidate is in the same Account, has the same amount, is dated within 10 days, is uncleared (or, for file rows, already imported by sync), and isn't yet linked to an import from the same source. Each Transaction takes at most one Bank Row. (07)
- **External-data decoders**: Effect Schema decoders for Plaid `/transactions/sync` responses, Capital One CSV, Capital One QFX (with `FITID`), and Discover CSV (purchases positive, so signs are inverted; no IDs). They turn bank data into Bank Rows in whole cents with ISO dates. Pending rows and rows dated before the cutover date are dropped. (02, 07)
- **Money and dates**: whole cents as safe integers, dates as `"YYYY-MM-DD"`, and months as `"YYYY-MM"`. A Transaction's month is the calendar month of its date. (06, 11)

### Convex data model

Built as decided in [What does the data model look like in Convex?](issues/11-data-model.md):

- **Source tables**: `settings` (cutover date), `accounts`, `categoryGroups`, `categories` (with an embedded optional Target: monthly `{amount, mode, dueDay?}` or byDate `{amount, firstDate, everyMonths?}`), `assignments` (one row per month and Category; setting 0 deletes the row), `transactions`, `transactionSplits`, `payees` (with Payee memory), and `payeeRenames` (exact Bank Text → Payee).
- **Sync tables**: `imports` (Bank Rows) with states `linked` / `held` / `changed` / `removed`, `bankConnections` (provider-neutral status, `lastSyncedAt`, `syncLeaseUntil`, `consentExpiresAt?`, and one tagged `provider` field holding the Plaid Item ID, encrypted token, and cursor), and `connectionAccounts` (`mapped` / `held` / `ignored`).
- **Cache**: `monthlyTotals` holds the summed cents per (month, Account, bucket). The bucket is a Category ID, `"uncategorized"`, or `"transfer"`. It is kept in the same mutation that writes a Transaction and can be rebuilt from Transactions. No rule reads it as a source of truth ([ADR 0002](../../docs/adr/0002-monthly-totals-cache.md)).
- **Indexes and search**: indexes as listed in ticket 11. A search index on the denormalized `searchText` (Payee name, memo, split memos, linked Bank Text) has filter fields for Account, Category, and Payee; a date range is applied after the search.
- **Ownership and raw data**: there is no owner column and no `users` table. Raw Plaid payloads are never stored.
- **Ready to Assign and Uncategorized**: Ready to Assign is a system Category in a hidden system group, and each Credit Card Account has a Payment Category in the system `creditCardPayments` group. A Transaction with no Category, not a split, and no Transfer link is Uncategorized.
- **Transfers**: two Transactions pointing at each other, kept consistent in one mutation.

### Convex function surface

- **Owner guard**: every public function calls `requireOwner`, which checks the verified Clerk `subject` and issuer against `BUDGE_OWNER_SUBJECT` and `CLERK_JWT_ISSUER_DOMAIN`, and throws `ConvexError({ code: "FORBIDDEN" })` for anyone else. Scheduled and setup work uses internal functions only. (03, 12)
- **Public errors**: one fixed `ConvexError` payload, `{ code: "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "BANK_CONNECTION_NEEDS_LOGIN" | "BANK_UNAVAILABLE", message? }`, decoded on the client by a shared schema. Defects are not mapped. Mutations fail by throwing. (14)
- **Budget query**: takes the month and `today` as arguments (never `Date.now()`, which defeats query caching). It reads only `categories`, `categoryGroups`, `assignments`, `monthlyTotals`, and `settings`, plus the Ready to Assign and Uncategorized inflows dated after `today` through the Category-by-date index. It returns the domain module's result. (11)
- **Other queries**: Accounts with balances and last-reconciled dates; Uncategorized and Unapproved counts; the paginated Transaction list (by Account and date, by date, or Unapproved first by date, with filters); Transaction search; Transaction detail with its linked Bank Row and Bank Text; held Plaid Accounts; and Bank Connection status. The status query's `returns` validator omits `provider`, so tokens never reach the browser and sync bookkeeping never re-runs the budget read. (11, 15)
- **Mutations**:
  - Budgeting: set Assigned; move money.
  - Transactions: create, edit, and delete (including splits and Transfers); approve; approve all; set Cleared.
  - Matching: pick a Match, Unmatch, link an existing counterpart as a Transfer, and resolve "bank changed/removed".
  - Categories: create, rename, reorder, hide, and delete-with-reassignment for Categories and Category Groups; set or clear a Target.
  - Accounts: create, rename, reorder; confirm a starting balance.
  - Reconciliation: reconcile.
  - Held Plaid Accounts: map, create an Account for, or ignore.
  - Settings: set the cutover date.

  Each mutation that writes Transactions updates `monthlyTotals` and `searchText` in the same transaction. Deleting a Category rebuilds the affected totals.
- **Actions and internal functions**:
  - Sync now (runs a sync and calls `/transactions/refresh`).
  - A Plaid Link update-mode link token for Reconnect, and the post-Reconnect sync.
  - The Plaid webhook HTTP action, which verifies Plaid's signed JWT.
  - A daily cron.
  - One internal apply mutation per sync batch, which writes Bank Rows, Transactions, totals, and the cursor together.
  - `rebuildMonthlyTotals`.
  - `seed:run`.
  - An owner-only internal setup action that encrypts the existing Capital One token through `TokenCipher` and sets the Item's webhook with `/item/webhook/update`. (07, 11, 14, 15)
- **Export**: a function returns every source table, minus `provider` secrets, as JSON. The browser also turns it into CSV per table and downloads it. Neither format includes `monthlyTotals`, because it can be rebuilt. (05; the format split is decided here)

### Sync

- **Triggers**: Plaid's `SYNC_UPDATES_AVAILABLE` webhook, a daily cron for every Bank Connection, and Sync now. (15)
- **One sync at a time per Bank Connection**: a mutation takes `syncLeaseUntil` (about 2 minutes ahead) and releases it when done. The lease expires on its own if an action crashes. A sync started while a lease is held is ignored. (11, 15)
- **Calls to Plaid**: at most three attempts per call, 10 seconds per attempt, and 35 seconds in total. Durable retries go through the Convex scheduler. Errors are typed as `PlaidTransport`, `PlaidTimeout`, `PlaidDecode`, and `PlaidApi` (which carries `error_code`, `status`, and `request_id`). (14)
- **Status**: Plaid error codes map to provider-neutral statuses at the edge. `ITEM_LOGIN_REQUIRED`, revoked consent, and `PENDING_DISCONNECT` set the Bank Connection to needing attention and pause its sync. Short-lived errors retry quietly. (15)
- **Freshness and consent**: the "Synced …" line warns after 48 hours, and the consent-renewal line appears 14 days before `consent_expiration_time`. Notices appear in the app only. (15)
- **Items**: Budge never creates or deletes a Plaid Item, and has no Connect or Disconnect. (15)
- **Bank changes**: `modified` and `removed` from Plaid apply quietly to Unapproved, unedited Transactions. Otherwise the Bank Row is set to `changed` or `removed` (keeping the bank's newest values) and the Transaction is flagged. (07)
- **Unknown Plaid Accounts** (`NEW_ACCOUNTS_AVAILABLE`, or an unknown `account_id`): their rows are held in `imports` against `connectionAccounts` until the owner maps them. After mapping, they run through the matcher as file rows do. (15)
- **Payee and Category for imports**: the Payee comes from rename memory, then `merchant_name`, then Bank Text. The Category comes from Payee memory, or the Transaction arrives Uncategorized. `personal_finance_category` is ignored. (07)

### File import (new decision on where parsing runs)

- The owner picks a file and the destination Account. The browser parses the file with the shared domain decoders, called as a plain async function from a `.ts` module, not from a component. There is no upload endpoint, and the file is never stored.
- The decoded Bank Rows go to a preview query, which runs the matcher and returns rows marked new, matched, needs-pick, or duplicate. Saving sends the rows to one commit mutation. That mutation validates them again with `v.*` and runs the matcher again, never trusting the preview, then applies them in one transaction.
- File rows use `source` `qfx` or `csv`. QFX `FITID` becomes the import ID, scoped to the Account. CSV rows have no import ID, so duplicates are caught by the matcher.

### UI

- **Layout**: variant A from the prototype ([What does the budget screen look like on desktop and phone?](issues/09-budget-screen.md)).
  - At 1024 px and wider: three columns. The sidebar holds Budget, All Accounts with its Unapproved count, Accounts grouped as Cash and Credit with balances, and the per-Bank Connection freshness line. Then the budget table, then the inspector with the Upcoming list below it.
  - Narrower than 1024 px: a View menu replaces the sidebar, and the inspector opens inline under the selected row.
  - Below 640 px: the table drops Activity.
  - The Transaction table drops columns as width shrinks.
- **Notices above the budget table**: the reconnect notice, the negative Ready to Assign warning, and the Uncategorized and Unapproved counts.
- **Shared state**: shared UI state lives in context-provided classes in `.svelte.ts` modules. For example, `BudgetMonth` holds the selected month, its query, and Ready to Assign. There are never module-level `$state` singletons, and no Effect runs in components. (14)
- **Visual rules** (map Notes):
  - shadcn-svelte components and semantic HTML.
  - No badges or pills, and no taglines.
  - Cards only for compared items.
  - Theme color tokens, WCAG 2.2 AA in dark and light.
  - Visible labels and keyboard paths, and text equivalents for progress bars.
  - Responsive from 320 px.
  - `@shadcn/lint` passes.
- **PWA**: a manifest only (`id`, `name`, `start_url`, `scope`, `display: standalone`, colors), 192/512 icons, a 180×180 `apple-touch-icon`, `viewport-fit=cover` with safe-area insets, and in-app Add to Home Screen instructions. There is no service worker, and Convex and Clerk traffic is never cached. Budget data is never prerendered or CDN-cached. (04)

### Environments, deployment, and free-tier limits

- **Deployments**: production is `budge.lomzem.dev`, with production Convex, a Clerk production instance (GitHub OAuth through the owner's own OAuth app, Invite-only), and Plaid Trial. Everything else pairs a Convex deployment with the Clerk development instance and Plaid Sandbox. (10, 12)
- **Quota and secrets**: Convex's free tier allows 1M function calls a month, 0.5 GB of storage, 1 GB of database I/O a month, and 40 deployments. Production, the cloud dev deployment, and previews share that quota, and writes fail once a limit is hit. Database I/O is the limit at risk; the design estimate is about 70 MB a month in year 1 and about 340 MB in year 5. (11, 12) Secrets live only in Convex env and Vercel env, and the repo holds a names-only `.env.example`. (10)
- **Free-tier rules for development and testing** (the owner's requirement; items marked *new* are decided here):
  - Every automated test (Vitest and Playwright, locally and in CI) runs against the in-memory `convex-test` or a Convex **local deployment**, whose function calls and bandwidth don't count against plan quotas. No hook, CI job, or agent session targets a cloud deployment, and production is never a test target. (10)
  - The cloud dev deployment is used only for Plaid Sandbox webhooks and real-iPhone checks, and has a daily function-call usage limit set in the Convex dashboard that pauses it. (10)
  - No automated test makes a network call to Plaid. Effect workflows use the `PlaidClient` test layer, and Convex tests replace the action's layers the same way. Manual Sandbox checks use the cloud dev deployment. Production Plaid Items are never created by the app or by tests. (14, 15, 10)
  - Playwright signs in with `@clerk/testing` as one test user created once by hand on the Clerk development instance. Tests never sign up users or create Clerk users. *(new)*
  - Preview deployments are allowed only while they stay within the free tiers, and can be turned off without app changes. Each one loads the roughly 100 KB synthetic seed through `--preview-run` and is deleted after 5 days. A Vercel Ignored Build Step skips builds, and so skips creating a Convex preview deployment, when a push changes only `.scratch/**`, `docs/**`, or Markdown files. This protects Vercel Hobby's 100 deployments a day and one concurrent build, and Convex's 40 deployments. *(new: the ignored build step)* (12)
  - `seed:run` refuses to run when any Account exists or when the production flag is set. It creates a Sandbox-kind Bank Connection with no token. The daily cron and the webhook return at once for a Bank Connection with no token, so previews and local backends never call Plaid. *(new: the cron's early return)* (11)
  - Playwright runs only in CI, once per push, never in a git hook. It runs a few smoke tests against the seeded local backend. GitHub Actions minutes are free for this public repo on standard runners. (10)
  - CodeRabbit stays on its free public-repo plan. A rate-limit or "review skipped" message is neither a review nor an approval: the agent waits out the window and re-requests with `@coderabbitai review`. (10)
  - Before launch, measure real document sizes with `getDocumentSize` on the seed and confirm the I/O estimate. After the first month, check Convex's team usage page. If I/O ever tightens, a yearly Available checkpoint (another rebuildable cache) can be added. (11)

### Repo and workflow

Set up as decided in [How is the repo set up?](issues/10-repo-setup.md):

- **Pins**: exact pins with a committed `bun.lock`.
- **Lint**: strict TypeScript flags, and ESLint `strictTypeChecked` plus Svelte, Convex, and domain-purity rules. `@shadcn/lint` runs as `bun run lint:ui`.
- **Format**: Prettier with the Svelte and Tailwind plugins.
- **lefthook**: pre-commit runs Prettier, ESLint, `@shadcn/lint`, and `gitleaks git --staged`; pre-push runs the full typecheck (with `@effect/language-service` diagnostics) and `bun run test`.
- **Branches and CI**: every ticket from 02 onward is a branch and a PR into `main`, reviewed by CodeRabbit and squash-merged. Everything else (docs, `.scratch/`, ticket 01, small fixes outside a ticket) is committed straight to `main`; when unsure, open a PR. `main` has no branch protection, so the rule lives in `AGENTS.md`. One CI workflow runs on every PR and every push to `main`. CodeRabbit is configured in `.coderabbit.yaml` and skips Renovate's PRs, and Renovate runs weekly with grouped updates and no auto-merge.
- **Secrets and data**: gitleaks has custom rules for Plaid and Clerk secrets, and GitHub push protection is on. Bank export file types are gitignored except synthetic fixtures.
- **Scaffolding** adds a "Pull requests" section to `AGENTS.md` with the PR rule and the CodeRabbit merge rule.

## Testing Decisions

- **What makes a good test**:
  - It drives behavior through a public seam and asserts on what the owner would see or what the seam returns, never on internal helpers, call order, or table layout.
  - It uses synthetic data with invented payees and amounts that mirror only the shape of real data.
  - It names domain concepts in `GLOSSARY.md` terms.
  - It doesn't repeat a proof another test already makes.
  - Agents call the `test-audit` skill whenever they write, change, or review tests.
- **Seam 1, primary: the public Convex function API**, tested with `convex-test` (edge runtime) and an owner identity. Most user stories are proved here by calling queries, mutations, actions, and the webhook HTTP action, then reading results back through public queries. This covers:
  - Budget-screen numbers after real sequences of edits.
  - Card moves, Transfers, and splits.
  - Category deletion and reassignment.
  - Reconciliation locking and the adjustment Transaction.
  - Import idempotence: the same sync batch or file twice gives no duplicates; held Accounts.
  - The matcher's outcomes in context: Match, ask, Unmatch, and bank changed/removed.
  - The sync lease.
  - Rollback when a mutation throws.
  - The owner guard: a non-owner and an anonymous caller get `FORBIDDEN` from every public function.
  - The Bank Connection status query never returns `provider`.
  - `rebuildMonthlyTotals` equals the incrementally kept `monthlyTotals` after any sequence of writes, as ADR 0002 requires.
  - `seed:run` succeeds on an empty deployment and refuses on a non-empty one.
- **Seam 2: the pure domain module**, plain Vitest, test-first (`/tdd`). It proves the budget rules and Target math through the single budget entry point, and the matcher's decision rules, with tables of cases. These include the worked examples from ticket 06 (Groceries $30 with a $50 card purchase; $139 by March 3, viewed in November → $27.80). The cash invariant (Ready to Assign + sum of Available = cash) is checked across generated edit sequences. The external-data decoders are tested here against synthetic fixture files for Capital One CSV, Capital One QFX, Discover CSV (sign inversion), and Plaid sync responses (pending and pre-cutover rows dropped).
- **Seam 3: the external boundary**, `@effect/vitest` `it.effect` with test layers and TestClock. `PlaidClient` and `TokenCipher` are the only faked dependencies. Tests cover retry limits and timeouts, mapping Plaid error codes to provider-neutral statuses, token encryption round-trips, and the guarantee that logs and errors never carry tokens or bank responses.
- **Seam 4: Playwright smoke tests**, in CI only, against a seeded local backend, signed in as the one Clerk dev test user. They cover sign-in; the budget screen rendering Ready to Assign and a group; inline Assigned editing; approving a Transaction; and the phone layout at 320 px showing the View menu.
- **No other seams**: no component unit tests, and no tests of per-table helpers or private functions.
- **Free-tier guardrails in tests**: none of the four seams talks to a cloud Convex deployment, Plaid's network, or Clerk user creation. A test that needs any of them is wrong by design.
- **Prior art**: none in the repo yet, since this is a new codebase. Follow `convex-test`'s documented `t.withIdentity` and `t.run` patterns, and `@effect/vitest`'s `it.effect` with `Layer` test doubles. The first tests written at each seam become the prior art for the rest.
- **Manual checks before launch** (not automated): on a real iPhone against production, check Home Screen install, GitHub sign-in inside the Home Screen app, weekly re-sign-in, and token refresh after time in the background. Also run one Plaid Sandbox webhook round-trip on the cloud dev deployment. (04, 12)

## Out of Scope

- Scheduled (placeholder) Transactions.
- Reports. They read data v1 already stores, so they can be added later without changing it.
- Full Payee rules (pattern-based rename and categorize).
- Off-budget tracking Accounts (401(k), loans), loan and mortgage Accounts, and closing Accounts.
- Age of Money, flags and colors, Category notes, multiple budgets, undo history, and bulk editing.
- Automatic Transfer detection.
- Pending Transactions.
- Creating or deleting Plaid Items in the app (no Connect or Disconnect).
- SimpleFIN Bridge. It is the fallback if Plaid Trial ends, added as a provider branch plus a service.
- YNAB import (never). Native iOS app. Multi-user, sharing, and external customers. Multi-currency.
- Offline support and any service worker. Email or push notifications.
- Paid plans of any kind: Clerk Pro (custom session length, MFA, passkeys), Convex paid tiers, Vercel Pro, and Plaid paid Production.
- Confect, until reconsidered after the first deployed Bank Connection slice ([ADR 0001](../../docs/adr/0001-plain-convex-not-confect.md)).

## Further Notes

- **Plaid Trial is one-way**: submitting a paid Production application ends Trial for good, so never submit one unless leaving Trial is intended. One Capital One Item exists, and about 9 of 10 lifetime Items remain. If update mode can't repair the Item, relink through the private Quickstart outside the repo and re-run the setup action.
- **Private material** stays in `~/budge-private/`, never the repo, and nothing from it may be copied into fixtures, snapshots, tickets, or PRs. That includes Plaid credentials, the existing access token, raw captures, and redacted structural samples.
- **The design's I/O headroom** (about 3× under the limit in year 5) depends on the `monthlyTotals` cache and on reading by month through indexes. Any query that `.collect()`s the full Transaction history breaks that budget and should be rejected in review.
- **Copy YNAB by default**: any behavior not covered here copies YNAB. A deliberate difference needs an ADR or a spec change.
