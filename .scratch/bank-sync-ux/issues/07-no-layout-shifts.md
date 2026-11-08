# 07: No layout shifts

**Status:** in progress

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

- [ ] Every journey passes with the guard, at desktop and phone widths.
- [ ] The guard reports which elements moved, on which page, and by how much.

## Comments
