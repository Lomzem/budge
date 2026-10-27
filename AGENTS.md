# Model ownership

- **Opus 5.5** owns production application and library code: architecture, API design, and implementation.
- **UI implementation belongs exclusively to Opus 5.5**, including UI in prototypes. Sol must delegate all UI implementation and changes to Opus; Sol may review UI code but must not edit it.

# Delegation

Work inline when the current model owns the task. Delegate when another model is required, or when an independent task benefits from parallel work or a separate context. Keep routine lookups and small tasks inline.

## Agent skills

### Issue tracker

Before reading, creating, or updating issues or specs, read `docs/agents/issue-tracker.md`. Issues live as local Markdown files under `.scratch/<feature>/`.

### Triage labels

Before triaging issues or changing their status, read `docs/agents/triage-labels.md` for the five default triage labels.

### Domain docs

Before exploring the codebase, read `docs/agents/domain.md` for the single-context glossary and ADR consumer rules.
