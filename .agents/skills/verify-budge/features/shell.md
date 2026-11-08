# Navigation, theme and Home Screen

Navigate between budgeting views, retain theme choice, and expose iPhone installation guidance.

## Sub-features

- `shell-nav`: sidebar/mobile View menu and direct routes.
- `shell-theme`: System/Light/Dark persistent choice.
- `shell-install`: guidance dialog; real standalone iPhone resume/auth.

## How to get to it (user POV)

- Sidebar on desktop, View menu on phone, Menu on both.
- Menu → Add to Home Screen when not already standalone; Theme choices inside Menu.

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/shell.ts`, also run by `bun run test:e2e:local`):

- `shell/navigate`: Budget landing, the sidebar, and the 320 px View menu back to the Budget (`shell-nav`).

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Navigate:** from Budget choose All Accounts and named Accounts through sidebar; repeat through mobile View menu at 320 px and direct routes. Require correct heading, active item and no horizontal overflow. Follow Categories link from Budget.
- **Theme:** open Menu, choose `getByRole("menuitemradio", { name: "Dark", exact: true })`, capture; reload, require selected theme and readable contrast. Repeat Light and System, change OS color-scheme preference for System, require app follows it. Check viewport sizes and focus visibility.
- **Guidance:** Menu → Add to Home Screen; require dialog title and Safari Share/Add/Open as Web App steps, dismiss and restore focus. On a real iPhone separately install, verify standalone launch, GitHub/email auth, live data after background/resume, 7-day session renewal, safe areas and light/dark status bar.

## Gotchas

- Desktop Chromium mobile emulation does not prove iOS installation, safe areas, standalone auth or resume. No real-device proof in this run.
- Sources: tickets 02, 04, 23; `e2e/journeys/shell.ts`; no additional public Convex API. Deployment/CI and capacity measurements in 01/04/23 are operational prerequisites, not UI paths; they remain outside local verification.
