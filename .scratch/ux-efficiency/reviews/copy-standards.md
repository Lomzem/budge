# Standards review — copy slice

Reviewed `git diff cbfc013...3374532`; sole commit `3374532bc714cda42325c64a3b3e128366631ebd` (spec items 21–26).

**Findings: none.** No documented-standard violations or baseline smell judgments warrant action. Tool-enforced rules were excluded.

Direct source checks:

- `src/routes/sign-in/+page.svelte:12`: deleting the tagline and presentation wrapper retains the `Budge` h1, BrandMark row and Clerk `SignIn` control.
- `src/routes/(app)/categories/+page.svelte:99`: the `Categories` h1 and action controls remain; the deleted wrapper carried presentation classes only.
- `src/routes/(app)/settings/+page.svelte:47`: `theme-heading` remains the h2 and accessible-name target for both the section and radio group. Individual radio labels are unchanged. At line 67, the shorter export introduction retains the format choice.
- `src/lib/components/budget/category-inspector.svelte:268`: the named Target section and `Add Target`/`Edit Target` button remain; deleting the empty-state paragraph leaves no empty conditional branch.
- `src/routes/(app)/+page.svelte:492`: `Select a Category.` retains the next action and glossary vocabulary.
- `src/lib/components/shell/export-dialog.svelte:61–79` is unchanged against the baseline: backup scope, omitted Bank Connection tokens, multiple CSV downloads, keep-page-open guidance, status and format controls remain.

Rules applied: `docs/agents/domain.md` requires glossary vocabulary; `GLOSSARY.md` supplies Category and Target. The spec's Outcomes and copy constraints require retained accessible names and consequential guidance. The two feature-map edits track changed strings without changing journeys. No tests were added or changed.

Principles affecting the review: **Experience First** focused the check on retained actionable controls and guidance; **Subtract Before You Add** and **Laziness Protocol** supported removing redundant wrappers without introducing helpers; **Prove It Works** required inspecting the actual commit and unchanged export dialog rather than accepting the implementation report. **Guard the Context Window** kept investigation scoped to affected sources and their immediate dependencies.

Analysis-only `/correct`: none. This bounded diff provides no evidence of a repeated mistake in two or more occurrences; no new rule or abstraction is justified.

Limits: source review only; no browser, app lifecycle, tests or lint run. Rendered spacing, runtime accessibility, keyboard behavior and integration gates remain for the parent's independent verification.
