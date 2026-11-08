# 07: No layout shifts

**Status:** done

**Spec:** [Bank sync and UI/UX](../spec.md), Constraints

**Blocked by:** None. Tickets 02–06 meet it as they land.

## Problem

The owner hates layout shifts. A baseline run of all 37 journeys with the shift guard (2026-11-08, before the redesign) found unprompted shifts in 32 of them:

- Budget on load: the Cutover date section, Add Account and the menu move down as the Budget's sections and the Bank Connections list arrive (0.037), and the Categories section moves when the "needs a Category" line arrives (0.002–0.025).
- Registers: column widths change as rows arrive (up to 0.146 on All Accounts), and rows move when a Transaction saves.
- Dialogs: the footer moves when async fields load (Transaction, import preview), and the split dialog's direction and amount fields move when its status line changes.
- Export: the download buttons move when a file is prepared.

## What to build

- Every journey fails on a layout shift without recent user input. The guard runs in both `bun run test:e2e:local` and `bun run app verify`, and no journey can opt out.
- Pages render their loaded layout from the first frame: loading states reserve each section's final size; tables use fixed layouts; status lines keep their slot; labels that swap keep their width.
- The web font has a metric-matched fallback, so the swap never reflows.

## Acceptance

- [x] Every journey passes with the guard, at desktop and phone widths.
- [x] The guard reports which elements moved, on which page, and by how much.

## Comments

- All 35 journeys pass with the guard (verify run `r5`, 2026-11-08). Phone widths are covered by `shell/phone-pages` (every Section and a register at 390 px, loaded and scrolled), `search/phone`, `transactions/approve-phone`, `shell/navigate` (320 px), and the phone steps in `categories/manage` and `inspector/move-money`.
- Shift sources fixed in this ticket's last pass:
  - The register's Loading and empty-state row spanned seven or eight columns inside a fixed-layout table and set phantom column widths. It now renders under the table.
  - The Approve all icon moved when its count arrived. Its label now has a fixed minimum width and is left-aligned.
  - Dialogs anchor to the top (`top-4`, `sm:top-16`), so a dialog whose content grows extends downward instead of re-centering.
  - The tab bar's label now comes before its badge in the DOM, so the Accounts tab reads "Accounts, 3 Unapproved" (it read ", 3 Unapproved Accounts").
- Guard changes:
  - Playwright's `fill` and `selectOption` don't set `hadRecentInput`, so the guard also treats shifts within 500 ms of an `input` or `change` event as user-caused.
  - Each report names the moved element (or its nearest labeled ancestor) with its rect before and after.
- Journeys updated for the redesign:
  - Dialogs keep an empty alert slot, so "no alert" checks look for non-empty text.
  - The Plaid journeys expect `Bank sync isn't set up on this server.` on a server without credentials (ticket 01).
  - `plaid/late-sync` holds both syncs, because a held response stalls the socket.
  - `settings/cutover` reaches the gate from the sidebar's Add Account.
- Deferred: rows a background sync inserts at the top of a register move the rows below. That is a data change, not a page shift, and no journey triggers it.
