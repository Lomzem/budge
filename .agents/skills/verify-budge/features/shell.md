# Navigation, theme and standalone iPhone

Navigate between budgeting views and retain theme choice.

## Sub-features

- `shell-nav`: four Sections (Budget, Transactions, Bank, Settings) in the desktop sidebar and the phone tab bar; direct routes.
- `shell-theme`: `Match this device`/Light/Dark persistent choice on Settings (radiogroup `Theme`); without a stored choice it follows the device.
- `shell-install`: standalone iPhone launch, resume and auth.
- `shell-stable`: no layout shift on any page at desktop or phone width.

## How to get to it (user POV)

- Desktop (`lg` and up): the `Sections and Accounts` sidebar lists the Sections, then each Account under its Cash/Credit group with balances; `Add Account` sits beside the Accounts heading.
- Phone: the `Sections` tab bar at the bottom. Transactions lists the Accounts as a `nav` named `Accounts` above `All Accounts`, inside the `Your Accounts` disclosure (collapsed unless opened before; arriving with a query string forces it closed); an Account page keeps the Transactions tab current (`aria-current="true"`).
- Badges: Transactions shows the Unapproved count, Bank the things that need the owner. Screen readers hear `Transactions 3 Unapproved`.
- Settings → `Theme` radio group.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/shell.ts`, also run by `bun run test:e2e:local`):

- `shell/navigate`: Budget landing, every sidebar Section, a wheel over the Budget table and the sidebar scrolling the page, then the 320 px tab bar to every Section and an Account (`shell-nav`).
- `shell/phone-pages`: at 390 px, every Section and the Checking register load and take a large scroll (`shell-stable`); the journey does not assert the end was reached.

Every journey runs under the layout-shift guard (`e2e/journeys/layoutShift.ts`): a shift fails the journey and names the elements that moved unless it comes within 500 ms of input, or while a request sent within 500 ms of input is pending and up to 500 ms after its result arrives (a mutation once the page has synced its commit, a new query once its first result lands). Background updates and page loads with no input still fail. It watches the `WebSocket` the page uses, so a journey's `routeWebSocket` (as in `e2e/heldResponse.ts`) does not hide held requests or forged answers from it.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Navigate:** require the heading, `aria-current="page"` on the Section, and no horizontal overflow at 320 px.
- **Theme:** on `/settings`, choose `getByRole("radio", { name: "Dark" })`, capture; reload, require the choice kept and readable contrast. Repeat Light and `Match this device`; change the OS color-scheme preference for `Match this device` and require the app follows it. Check focus visibility.
- **Standalone iPhone:** install from Safari’s Share menu. Verify standalone launch, GitHub/email auth, live data after background/resume, 7-day session renewal, safe areas and light/dark status bar.

## Gotchas

- **Load:** a hard load of any Section paints the sidebar (or the phone tab bar) with the Sections at once, with `Loading…` in the page area; the Accounts list and badges join when the owner check finishes. Only a forbidden account or an unreachable server shows the centered Budge screen.
- **Focus after a dialog:** closing any dialog focuses what opened it (for a dialog opened from a menu item, the menu's trigger), else the destination its page names (each feature file lists them), else `#main`; focus on `<body>` after a dialog closes is a bug. When another dialog stays open beneath it, focus stays inside that dialog: on its opener, destination or fallback when inside it, else its first focusable control.
- **Manual drive:** keyboard-activate `Skip to content` and require focus on `#main`. In the sidebar, verify the Unapproved and Bank badges, Cash/Credit group totals and each Account balance against the `Your Accounts` disclosure at phone width.

- Desktop Chromium mobile emulation does not prove iOS installation, safe areas, standalone auth or resume. No real-device proof in this run.
- Sources: tickets 02, 04, 23; `e2e/journeys/shell.ts`; no additional public Convex API. Deployment/CI and capacity measurements in 01/04/23 are operational prerequisites, not UI paths; they remain outside local verification.
