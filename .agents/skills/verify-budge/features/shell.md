# Navigation, theme and Home Screen

Navigate between budgeting views, retain theme choice, and expose iPhone installation guidance.

## Sub-features

- `shell-nav`: five Sections (Budget, Accounts, Bank, Categories, Settings) in the desktop sidebar and the phone tab bar; direct routes.
- `shell-theme`: System/Light/Dark persistent choice on Settings.
- `shell-install`: guidance dialog; real standalone iPhone resume/auth.
- `shell-stable`: no layout shift on any page at desktop or phone width.

## How to get to it (user POV)

- Desktop (`lg` and up): the `Sections and Accounts` sidebar lists the Sections, then each Account under its Cash/Credit group with balances; `Add Account` sits beside the Accounts heading.
- Phone: the `Sections` tab bar at the bottom. Accounts lists the Accounts as a `nav` named `Accounts` above All Transactions; an Account page keeps the Accounts tab current (`aria-current="true"`).
- Badges: Accounts shows the Unapproved count, Bank the things that need the owner. Screen readers hear `Accounts, 3 Unapproved`.
- Settings → Theme radio group; Settings → This device → `Add to Home Screen` (only when not already standalone).

## Driving it with Playwright

Journeys (`bun run app verify <name>` reseeds the journey's fixture, drives it, and keeps its evidence; the source is `e2e/journeys/shell.ts`, also run by `bun run test:e2e:local`):

- `shell/navigate`: Budget landing, every sidebar Section, then the 320 px tab bar to every Section and an Account (`shell-nav`).
- `shell/phone-pages`: at 390 px, every Section and the Checking register load and scroll to the end (`shell-stable`).

Every journey runs under the layout-shift guard (`e2e/journeys/layoutShift.ts`): a shift not caused by recent input fails the journey and names the elements that moved.

The recipes below cover what the journeys leave out.

Preconditions:

- Authenticated baseline from the index; reseed before independent mutations.

- **Navigate:** require the heading, `aria-current="page"` on the Section, and no horizontal overflow at 320 px. Follow `Manage Categories` from the Budget (manual drive beyond the journey).
- **Theme:** on `/settings`, choose `getByRole("radio", { name: "Dark" })`, capture; reload, require the choice kept and readable contrast. Repeat Light and System; change the OS color-scheme preference for System and require the app follows it. Check focus visibility.
- **Guidance:** Settings → Add to Home Screen; the dialog's steps follow the device: on iPhone/iPad Safari (title `Add to Home Screen`, Share/Add/Open as Web App), on Android Chrome (`Add to Home Screen`, menu → Add to home screen → Install), elsewhere (title `Install Budge`, Chrome/Edge install). Require the title and steps for the emulated device, dismiss and restore focus. On a real iPhone separately install, verify standalone launch, GitHub/email auth, live data after background/resume, 7-day session renewal, safe areas and light/dark status bar.

## Gotchas

- **Load:** a hard load of any Section paints the sidebar (or the phone tab bar) with the Sections at once, with `Loading…` in the page area; the Accounts list and badges join when the owner check finishes. Only a forbidden account or an unreachable server shows the centered Budge screen.
- **Manual drive:** keyboard-activate `Skip to content` and require focus on `#main`. In the sidebar, verify the Unapproved and Bank badges, Cash/Credit group totals and each Account balance against the Accounts page.

- Desktop Chromium mobile emulation does not prove iOS installation, safe areas, standalone auth or resume. No real-device proof in this run.
- Sources: tickets 02, 04, 23; `e2e/journeys/shell.ts`; no additional public Convex API. Deployment/CI and capacity measurements in 01/04/23 are operational prerequisites, not UI paths; they remain outside local verification.
