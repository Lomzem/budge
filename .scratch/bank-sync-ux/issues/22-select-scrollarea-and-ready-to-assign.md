# 22 — shadcn-svelte Select and ScrollArea, Ready to Assign card

Status: done

The owner asked for three things:

- the Ready to Assign card, whose spacing looked inconsistent;
- the shadcn-svelte Select in place of every native select, with a lint rule;
- the shadcn-svelte ScrollArea for scrolling regions, with a lint rule.

## Ready to Assign card

The card was a wrapping flex row. Its max-content width laid the label, the amount and the note end to end, and the amount's tall line box made the top padding look larger than the bottom.

It is now a two-column grid (`grid-cols-label-figure` in `src/app.css`) with even padding:

- The label stays on one line.
- The amount is centered beside the label and the note from `sm` up.
- The note wraps under both columns on phones.

## Select

- `src/lib/components/ui/select/` is the shadcn-svelte Select (bits-ui), restyled to the app's field tokens. Items wrap long names, and touch screens get 44 px rows.
- `SelectField` (`src/lib/components/select-field.svelte`) takes `choices`, either flat or grouped (`src/lib/components/choices.ts`).
  - Values are prefixed internally, so `''` can be a real choice, such as All Accounts or No due day.
  - With no match, the field shows its placeholder.
- All 15 native selects are now `SelectField`:
  - the Add Category, delete Category, delete group and Target dialogs;
  - the Inspector's Move money;
  - the import Account, Match and twin pickers;
  - the register filters;
  - the Transaction dialog's Account, Category, and split-line Category fields.

  Every save already checks for an empty choice, so the native `required` attribute is not missed.
- The Select's own scroll buttons are gone. They mounted mid-scroll and pushed the options down, which is a layout shift, and they made a click land on the wrong option.

## ScrollArea

- `src/lib/components/ui/scroll-area/` is the shadcn-svelte ScrollArea.
  - Callers set the bounds: a height cap, or a flex parent. The area fills them.
  - The scrollbar overlays the content and shows on hover, so it moves nothing.
  - A vertical area scrolls itself first, then passes the rest of a wheel or swipe to the page, as a native scroller does.
  - A horizontal area keeps sideways swipes to itself (`overscroll-x-contain`), so a trackpad swipe over a table never goes back in history. Vertical swipes pass through to the page.
  - The dialog body and the Select list contain both axes, because the page behind them is locked.
  - A horizontal area snaps its children to their start.
- Every scroll container now uses it:
  - in the app: the sidebar, the Budget side panel, the Needs-you row and the import preview table;
  - in `ui/`: dialog bodies, tables, menus and Select lists.
- The Select and the dialog build the area from bits-ui primitives:
  - The Select's viewport is the ScrollArea viewport, through bits-ui's `child` snippet, so keyboard highlighting still scrolls the list.
  - The dialog keeps its scroll padding and pinned-title measuring on the viewport.
- Menus and Select lists keep 8 px from the window edge (`collisionPadding`).

## Lint rule

`no-restricted-syntax` in `eslint.ui.config.js`, run by `bun run lint:ui`, refuses two things:

- a native `<select>` element;
- `overflow-auto`, `overflow-scroll` or their `x-` and `y-` forms, with or without a variant prefix. The rule checks:
  - `class` attributes: static values, class arrays and template literals;
  - `cn()` arguments;
  - `class:` directives.

  Other strings, such as a `title` or a script message, are ignored.

`eslint/rules/ui-primitives-config.test.js` holds the refused and allowed cases. Before the conversion, the rule flagged all 15 selects. The previous `account-sidebar.svelte` fails it.

The rule has limits:

- It does not see CSS `overflow: auto` in stylesheets. None remain.
- It does not see a class string kept in a plain variable outside `cn()`.
- It does not lint the generated `ui/` files the owner has not taken over.

## Local review

Sol (GPT-6.1-Sol, high) reviewed `146fc1a`. It found three minor issues, all fixed:

