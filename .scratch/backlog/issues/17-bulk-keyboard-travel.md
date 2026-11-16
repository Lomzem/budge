# 17: Shorten keyboard travel back to bulk actions

Status: needs-triage

Source: `.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md`).

The bulk action bar precedes the table; about 31 Shift+Tab presses were needed from checked rows. Choose a reading-order, skip-control or shortcut design and pin it in a journey.

Current code: transaction-table.svelte renders the selection bar before the table without a bulk-action shortcut. Source inspection only; historical browser findings need reproduction before implementation.
