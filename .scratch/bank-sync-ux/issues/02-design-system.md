# 02: Ledger design system

**Status:** done

**Spec:** [Bank sync and UI/UX](../spec.md)

**Blocked by:** None

## What to build

- One typeface, Atkinson Hyperlegible Next, chosen for distinguishable digits and letterforms. It loads with `font-display: optional`, is preloaded by SvelteKit, and falls back to Arial sized to its metrics, so it can't reflow the page.
- A ledger palette: paper page, white sheets, ledger green for primary and funded, ochre for warnings, red for overspending. Every token is defined for light and dark.
- A 1.2 type scale from a 16 px base, with tabular figures everywhere.
- Primitives restyled for 36 px targets, 44 px on touch screens, and a 2 px focus outline.
- An app icon drawn from paths: three assigned bars over a double rule.

## Acceptance

- [x] Text and status colors meet WCAG 2.2 AA (4.5:1) on every surface they sit on, and control boundaries meet 3:1, in both themes.
- [x] Focus is visible on every control.
- [x] Reduced motion stops transitions and animations.

## Comments

- Contrast measured with a script over every token pair. Light: ink 14.5:1, muted text at least 5.77:1, ledger green at least 5.37:1, red at least 5.23:1, ochre at least 4.90:1, input boundary at least 3.01:1. Dark ratios are higher.
- Font fallback metrics: size-adjust 98.88%, ascent 99.51%, descent 31.96%, line gap 0%.
- The input primitive now types `value` as `string | number | null`, because lint covers owned primitives.
