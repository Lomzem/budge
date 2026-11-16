# 20: Keep partial Undo explanations near returned focus

Status: needs-triage

Source: `.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md` at commit `f17cd77` (retrieve with `git show f17cd77:.scratch/first-use-ux-polish/issues/01-round-2-ui-findings.md`).

After a Category deletion, partial Undo scrolls focus to a row and leaves the explanation offscreen. Preserve visible context as well as its live announcement.

Current code: transaction-table.svelte still puts undo.text above the table and focuses the returned row. Source inspection only; historical browser findings need reproduction before implementation.
