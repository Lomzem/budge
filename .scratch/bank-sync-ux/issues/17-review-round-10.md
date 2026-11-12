# 17 — Fixes from review round 10

Status: done; round 11 reviews next

Round 10 scored 9 (sol-a10), 9 (sol-b10) and 8 (opus10).

## Done

- Budget inspector on phones:
  - It opens, and `Previous`/`Next Category` reopen it, scrolled to the top, so Ready to Assign is in view and nothing sits under the pinned header.
  - The step buttons truncate a long name on one line; their accessible name keeps the full name.
  - Ready to Assign keeps its label on one line. The amount wraps under it only when both can't fit.
- Register on phones:
  - A row's Category, Account and bank flag wrap instead of truncating.
  - The Search placeholder is `Payee or memo`, which fits at 320 px.
  - The count line and the Approve button share a row from `sm`. Below it they stack, whatever the count says, so a changing count never moves the button.
  - With no rows at all, only the count line shows, without the table's column headers.
  - The Cleared checkbox's hit area is 44 px square for a mouse as well as touch.
- Budget:
  - The Assigned hint sits below the field, aligned to its right edge and two lines wide, instead of covering Activity and Available.
  - The overspent chip scrolls the Category's row to the middle of the screen.
  - The Assigned and inspector alerts exist only while they hold a message. The page had 15 empty alert regions.
  - `Funded` names a Target that is met. A Category without a Target shows no status for a positive Available.
  - Away from the current month, `This month` returns to it. It is icon-only below `sm` and hidden below `xs`, and its place is reserved, so the month row never shifts.
  - On phones, a card's `waiting on` notes show only in its inspector, which already lists them under Card payment.
- Splits: when exactly one line has its Category but no amount and something is left, Save gives that line what is left and saves in one press.
- Menus: every app menu focuses its first enabled item, whether opened by click or key.
- Bank badge: red when a connection needs a reconnect or failed, amber otherwise, matching the Budget chip. The Unapproved badge stays green.
- Load: a hard load paints the sidebar or tab bar right away, with `Loading…` in the page area. Only a forbidden account or an unreachable server shows the centered Budge screen.
- Nits:
  - The Account balance lost its double underline.
  - The Payee field's datalist arrow is hidden.
  - The Export dialog's status replaces its JSON/CSV note, so it keeps no empty band.
  - The consent pill's accessible name is `Consent ends <day>: <connection>`, without the stray space.

## Kept as is

- The Payee filter lists every Payee, including one whose only Transaction was deleted (opus10 #9). Payees outlive their Transactions on purpose: they feed name suggestions and the remembered Category. Limiting the list to used Payees would need a per-Payee Transaction lookup in `payees.list`. Filtering by an unused Payee shows `No Transactions match.`, which is accurate.
- `Cover … from Ready to Assign` still wraps in the desktop inspector. The amount is the point of the button.
- `Move to group` being about 2 px off is not reproducible in the current menu.
- The phone Account header is shorter: the first Transaction moved from about y=470 to y=438 at 390 px. It keeps the Balance, Reconcile and sync line, which are the page's purpose.

## Verification

- These pass: `bun run lint`, `lint:ui`, `typecheck`, `codegen:check`, `format:check` and `bun run test` (826 tests).
  - `src/lib/transactionEditor.test.ts` has a new table for the one-press split save. It fails on the previous `transactionEditor.ts`.
- Screenshots at 1280, 390 and 320 px: inspector `scrollTop` 0 on open and after Next, the Assigned hint below the field, `This month`, the Export dialog, and the Checking register. A menu opened by click focuses `Rename`.
- Feature maps updated: budget, inspector, splits, plaid, shell, transactions, export, categories.
- The first full journey run failed 12 of 39. There were two causes:
  - The new loading shell mounted the sidebar's Add Account dialog before the owner check passed. Its `settings.get` subscription failed FORBIDDEN, and the Bank page shares that subscription, so it stayed on `Loading…`. The dialog now mounts with the Accounts list, once the owner check passes.
  - Vite re-bundled dependencies mid-session for the new `calendar-check` icon, which loaded a second Svelte runtime into the bank menus. That is a dev-server artifact; restarting the app cleared it.
- `shell/phone-pages` then caught the count line and `Approve all` swapping rows on `/accounts` at 390 px as the count text changed. They now stack below `sm`.
- Full journeys: 39/39 pass. The CLS sweep at 1280, 390 and 320 shows 0 shifts without input on every page and navigation.
