# Phone Escape — Standards and test-audit

Pass: no actionable Standards finding in `git diff cf4a0cf...ce0dad7` (five files; HEAD `ce0dad735f8ff820dece4179347419affde7314d`). Reviewed AGENTS, domain/glossary, spec Budget items 4–5, ticket 06's sol-a-A1 record, code-review's twelve smell heuristics and test-audit; repository overrides applied and tooling-enforced rules excluded.

`src/routes/(app)/+page.svelte:291,676` cancels the phone Dialog's cloned Escape only while focus belongs to the inspector. The existing section handler closes a clean form; its dirty form handler prevents that close and clears locally (`category-inspector.svelte:207,442`). `clearMove():115` now owns picker focus for both Escape and Clear. Desktop keeps its section behavior and gains the intended focus return. Target/Delete are sibling portals; installed bits-ui's `use-escape-layer.svelte.js` dispatches only to the responsible top layer, preserving nested ownership. Existing `closeInspector():296` and Dialog `restoreFocus` preserve opener return.

Test-audit passes: `e2e/journeys/inspector.ts:175–198` drives real keyboard/picker/form behavior at 320px, asserting dirty values/error cleared, Dialog retained, picker focused, second Escape closed, Groceries focused and Coffee Assigned unchanged. The phone branch owns a distinct Dialog lifecycle risk beyond desktop coverage; no test-only production seam or fabricated response was added.

Inspected original repair worktree evidence under `test-results/verify-budge/`: `red-phone-escape-2` fails at the phone picker after Dialog disappearance; `green-phone-escape-2` passes all 12 steps (trace API interval 24.6s). `green-phone-escape` also passes inspector/cover and Budget siblings; `green-phone-escape-targets` passes Target workflow, but does not exercise phone nested Escape.

Principles changed assessment: Boundary Discipline/Model the Domain support local event ownership; Laziness supports sharing clear/focus; Experience First/Test Behavior justify focus assertions; Prove It Works limits historical evidence; Guard the Context Window kept review scoped.

Checks: diff whitespace clean. No app, browser, tests or source edits run. Historical summaries identify dirty `93a959ff`, not clean-SHA approval; fresh nested Escape/UI judging remains parent-owned.
