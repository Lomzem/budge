# Bank sync you can find, and a Budge that feels designed

Status: in progress

Source: user request, 2026-11-08. Bank sync "doesn't work, or the UX is so bad I don't know how to use it". The user also asked for a complete UI/UX overhaul covering typography, color, spacing, WCAG, a11y, layout, navigation, efficiency, and satisfaction. Old specs and tickets don't bind this work (user, 2026-11-08).

## What is broken

- Production has a Capital One Bank Connection that syncs, but its 3 bank accounts are held. The only way to set them up is a small "New bank Accounts" link in the desktop sidebar footer. Phones can't reach it at all. No transactions arrive.
- Budge has no way to connect a bank from the app. `bankConnections.setup` is internal, and the one Item was linked by hand.
- When Plaid credentials are missing, every bank action says "Couldn't reach the bank", which reads as an outage rather than missing setup.
- The UI is stock shadcn grayscale. Budget stacks five unrelated notices above the table, and phones navigate through a "View" dropdown.

## Scope

1. **Connect a bank** ([01](issues/01-connect-a-bank.md)). Add public `connect` and `finishConnect` actions (create-mode link token, public token exchange, accounts recorded with a suggested kind) and a `service` query that reports whether bank sync is configured.
2. **Design system** ([02](issues/02-design-system.md)). Ledger tokens, the Atkinson Hyperlegible Next type scale, and restyled primitives.
3. **Shell and navigation** ([03](issues/03-shell-navigation.md)). A sidebar with sections, a bottom tab bar on phones, and Bank and Settings pages.
4. **Bank page** ([04](issues/04-bank-page.md)). Connections, Connect a bank, and guided setup for new bank accounts, reachable at every width.
5. **Budget screen** ([05](issues/05-budget-screen.md)). The Ready to Assign ledger total, one "Needs you" list, and the table.
6. **Accounts, Categories, dialogs, sign-in** ([06](issues/06-registers-and-dialogs.md)). Registers, filters, empty states, and dialogs on the new system.

## Design plan

**Subject.** Budge is a one-person zero-based budget. Its owner opens it on a laptop and as an iPhone PWA to give every dollar a job, approve what the bank sent, and fix overspending. Its world is the accountant's ledger: columnar pads ruled in green, red ink for what's owed, and the double rule under a final total.

**Palette.** One ledger-green family carries the brand. Red ink and ochre are status colors only.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| paper | `#F3F6F1` | `#0F1713` | page background, a faint ledger-pad green |
| sheet | `#FFFFFF` | `#16211B` | tables, dialogs, raised surfaces |
| ink | `#17242C` | `#E4ECE6` | text |
| ledger | `#1E6847` | `#73CC9C` | primary action, funded, the double rule |
| rule | `#D3DFD5` | `#2A3B32` | grid lines and borders |
| red ink | `#B3261E` | `#FF8F86` | overspent, negative, destructive |
| ochre | `#875800` | `#EDB759` | needs you: unapproved, held, reconnect |

Every text pairing meets 4.5:1 and every control boundary meets 3:1 (checked in ticket 02).

**Type.** One family: Atkinson Hyperlegible Next (variable 200–800), the Braille Institute's legibility face. Its tabular figures (`tnum`) set every amount, so columns of money line up digit for digit. The scale is a 1.2 ratio from a 16 px base: 13.3 · 16 · 19.2 · 23 · 27.6 · 33 · 40 (display, Ready to Assign only). Body text is 400 weight, labels and row names 500, headings 700. Text is sentence case with no all-caps labels. Body line length stays under 70ch.

**Layout.** Everything is left aligned and amounts are right aligned in their columns. Desktop has a 15rem sidebar, a content column up to 72rem, and an inspector on the right of Budget at `xl`. Phones get a top bar with the page title and month, a bottom tab bar (Budget, Accounts, Bank, Categories, Settings) above the home indicator, and 16 px gutters.

