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
  - Scrolling stays inside the area (`overscroll-contain`).
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
- any class string containing `overflow-auto`, `overflow-scroll` or their `x-` and `y-` forms, with or without a variant prefix. It checks static attributes, class arrays, `cn()` arguments and template literals.

`eslint/rules/ui-primitives-config.test.js` holds the refused and allowed cases. Before the conversion, the rule flagged all 15 selects. The previous `account-sidebar.svelte` fails it.

The rule does not see CSS `overflow: auto` in stylesheets. None remain.

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
