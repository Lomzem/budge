# Settings and cutover date

Choose the date Budge begins accounting and prevent history from being cut off by later changes.

## Sub-features

- `cutover-first`, `cutover-change`, `cutover-cancel`, `cutover-invalid`: first use and date constraints.
- `cutover-default`: an unset cutover date proposes the first day of the current local month; the card explains that earlier bank transactions aren't brought in.
- `cutover-later-preview`: saving a date later than the saved one opens a read-only dialog named `Start on <date>?` instead of saving. It lists each Account's proposed Starting Balance on the new date with the Transactions that fold into it, what must be resolved first (bank changes, Transfers whose sides straddle the date, a Starting Balance dated after it), the new first month's Ready to Assign and changed Available (Now/After) with the Assigned amounts that go, and cautions (reconciled, uncleared, from a bank account now feeding another Account). Unsupported dates (not later, after today with Transactions before it, more than 250 Transactions, 250 bank rows or split lines, or 500 Assigned amounts before it) explain why. There is no Apply yet; Cancel, Escape and the close button change nothing and return focus to the date field. With nothing dated before the new date, `Move start date` saves it.

## How to get to it (user POV)

- `Settings` Section (`/settings`) → `Cutover date` region; a configured budget offers Change.
- First sign-in on an empty budget: the Budget shows the same Cutover date setup card, and keeps it on screen after the first save (it doesn't vanish under the pointer) until the next visit.
- Bank page (`/bank`) with no cutover date: the same card sits above Connections (after the page notice, which asks for the date when Plaid is set up), and stays after the save until the next visit.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/settings.ts`, also run by `bun run test:e2e:local`):

- `settings/start` (empty-budget): under a fixed browser clock in the journey zone (America/Los_Angeles), at 2026-11-01T06:59Z (October 31 locally, November 1 in UTC) the Budget proposes 2026-10-01 and at 07:01Z the Bank page proposes 2026-11-01; saving it there (focus moves to Change) and importing a bank file into a new Account previews and imports only the 2026-11-01 row (the 2026-10-31 row never appears), leaving `Accounts 1 Unapproved`. A month worked out in UTC fails the first step on every machine.
- `settings/cutover` (empty-budget): before a date there is no Cancel and the sidebar's Add Account points to Budget; the first date saved on the Budget shows in Settings after a reload, when the Budget's card is gone; a cancelled change keeps the date and a saved one moves it; Previous month stops at the cutover month; a later date with nothing dated before it opens its preview, whose `Move start date` saves it and returns focus to Change.
- `settings/later-start` (budget-with-accounts): moving the date to the first of this month opens the preview (no Apply), showing the three Accounts' sections, a Checking Transaction list, and the month's Ready to Assign; Cancel and Escape close it with focus back in the date field and the saved date unchanged after reload; tomorrow's date explains it has no preview yet. Halfway down the preview at desktop width its Cancel button is wholly on screen (the sticky dialog footer stays inside the scroll area); at 320 px with every Account's list open, `expectNothingPastTheRightEdge` finds nothing past the screen or hidden past a box's right edge. The numbers are proven in `convex/settings.test.ts`, not here.

Drive by hand: pre-cutover manual Transactions and file rows (see Constraint below).

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **First use:** seed empty-budget, navigate `/`; scope `page.getByRole("region", { name: "Cutover date", exact: true })`; the input is `getByLabel("Cutover date")`. The date field proposes the first of the current month (`settings/start`); fill Date with an invented current ISO date, Save; require Budge starts on date and ability to create an Account. Reload and verify saved date. Before setup, Add Account directs to the Budget screen to set the cutover date. Cancel appears only when a cutover date already exists.
- **Change/cancel:** on `/settings`, Change, Date = earlier valid date, Cancel; require original date. Repeat and Save; require new date after reload. Change moves focus into the date field; Cancel, Escape and a successful Save return it to Change (`settings/cutover`).
- **Constraint:** moving the cutover later now opens the preview (`settings/later-start`); `setCutoverDate` still refuses a later date with Transactions before it (`convex/transactions.test.ts`, not reachable from the UI). Manually save a Transaction before cutover and require refusal. Import a file with earlier rows and require them filtered before preview; an all-earlier file says `Nothing in this file is dated on or after the cutover date.` (manual drive).

## Gotchas

- At the cutover month, `Previous month` is disabled.
- Settings also holds Theme, Your data (Export…) and This device (Add to Home Screen, Sign out); see `shell.md`, `export.md`, `auth.md`.
- Sources: ticket 03, 05, 23, first-use-ux 01, 03, 04; public `settings.get/setCutoverDate/previewLaterCutover/applyLaterCutover/lastMove/undoLaterCutover`. Real production setup in ticket 23 is owner work and outside this local proof.