1. **Required pickers lost their announcement.** `SelectField` now takes `required` and sets `aria-required` on its trigger. Every select that was `required` before passes it:
   - Category Group;
   - both delete destinations;
   - Move money;
   - the import Account and Match pickers;
   - the Transaction Account and split-line Category.

   The twin picker is not required, because `Skip this row` is an empty but valid choice. `categories/manage` checks `aria-required` on Category Group, and it fails when `required` is removed.
2. **`class:overflow-auto={…}` passed lint.** The rule now checks `class:` directives.
3. **The rule flagged any string containing `overflow-auto`.** It now checks only `class` attributes, `cn()` arguments and `class:` directives.

The new cases in `ui-primitives-config.test.js` fail under the previous rule: the refused directive and the allowed `title` text. The `cn()` case passes under both and keeps that coverage now that the rule is narrower.

Sol left two questions open:

- linting CSS and the generated `ui/` files, which are the limits above;
- touch scroll chaining in nested scroll areas. The import preview's area, which is 320 px at most, sits inside the dialog's scrolling body. A swipe scrolls the preview to its end, then the dialog, as native scrolling does. Checking this question found the regression below.

## Scroll chaining

The recheck found a regression. Every ScrollArea had `overscroll-contain` on both axes, which main never had. In Chrome, that stops a wheel or swipe even when the area has nothing to scroll that way, so:

- a vertical wheel over any table, which scrolls only sideways, left the page where it was, at every width;
- a wheel over the sidebar or the Budget side panel, when they fit, left the page where it was.

Now a vertical area chains natively, and a horizontal area contains only the sideways axis. Measured by wheel in Chromium:

| Where | Before | After |
| --- | --- | --- |
| Accounts table, 1280 and 390 | page stays at 0 | page scrolls 300 px |
| Budget side panel, 1440×900 | page stays at 0 | page scrolls 300 px |
| Sidebar, 1280×720, nothing to scroll | page stays at 0 | page scrolls |
| Sidebar, 1280×360, 158 px to scroll | sidebar scrolls, page stays | sidebar scrolls 158 px, then the page |

`shell/navigate` now wheels over the Budget table and the sidebar, and expects the page to move. With both axes contained again, it fails.

## Journeys

`choose(field, option)` and `choicesOf(field)` in `e2e/journeys/journey.ts` drive the Select. These journeys moved off `selectOption` and `option:checked`:

- transfers, imports, payees, targets, search, budget, categories, splits and inspector.

`search/filters` now reads the Payee id from the URL instead of an option's `value`.

## Bank card status line

The full journey run caught a layout shift on `/bank` (`plaid/late-sync`). A failed result arriving late added the freshness after its text (a round-12 change), so the line grew from one line to two and moved the buttons and the next section.

- The line now always takes two lines of height, with its content centered, at every width.
- Longer text is clipped at two lines. The whole text stays in the line's `title`, and the result in the `role="status"` region.
- `flex-1` applies only from `sm` up. In the phone column it set the height basis to 0 and overrode the fixed height.

## Verification

- These pass: `bun run lint`, `lint:ui`, `format:check`, `typecheck`, `codegen:check` and `bun run test`.
- Journeys:
  - All 39 pass. The first full run (`sa-full`) passed 16 and failed 23.
  - 21 of those 23 were the dev server: a dependency pre-bundled late loaded a second Svelte runtime (`Cannot read properties of undefined (reading 'call')` in `circle-alert.svelte`), and pages stopped loading. A restart cleared it, and they passed on rerun.
  - Two were real:
    - `accounts/start-edit` still read native `option` elements. It now uses `choicesOf`.
    - `plaid/late-sync` showed the shift above once the server recovered. After the card fix all 9 Bank journeys pass.
- The CLS sweep at 1280, 390 and 320 shows no shift without input on any page or navigation.
- Screenshots:
  - the Select list scrolled by keyboard, on desktop and phone, light and dark;
  - a phone dialog with its pinned title;
  - the menu;
  - the Bank card at 1280 and 390;
  - the `Needs you` row with its fade.
- At 1280×360 a wheel over the sidebar scrolls it by 158 px and leaves the window at 0.
- After the review fixes, the 18 accounts, categories, imports, inspector, splits, transactions and transfers journeys pass.
- After the scroll-chaining fix, `shell/navigate` passes, and fails as a negative control with both axes contained.
