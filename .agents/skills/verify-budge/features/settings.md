# Settings and cutover date

Choose the date Budge begins accounting and prevent history from being cut off by later changes.

## Sub-features

- `cutover-first`, `cutover-change`, `cutover-cancel`, `cutover-invalid`: first use and date constraints.

## How to get to it (user POV)

- Budget `/` → Cutover date section; first sign-in empty-budget shows date setup; configured budget offers Change.

## Driving it with Playwright

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **First use:** seed empty-budget, navigate `/`; scope `page.getByRole("region", { name: "Cutover date", exact: true })` after confirming the current ARIA structure. Fill Date with an invented current ISO date, Save; require Budge starts on date and ability to create an Account. Reload and verify saved date.
- **Change/cancel:** section Change, Date = earlier valid date, Cancel; require original date. Repeat and Save; require new date after reload.
- **Constraint:** with a Starting Balance Transaction on cutover, try moving cutover after its date. Require visible error and saved date unchanged; create a pre-cutover Transaction/import separately and require refusal or documented dropping of imported rows.

## Gotchas

- No separate settings route; Date labels elsewhere require scoping to Cutover date. Inspect the section selector before use rather than assuming a settings page.
- Sources: ticket 03, 05, 23; public `settings.get/setCutoverDate`. Real production setup in ticket 23 is owner work and outside this local proof.
