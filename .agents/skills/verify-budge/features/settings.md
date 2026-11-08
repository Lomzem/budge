# Settings and cutover date

Choose the date Budge begins accounting and prevent history from being cut off by later changes.

## Sub-features

- `cutover-first`, `cutover-change`, `cutover-cancel`, `cutover-invalid`: first use and date constraints.

## How to get to it (user POV)

- `Settings` Section (`/settings`) → `Cutover date` region; a configured budget offers Change.
- First sign-in on an empty budget: the Budget shows the same Cutover date setup card, and keeps it on screen after the first save (it doesn't vanish under the pointer) until the next visit.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/settings.ts`, also run by `bun run test:e2e:local`):

- `settings/cutover` (empty-budget): before a date there is no Cancel and the sidebar's Add Account points to Budget; the first date saved on the Budget shows in Settings after a reload, when the Budget's card is gone; a cancelled change keeps the date and a saved one moves it; Previous month stops at the cutover month; moving the date past a Starting Balance shows `A Transaction is dated before that.` and keeps the saved date.

Drive by hand: pre-cutover manual Transactions and file rows (see Constraint below).

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **First use:** seed empty-budget, navigate `/`; scope `page.getByRole("region", { name: "Cutover date", exact: true })`; the input is `getByLabel("Cutover date")`. Fill Date with an invented current ISO date, Save; require Budge starts on date and ability to create an Account. Reload and verify saved date. Before setup, Add Account directs to the Budget screen to set the cutover date. Cancel appears only when a cutover date already exists.
- **Change/cancel:** on `/settings`, Change, Date = earlier valid date, Cancel; require original date. Repeat and Save; require new date after reload. Change moves focus into the date field; Cancel and a successful Save return it to Change.
- **Constraint:** with a Starting Balance Transaction on cutover, try moving cutover after its date. Require visible error and saved date unchanged; manually save a Transaction before cutover and require refusal. Import a file with earlier rows and require them filtered before preview; an all-earlier file says `Nothing in this file is dated on or after the cutover date.` (manual drive).

## Gotchas

- At the cutover month, `Previous month` is disabled.
- Settings also holds Theme, Your data (Export…) and This device (Add to Home Screen, Sign out); see `shell.md`, `export.md`, `auth.md`.
- Sources: ticket 03, 05, 23; public `settings.get/setCutoverDate`. Real production setup in ticket 23 is owner work and outside this local proof.
