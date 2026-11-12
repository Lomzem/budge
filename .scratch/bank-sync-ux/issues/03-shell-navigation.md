# 03: Shell and navigation at every width

**Status:** done

**Spec:** [Bank sync and UI/UX](../spec.md)

**Blocked by:** 02

## What to build

See the spec scope item.

## Comments

- Landed: five Sections (Budget, Accounts, Bank, Categories, Settings) in `src/lib/views.ts`. The desktop sidebar lists them above the Account groups. The phone tab bar `Sections` shows the same five at the bottom, with Unapproved and Bank badges.
- The view menu and app menu are gone. Export, theme, Add to Home Screen, the cutover date and sign out now live on `/settings`.
- `/accounts` has the h1 `Accounts`, a net balance, Add Account, and a phone list of Accounts grouped like the sidebar.
- Still open: the journeys and feature map catch up in ticket 07.