```
desktop                                        phone
┌──────────┬────────────────────────────────┐  ┌───────────────────┐
│ Budge    │ November 2026   ‹  ›           │  │ November 2026 ‹ › │
│          │                                │  │ $1,240.00         │
│ Budget   │ $1,240.00   Ready to Assign    │  │ ═════════         │
│ Accounts │ ═════════                      │  │ Needs you (2)     │
│ Bank   2 │ Needs you                      │  │ ─────────────     │
│ Categor… │  3 bank accounts to set up  ›  │  │ Rent       0.00   │
│ Settings │  Groceries overspent $42    ›  │  │ Groceries -42.00  │
│ ──────── │ ────────────────────────────── │  │                   │
│ Cash     │ Category  Assigned  Avail.     │  │                   │
│  4,210   │ Bills ─────────────────────    │  ├───────────────────┤
│ Visa     │ Rent      1,200.00   0.00      │  │ ▣  ▤  ⇄  ☰  ⚙     │
│  -312    │                                │  └───────────────────┘
└──────────┴────────────────────────────────┘
```

**Principles.**

- The signature is the ledger total. Ready to Assign is a large tabular amount with an accountant's double rule beneath it: green when there are dollars to assign, red ink when more was assigned than came in. Everything around it stays quiet.
- Status is color plus words: an amount is never the only signal, and each status has one word ("Overspent", "Needs you", "Funded").
- A row is the unit, not a card. Lists are ruled rows on the sheet surface. A bounded group that the owner works through as one thing (a bank connection, a Category group, a settings section, the Category inspector) sits on its own sheet with the ruled rows inside it; rows themselves never become cards.
- Small counts and status words sit beside the item they describe (`Bank 2` in the navigation, `Hidden` on a Category, a `Needs you` task's count) instead of in a separate notice.
- A "more actions" menu shows only an ellipsis, and below the md container width the search, filter, clear and add controls show only their icon. Each has an accessible name that names the action and its target. Every other control keeps a visible label.
- One "Needs you" list replaces scattered notices. Each item is a sentence with one action, set as a rounded link so the row of tasks reads as things to press, not as status.
- Motion only answers the user: dialogs open, rows expand, and a saved amount settles. `prefers-reduced-motion` turns it off.

**Self-review against defaults.**

- The first plan used Inter with a slate palette. That is the shadcn default, so it changed to a ledger-green paper and a legibility face chosen for this owner's a11y brief.
- A big number with a small label is the generic hero. It stays because Ready to Assign is the one number zero-based budgeting turns on, but it gets the double-rule total treatment from ledgers instead of a gradient or card.
- Hairline rules are a broadsheet tell. They appear only in tables, where ledger columns need them, and surfaces keep a modest radius.

## Constraints

- ADR 0001, 0002, and 0003 hold. Every enforced rule in AGENTS.md holds.
- Journeys and the verify-budge feature map change with every label or flow they cite. `featureMap.test` passes.
- No real financial data enters the repo. Plaid fixtures stay synthetic.
- No layout shifts. Nothing on a page moves unless the user just caused it: data that loads fills space already reserved for it, at its final size; tables have fixed column widths; status and error lines keep their slot whether empty or not; buttons keep their width when their label changes (`Sync now`/`Syncing…`); the font loads without a reflow; the scrollbar gutter is stable. Every journey fails on a layout shift that came without user input (`e2e/journeys/layoutShift.ts`, wrapped around every journey in `e2e/journeys/index.ts`). Ticket 07 owns this.
- WCAG 2.2 AA: contrast, 24 px minimum targets (44 px on phones for primary actions), visible focus, reduced motion, landmarks, and a logical heading order.

## Done when

- Two Sol (high) reviewers and one Opus reviewer, each with fresh context and driving the real app, score the UI/UX at least 9/10.
- `bun run check` and `bun run test:e2e:local` pass. CI is green, CodeRabbit has approved the latest commit, the PR is merged, and production deploys.
- Production's held Capital One accounts can be set up from the Bank page on a phone.
